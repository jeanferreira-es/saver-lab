import { SiteBrowser, type Site } from '@/components/site-browser';
import { cachedTwitterPost, rememberTwitterPost } from '@/lib/post-cache';
import { extractTwitterUrl, TWITTER_HOME, TWITTER_OBSERVER_SCRIPT, tweetId } from '@/lib/twitter-web';

const TWITTER: Site = {
  home: TWITTER_HOME,
  observerScript: TWITTER_OBSERVER_SCRIPT,
  idleLabel: 'Baixar este post',
  noMedia: 'Não encontrei foto ou vídeo neste post. Ele pode exigir login, ser protegido ou ter sido removido.',
  extractUrl: extractTwitterUrl,
  code: tweetId,
  cachedPost: cachedTwitterPost,
  rememberPost: rememberTwitterPost,
  // "Abrir no app" do site: o esquema `twitter://` já é barrado; estes são os caminhos por https.
  blockedUrl: /^https:\/\/(apps\.apple\.com|play\.google\.com|[\w-]+\.onelink\.me)/i,
};

export default function TwitterScreen() {
  return <SiteBrowser site={TWITTER} />;
}
