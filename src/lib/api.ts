
export type MediaItem = {
  index: number;
  id: string;
  type: 'video' | 'image';
  ext: string;
  duration: number | null;
  width: number | null;
  height: number | null;
  thumbnail: string | null;
  /** URL direta da mídia na CDN do Instagram (stories): baixada sem passar pelo servidor. */
  src?: string;
};

export type PostInfo = {
  /** Stories vêm da sessão do usuário no celular, não do servidor. */
  kind?: 'story';
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

// O site às vezes abre posts com o usuário no caminho: `/<usuário>/p/<código>/`.
const INSTAGRAM_URL = /https:\/\/(www\.)?instagram\.com\/(?:([\w.]+)\/)?(p|reel|reels|tv)\/([\w-]+)\/?(\?[^\s]*)?/i;

/** Extrai o primeiro link do Instagram de um texto qualquer (ex.: o que veio do "Copiar link"). */
export function extractInstagramUrl(text: string | null | undefined): string | null {
  const m = text?.match(INSTAGRAM_URL);
  if (!m) return null;
  const [link, , user, type, code] = m;
  // Com o usuário no caminho, devolve o link padrão do post (o formato que o servidor entende).
  return user ? `https://www.instagram.com/${type.toLowerCase() === 'reels' ? 'reel' : type.toLowerCase()}/${code}/` : link;
}

// Endereço fixo do servidor (definido no projeto, não muda pelo app).
const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://igsaver-server.onrender.com').replace(/\/+$/, '');

export async function fetchInfo(url: string, signal?: AbortSignal): Promise<PostInfo> {
  const endpoint = `${API_URL}/api/info?url=${encodeURIComponent(url)}`;
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

export async function downloadUrl(url: string, item: MediaItem) {
  const type = item.type === 'image' ? '&type=image' : '';
  return `${API_URL}/api/download?url=${encodeURIComponent(url)}&index=${item.index}${type}`;
}
