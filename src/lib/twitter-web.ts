import { observerScript } from './instagram-web';

export const TWITTER_HOME = 'https://x.com/';

// `twitter.com` é o domínio antigo; o link pode ter `/photo/1`, `/video/1` e parâmetros (`?s=20`).
// Sem usuário no caminho, o site usa `/i/status/<id>` (ou `/i/web/status/<id>`).
const TWITTER_URL =
  /https:\/\/(?:(?:www|mobile)\.)?(?:x|twitter)\.com\/(?:i\/(?:web\/)?|(\w{1,15})\/)status(?:es)?\/(\d+)/i;

/** Extrai o primeiro link de tweet do X/Twitter de um texto, no formato padrão (x.com, sem parâmetros). */
export function extractTwitterUrl(text: string | null | undefined): string | null {
  const m = text?.match(TWITTER_URL);
  if (!m) return null;
  const [, user, id] = m;
  return user ? `${TWITTER_HOME}${user}/status/${id}` : `${TWITTER_HOME}i/status/${id}`;
}

/** Id do tweet no link. O usuário no link pode estar desatualizado (troca de @): o id não. */
export function tweetId(text: string | null | undefined): string | null {
  return text?.match(TWITTER_URL)?.[2] ?? null;
}

/**
 * Cada tweet é um <article> cujo link permanente envolve o horário (<time>). Vale o último
 * tweet que já passou do meio da tela; no topo da página, o primeiro que estiver visível.
 */
const TWITTER_VISIBLE_LINK = `
  function tweetLink(article) {
    var time = article.querySelector('a[href*="/status/"] time');
    var a = time && time.closest('a');
    if (!a) return null;
    var parts = a.pathname.split('/').filter(Boolean);
    var i = parts.indexOf('status');
    if (i < 1 || !/^[0-9]+$/.test(parts[i + 1] || '')) return null;
    return location.origin + '/' + parts[i - 1] + '/status/' + parts[i + 1];
  }
  function visibleLink() {
    var articles = document.querySelectorAll('article');
    var height = window.innerHeight;
    var middle = height / 2;
    var above = null;
    var aboveTop = -Infinity;
    var below = null;
    var belowTop = Infinity;
    for (var i = 0; i < articles.length; i++) {
      var r = articles[i].getBoundingClientRect();
      if (!r.height || r.bottom <= 0) continue;
      var link = tweetLink(articles[i]);
      if (!link) continue;
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
 * Tweet nas respostas GraphQL do site: `{ rest_id, core: { user_results }, legacy: { full_text,
 * extended_entities: { media } } }`. Retweets e tweets citados vêm aninhados e são achados pela
 * própria varredura. Vídeos e GIFs têm vários arquivos MP4: vale o de maior taxa de bits.
 */
const TWITTER_CAPTURE = `
  function captureSite(v) {
    var legacy = v.legacy;
    if (typeof v.rest_id !== 'string' || !legacy || typeof legacy !== 'object') return;
    var media = (legacy.extended_entities && legacy.extended_entities.media) || [];
    if (!media.length) return;
    var items = [];
    for (var i = 0; i < media.length; i++) {
      var m = media[i];
      var info = m.original_info || {};
      if (m.type === 'photo') {
        var image = m.media_url_https;
        if (!image) return;
        // "orig": a foto no tamanho enviado, não a versão reduzida da linha do tempo.
        items.push({ pk: String(m.id_str || v.rest_id + '-' + i), image: image + (image.indexOf('?') < 0 ? '?name=orig' : ''), width: info.width, height: info.height });
      } else {
        var variants = (m.video_info && m.video_info.variants) || [];
        var best = null;
        for (var j = 0; j < variants.length; j++) {
          if (variants[j].content_type !== 'video/mp4' || !variants[j].url) continue;
          if (!best || (variants[j].bitrate || 0) > (best.bitrate || 0)) best = variants[j];
        }
        // Só streaming (HLS): sem arquivo para baixar, melhor não oferecer o post pela metade.
        if (!best) return;
        var millis = m.video_info.duration_millis;
        items.push({ pk: String(m.id_str || v.rest_id + '-' + i), video: best.url, image: m.media_url_https, duration: millis ? millis / 1000 : undefined, width: info.width, height: info.height });
      }
    }
    var signature = items.length + ':' + (items[0].video || items[0].image);
    if (postsSent[v.rest_id] === signature) return;
    postsSent[v.rest_id] = signature;
    var user = (v.core && v.core.user_results && v.core.user_results.result) || {};
    // O @ e o nome mudaram de lugar no formato novo da API; o antigo ainda aparece em algumas respostas.
    var names = user.core || user.legacy || {};
    var text = (v.note_tweet && v.note_tweet.note_tweet_results && v.note_tweet.note_tweet_results.result &&
      v.note_tweet.note_tweet_results.result.text) || legacy.full_text || '';
    send('post', {
      code: v.rest_id,
      username: names.screen_name || (user.legacy && user.legacy.screen_name),
      fullName: names.name || (user.legacy && user.legacy.name),
      // Sem o link "https://t.co/..." da mídia, que o site põe no fim do texto.
      caption: String(text).replace(/\\s*https:\\/\\/t\\.co\\/\\w+\\s*$/, '').slice(0, 300),
      items: items
    });
  }
`;

export const TWITTER_OBSERVER_SCRIPT = observerScript(TWITTER_VISIBLE_LINK, {
  marker: '"extended_entities"',
  capture: TWITTER_CAPTURE,
});
