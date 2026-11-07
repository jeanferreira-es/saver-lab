import { SiteBrowser, type Site } from '@/components/site-browser';
import { cachedTikTokPost, rememberTikTokPost } from '@/lib/post-cache';
import { extractTikTokUrl, TIKTOK_HOME, TIKTOK_OBSERVER_SCRIPT, tiktokId } from '@/lib/tiktok-web';

const TIKTOK: Site = {
  home: TIKTOK_HOME,
  observerScript: TIKTOK_OBSERVER_SCRIPT,
  idleLabel: 'Baixar este vídeo',
  noMedia: 'Não encontrei este vídeo. Ele pode ser privado ou ter sido removido.',
  extractUrl: extractTikTokUrl,
  code: tiktokId,
  cachedPost: cachedTikTokPost,
  rememberPost: rememberTikTokPost,
  reloadToCapture: true,
  // "Abrir aplicativo" do site: o esquema próprio já é barrado; estes são os caminhos por https.
  blockedUrl: /^https:\/\/(apps\.apple\.com|play\.google\.com|[\w-]+\.onelink\.me|app[\w-]*\.tiktokv\.com\/redirect)/i,
};

export default function TikTokScreen() {
  return <SiteBrowser site={TIKTOK} />;
}
