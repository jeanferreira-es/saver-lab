import { reelKey, storyPost, type RawReel, type StoryTarget } from './instagram-web';

/**
 * Stories que o próprio site carregou na aba Navegar, por usuário/destaque. Só em
 * memória: as URLs da CDN expiram, e o site manda de novo ao reabrir o story.
 */
const reels = new Map<string, RawReel>();

/** Junta com o que já havia: o site pode carregar os stories de um perfil em partes. */
export function rememberReel(key: string, reel: RawReel) {
  const byPk = new Map((reels.get(key)?.items ?? []).map((i) => [String(i.pk), i]));
  for (const item of reel.items ?? []) byPk.set(String(item.pk), item);
  const items = [...byPk.values()].sort((a, b) => (a.taken_at ?? 0) - (b.taken_at ?? 0));
  reels.set(key, { ...reels.get(key), ...reel, items });
}

/** Stories já carregados pelo site; null se o story aberto (`mediaId`) não estiver entre eles. */
export function cachedStories(target: StoryTarget) {
  const reel = reels.get(reelKey(target.reel));
  if (!reel) return null;
  if (target.mediaId && !reel.items?.some((i) => String(i.pk) === target.mediaId)) return null;
  return storyPost(reel, target);
}
