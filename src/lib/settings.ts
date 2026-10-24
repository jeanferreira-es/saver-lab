import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'settings:v1';

export type ThemePreference = 'system' | 'light' | 'dark';

export type Settings = {
  /** Endereço do backend, ex.: https://igsaver-server.onrender.com */
  apiUrl: string;
  /** Salvar automaticamente na galeria após o download. */
  autoSaveToGallery: boolean;
  /** Balão flutuante sobre outros apps (Android). */
  floatingBubble: boolean;
  /** Tema do app: segue o sistema ou força claro/escuro. */
  theme: ThemePreference;
};

const defaults: Settings = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'https://igsaver-server.onrender.com',
  autoSaveToGallery: true,
  floatingBubble: false,
  theme: 'system',
};

let cache: Settings | null = null;

export async function getSettings(): Promise<Settings> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = { ...defaults, ...(raw ? (JSON.parse(raw) as Partial<Settings>) : {}) };
  } catch {
    cache = { ...defaults };
  }
  return cache;
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  next.apiUrl = next.apiUrl.trim().replace(/\/+$/, '');
  cache = next;
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
