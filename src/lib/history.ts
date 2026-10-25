import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

const KEY = 'history:v1';

export type HistoryEntry = {
  /** id único local: <postId>-<index> */
  key: string;
  postUrl: string;
  author: string | null;
  /** Usuário do autor no Instagram (downloads antigos não têm; neles `author` costuma ser o usuário). */
  username?: string | null;
  caption: string;
  type: 'video' | 'image';
  /** URI local do arquivo (documentDirectory) */
  fileUri: string;
  thumbnail: string | null;
  duration: number | null;
  sizeBytes: number | null;
  savedToGallery: boolean;
  createdAt: number;
};

let entries: HistoryEntry[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

async function persist() {
  await AsyncStorage.setItem(KEY, JSON.stringify(entries));
}

export async function loadHistory() {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    entries = raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    entries = [];
  }
  loaded = true;
  emit();
}

export async function upsertEntry(entry: HistoryEntry) {
  entries = [entry, ...entries.filter((e) => e.key !== entry.key)];
  emit();
  await persist();
}

export async function updateEntry(key: string, patch: Partial<HistoryEntry>) {
  entries = entries.map((e) => (e.key === key ? { ...e, ...patch } : e));
  emit();
  await persist();
}

export async function removeEntry(key: string) {
  entries = entries.filter((e) => e.key !== key);
  emit();
  await persist();
}

export function getEntry(key: string) {
  return entries.find((e) => e.key === key);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useHistory() {
  return useSyncExternalStore(subscribe, () => entries);
}
