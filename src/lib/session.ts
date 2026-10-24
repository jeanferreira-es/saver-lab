import type CookieManagerType from '@preeternal/react-native-cookie-manager';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { TurboModuleRegistry } from 'react-native';

const KEY = 'instagram-session';
const INSTAGRAM = 'https://www.instagram.com';
// Só os cookies que a API web precisa — o SecureStore limita o tamanho do valor.
const NEEDED = ['sessionid', 'ds_user_id', 'csrftoken', 'mid', 'ig_did', 'rur'];

export type Session = {
  /** Cabeçalho Cookie pronto para enviar ao servidor. */
  cookie: string;
  userId: string | null;
  savedAt: number;
};

/**
 * O módulo de cookies é nativo: não existe no Expo Go nem em builds antigos.
 * Nesses casos o app segue funcionando, só sem o login do Instagram.
 */
export const loginAvailable = TurboModuleRegistry.get('CookieManager') != null;

function cookieManager(): typeof CookieManagerType {
  if (!loginAvailable) throw new Error('Login indisponível: gere um novo development build.');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@preeternal/react-native-cookie-manager').default;
}

let session: Session | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export async function loadSession() {
  if (loaded) return;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    session = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    session = null;
  }
  loaded = true;
  emit();
}

export function getSession() {
  return session;
}

/**
 * Lê os cookies que a WebView recebeu do Instagram. Se já houver `sessionid`
 * (login concluído), salva a sessão e retorna true.
 */
export async function captureSession(): Promise<boolean> {
  const cookies = await cookieManager().get(INSTAGRAM, { iosCookieStore: 'webKit' });
  if (!cookies.sessionid?.value) return false;
  const cookie = NEEDED.filter((name) => cookies[name]?.value)
    .map((name) => `${name}=${cookies[name].value}`)
    .join('; ');
  session = { cookie, userId: cookies.ds_user_id?.value ?? null, savedAt: Date.now() };
  emit();
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
  return true;
}

export async function logout() {
  session = null;
  emit();
  await SecureStore.deleteItemAsync(KEY);
  if (loginAvailable) await cookieManager().clearAll({ iosCookieStore: 'webKit' }).catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSession() {
  return useSyncExternalStore(subscribe, () => session);
}
