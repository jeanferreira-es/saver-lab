import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

const KEY = 'settings:v1';

export type ThemePreference = 'system' | 'light' | 'dark';

/** Redes sociais que têm aba própria na barra inferior. */
export type SocialNetwork = 'instagram' | 'threads' | 'tiktok';

export type Settings = {
  /** Quais redes aparecem como aba na barra inferior. */
  visibleNetworks: Record<SocialNetwork, boolean>;
  /** Salvar automaticamente na galeria após o download. */
  autoSaveToGallery: boolean;
  /** Balão flutuante sobre outros apps (Android). */
  floatingBubble: boolean;
  /** Tema do app: segue o sistema ou força claro/escuro. */
  theme: ThemePreference;
};

const defaults: Settings = {
  visibleNetworks: { instagram: true, threads: true, tiktok: true },
  autoSaveToGallery: true,
  floatingBubble: false,
  theme: 'system',
};

let cache: Settings | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export async function getSettings(): Promise<Settings> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    cache = {
      ...defaults,
      ...saved,
      // Mescla campo a campo: redes novas entram visíveis para quem já tinha ajustes salvos.
      visibleNetworks: { ...defaults.visibleNetworks, ...saved.visibleNetworks },
    };
  } catch {
    cache = { ...defaults };
  }
  emit();
  return cache;
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  cache = next;
  emit();
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Ajustes atuais, re-renderizando quando mudam. `null` enquanto ainda não foram lidos do disco. */
export function useSettings(): Settings | null {
  const value = useSyncExternalStore(subscribe, () => cache);
  useEffect(() => {
    if (!cache) getSettings();
  }, []);
  return value;
}
