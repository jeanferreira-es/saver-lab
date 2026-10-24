import { getSession } from './session';
import { getSettings } from './settings';

export type MediaItem = {
  index: number;
  id: string;
  type: 'video' | 'image';
  ext: string;
  duration: number | null;
  width: number | null;
  height: number | null;
  thumbnail: string | null;
};

export type PostInfo = {
  url: string;
  id: string;
  title: string;
  caption: string;
  author: string | null;
  username: string | null;
  items: MediaItem[];
};

export type ProfilePost = {
  id: string;
  url: string;
  type: 'video' | 'image' | 'carousel';
  thumbnail: string | null;
  caption: string;
  takenAt: number | null;
};

export type ProfileInfo = {
  username: string;
  fullName: string | null;
  avatar: string | null;
  isPrivate: boolean;
  posts: ProfilePost[];
};

const INSTAGRAM_URL = /https:\/\/(www\.)?instagram\.com\/(p|reel|reels|tv)\/[\w-]+\/?(\?[^\s]*)?/i;

/** Extrai o primeiro link do Instagram de um texto qualquer (ex.: o que veio do "Copiar link"). */
export function extractInstagramUrl(text: string | null | undefined): string | null {
  return text?.match(INSTAGRAM_URL)?.[0] ?? null;
}

async function base() {
  return (await getSettings()).apiUrl;
}

export async function fetchInfo(url: string, signal?: AbortSignal): Promise<PostInfo> {
  const endpoint = `${await base()}/api/info?url=${encodeURIComponent(url)}`;
  let res: Response;
  try {
    res = await fetch(endpoint, { signal });
  } catch (e) {
    if ((e as Error).name !== 'AbortError') console.log('[api] falha de conexão em', endpoint, e);
    throw e;
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.log('[api] resposta de erro', res.status, endpoint, body);
    throw new Error(body.error ?? `Erro ${res.status} no servidor.`);
  }
  return body as PostInfo;
}

export async function fetchProfile(username: string, signal?: AbortSignal): Promise<ProfileInfo> {
  const endpoint = `${await base()}/api/profile?username=${encodeURIComponent(username)}`;
  const session = getSession();
  console.log('[api] consultando perfil', username, session ? 'com sessão do Instagram' : 'sem sessão');
  let res: Response;
  try {
    res = await fetch(endpoint, { signal, headers: session ? { 'X-IG-Session': session.cookie } : undefined });
  } catch (e) {
    if ((e as Error).name !== 'AbortError') console.log('[api] falha de conexão em', endpoint, e);
    throw e;
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.log('[api] resposta de erro', res.status, endpoint, body);
    throw new Error(body.error ?? `Erro ${res.status} no servidor.`);
  }
  return body as ProfileInfo;
}

export async function downloadUrl(url: string, item: MediaItem) {
  const type = item.type === 'image' ? '&type=image' : '';
  return `${await base()}/api/download?url=${encodeURIComponent(url)}&index=${item.index}${type}`;
}

export async function ping(apiUrl?: string): Promise<boolean> {
  try {
    const res = await fetch(`${(apiUrl ?? (await base())).replace(/\/+$/, '')}/health`);
    if (!res.ok) console.log('[api] health respondeu', res.status);
    return res.ok;
  } catch (e) {
    console.log('[api] falha de conexão no health', e);
    return false;
  }
}
