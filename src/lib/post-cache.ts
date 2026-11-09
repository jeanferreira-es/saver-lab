import type { MediaItem, PostInfo } from './api';
import type { CapturedPost } from './instagram-web';
import { THREADS_HOME, threadsCode } from './threads-web';
import { TIKTOK_HOME, tiktokId } from './tiktok-web';
import { TWITTER_HOME, tweetId } from './twitter-web';

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
  // O código do link: o mesmo id que o servidor usa, para o histórico reconhecer o post.
  return post ? toPostInfo(post, `https://www.instagram.com/p/${post.code}/`, post.code) : null;
}

const threadsPosts = new Map<string, CapturedPost>();

/** Mesmo cache para a aba Threads: separado, porque os códigos não identificam o site de origem. */
export function rememberThreadsPost(post: CapturedPost) {
  threadsPosts.delete(post.code);
  threadsPosts.set(post.code, post);
  if (threadsPosts.size > MAX) threadsPosts.delete(threadsPosts.keys().next().value!);
}

export function cachedThreadsPost(url: string | null | undefined): PostInfo | null {
  const code = threadsCode(url);
  const post = code ? threadsPosts.get(code) : undefined;
  if (!post) return null;
  const link = post.username ? `${THREADS_HOME}@${post.username}/post/${post.code}` : `${THREADS_HOME}t/${post.code}`;
  return toPostInfo(post, link, `threads-${post.code}`);
}

const tiktokPosts = new Map<string, CapturedPost>();

export function rememberTikTokPost(post: CapturedPost) {
  tiktokPosts.delete(post.code);
  tiktokPosts.set(post.code, post);
  if (tiktokPosts.size > MAX) tiktokPosts.delete(tiktokPosts.keys().next().value!);
}

export function cachedTikTokPost(url: string | null | undefined): PostInfo | null {
  const id = tiktokId(url);
  const post = id ? tiktokPosts.get(id) : undefined;
  if (!post) return null;
  return { ...toPostInfo(post, `${TIKTOK_HOME}@${post.username}/video/${post.code}`, `tiktok-${post.code}`), kind: 'tiktok' };
}

const twitterPosts = new Map<string, CapturedPost>();

export function rememberTwitterPost(post: CapturedPost) {
  twitterPosts.delete(post.code);
  twitterPosts.set(post.code, post);
  if (twitterPosts.size > MAX) twitterPosts.delete(twitterPosts.keys().next().value!);
}

export function cachedTwitterPost(url: string | null | undefined): PostInfo | null {
  const id = tweetId(url);
  const post = id ? twitterPosts.get(id) : undefined;
  if (!post) return null;
  const link = post.username ? `${TWITTER_HOME}${post.username}/status/${post.code}` : `${TWITTER_HOME}i/status/${post.code}`;
  return toPostInfo(post, link, `twitter-${post.code}`);
}

function toPostInfo(post: CapturedPost, url: string, id: string): PostInfo {
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
    url,
    id,
    title: post.caption || 'Post',
    caption: post.caption ?? '',
    author: post.fullName || post.username || null,
    username: post.username ?? null,
    items,
  };
}
