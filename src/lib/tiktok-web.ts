import { observerScript } from './instagram-web';
import { webViewCookie } from './session';

export const TIKTOK_HOME = 'https://www.tiktok.com/';

const TIKTOK_POST = /https:\/\/(?:www\.|m\.)?tiktok\.com\/@([\w.-]+)\/(video|photo)\/(\d+)/i;
// Link gerado pelo botão de compartilhar: só revela o vídeo ao redirecionar.
const TIKTOK_SHORT = /https:\/\/(?:(?:vm|vt)\.tiktok\.com|(?:www\.|m\.)?tiktok\.com\/t)\/[\w-]+/i;

/** Extrai o primeiro link de vídeo ou foto do TikTok de um texto, sem parâmetros. */
export function extractTikTokUrl(text: string | null | undefined): string | null {
  const m = text?.match(TIKTOK_POST);
  if (m) return `${TIKTOK_HOME}@${m[1]}/${m[2].toLowerCase()}/${m[3]}`;
  return text?.match(TIKTOK_SHORT)?.[0] ?? null;
}

/** Id do vídeo no link; null em link curto. O usuário no link pode estar desatualizado: o id não. */
export function tiktokId(text: string | null | undefined): string | null {
  return text?.match(TIKTOK_POST)?.[3] ?? null;
}

/**
 * A CDN responde 403 sem o `Referer` e o cookie `tt_chain_token` da sessão que recebeu a URL.
 * O cookie é HttpOnly (a página não o enxerga) e só vai para os domínios do próprio TikTok.
 */
export async function tiktokHeaders(url: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Referer: TIKTOK_HOME };
  if (/^https:\/\/([\w-]+\.)*tiktok\.com\//i.test(url)) {
    const token = await webViewCookie(TIKTOK_HOME, 'tt_chain_token');
    if (token) headers.Cookie = `tt_chain_token=${token}`;
  }
  return headers;
}

/** Os links de um vídeo ficam na capa e no autor; vale o último que já passou do meio da tela. */
const TIKTOK_VISIBLE_LINK = `
  function visibleLink() {
    var links = document.querySelectorAll('a[href*="/video/"], a[href*="/photo/"]');
    var height = window.innerHeight;
    var middle = height / 2;
    var above = null;
    var aboveTop = -Infinity;
    var below = null;
    var belowTop = Infinity;
    for (var i = 0; i < links.length; i++) {
      var parts = links[i].pathname.split('/').filter(Boolean);
      if (parts.length < 3 || parts[0].charAt(0) !== '@' || (parts[1] !== 'video' && parts[1] !== 'photo')) continue;
      var r = links[i].getBoundingClientRect();
      if (!r.height) continue;
      var link = location.origin + '/' + parts[0] + '/' + parts[1] + '/' + parts[2];
      if (r.top <= middle) {
        if (r.top > aboveTop) { aboveTop = r.top; above = link; }
      } else if (r.top < height && r.top < belowTop) {
        belowTop = r.top;
        below = link;
      }
    }
    return above || below;
  }
`;

/**
 * Item de vídeo do TikTok: `{ id, desc, author: { uniqueId }, video: { playAddr }, imagePost }`.
 * Vem em `<script id="api-data">` ao abrir um vídeo e nas respostas de `item_list` no feed.
 */
const TIKTOK_CAPTURE = `
  function captureSite(v) {
    if (typeof v.id !== 'string' || !v.author || typeof v.author.uniqueId !== 'string') return;
    var items = [];
    var images = v.imagePost && v.imagePost.images;
    if (images && images.length) {
      for (var i = 0; i < images.length; i++) {
        var image = images[i].imageURL && images[i].imageURL.urlList && images[i].imageURL.urlList[0];
        if (!image) return;
        items.push({ pk: v.id + '-' + i, image: image, width: images[i].imageWidth, height: images[i].imageHeight });
      }
    } else {
      var video = v.video || {};
      var url = video.playAddr || video.downloadAddr;
      if (!url) return;
      items.push({ pk: v.id, video: url, image: video.cover, duration: video.duration, width: video.width, height: video.height });
    }
    var signature = items.length + ':' + (items[0].video || items[0].image);
    if (postsSent[v.id] === signature) return;
    postsSent[v.id] = signature;
    send('post', {
      code: v.id,
      username: v.author.uniqueId,
      fullName: v.author.nickname,
      caption: v.desc ? String(v.desc).slice(0, 300) : '',
      items: items
    });
  }
`;

export const TIKTOK_OBSERVER_SCRIPT = observerScript(TIKTOK_VISIBLE_LINK, { marker: '"uniqueId"', capture: TIKTOK_CAPTURE });
