import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { PostInfo, ProfileInfo, ProfilePost } from './api';

const KEY = 'profiles:v1';
const MAX_PROFILES = 30;
const MAX_POSTS = 12;

export type ProfileEntry = {
  username: string;
  fullName: string | null;
  avatar: string | null;
  /** Publicações já buscadas no app — usadas quando o Instagram não libera o feed. */
  posts: ProfilePost[];
  visitedAt: number;
};

let entries: ProfileEntry[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

async function persist() {
  await AsyncStorage.setItem(KEY, JSON.stringify(entries));
}

export async function loadProfiles() {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    entries = raw ? (JSON.parse(raw) as ProfileEntry[]) : [];
  } catch {
    entries = [];
  }
  loaded = true;
  emit();
}

async function visit(username: string, patch: (current: ProfileEntry) => ProfileEntry) {
  const current = entries.find((e) => e.username === username) ?? {
    username,
    fullName: null,
    avatar: null,
    posts: [],
    visitedAt: 0,
  };
  const next = { ...patch(current), visitedAt: Date.now() };
  entries = [next, ...entries.filter((e) => e.username !== username)].slice(0, MAX_PROFILES);
  emit();
  await persist();
}

/** Registra o autor de um post buscado na aba Baixar. */
export async function recordPost(post: PostInfo) {
  if (!post.username) return;
  const first = post.items[0];
  const item: ProfilePost = {
    id: post.id,
    url: post.url,
    type: post.items.length > 1 ? 'carousel' : (first?.type ?? 'video'),
    thumbnail: first?.thumbnail ?? null,
    caption: post.caption,
    takenAt: null,
  };
  await visit(post.username, (p) => ({
    ...p,
    fullName: p.fullName ?? post.author,
    posts: [item, ...p.posts.filter((x) => x.url !== item.url)].slice(0, MAX_POSTS),
  }));
}

/** Registra a visita a um perfil aberto na aba Perfis. */
export async function recordProfile(profile: ProfileInfo) {
  await visit(profile.username, (p) => ({ ...p, fullName: profile.fullName, avatar: profile.avatar }));
}

export async function removeProfile(username: string) {
  entries = entries.filter((e) => e.username !== username);
  emit();
  await persist();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useProfiles() {
  return useSyncExternalStore(subscribe, () => entries);
}
