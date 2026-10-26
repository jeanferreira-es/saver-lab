import type { MediaItem, PostInfo } from './api';
import type { CapturedPost } from './instagram-web';

// O feed traz muitos posts: guarda só os mais recentes.
const MAX = 300;
const CODE = /\/(?:p|reel|reels|tv)\/([\w-]+)/i;

/**
 * Posts que o próprio site carregou na aba Navegar, pelo código do link. Só em
 * memória: as URLs da CDN expiram, e o site manda de novo ao rolar o feed.
 */
const posts = new Map<string, CapturedPost>();

export function rememberPost(post: CapturedPost) {
  posts.delete(post.code);
  posts.set(post.code, post);
  if (posts.size > MAX) posts.delete(posts.keys().next().value!);
}

/** Post já carregado pelo site, pronto para baixar direto da CDN; null se não estiver em memória. */
export function cachedPost(url: string): PostInfo | null {
  const code = url.match(CODE)?.[1];
  const post = code ? posts.get(code) : undefined;
  if (!post) return null;
  const items: MediaItem[] = post.items.map((item, i) => ({
    index: i + 1,
    id: item.pk,
    type: item.video ? 'video' : 'image',
    ext: item.video ? 'mp4' : 'jpg',
    duration: item.duration ?? null,
    width: item.width ?? null,
    height: item.height ?? null,
    thumbnail: item.image ?? null,
    src: item.video ?? item.image,
  }));
  return {
    url: `https://www.instagram.com/p/${post.code}/`,
    // O código do link: o mesmo id que o servidor usa, para o histórico reconhecer o post.
    id: post.code,
    title: post.caption || 'Post',
    caption: post.caption ?? '',
    author: post.fullName || post.username || null,
    username: post.username ?? null,
    items,
  };
}
