import type { MediaItem, PostInfo } from './api';

export const INSTAGRAM_HOME = 'https://www.instagram.com/';
// App ID público usado pelo próprio site do Instagram nas chamadas à API web.
export const IG_APP_ID = '936619743392459';

export type WebMessage =
  | { type: 'url'; value: string }
  | { type: 'copy'; value: string }
  | { type: 'visible'; value: string | null }
  | { type: 'user-ids'; value: Record<string, string> }
  | { type: 'reel'; value: { key: string; reel: RawReel } }
  | { type: 'post'; value: CapturedPost }
  | { type: 'response'; id: string; status: number; body: string }
  | { type: 'response-error'; id: string; error: string };

export function parseWebMessage(data: string): WebMessage | null {
  try {
    return JSON.parse(data) as WebMessage;
  } catch {
    return null;
  }
}

/**
 * Injetado antes da página carregar. Avisa o app quando a rota muda (o site
 * troca de página sem recarregar), quando algo é copiado ("Copiar link"), qual
 * post do feed está na tela (para baixar sem precisar copiar o link) e
 * quais ids de usuário e stories apareceram nos dados que o próprio site
 * carregou. O story na tela já veio com a sessão do usuário: reaproveitá-lo
 * evita consultas extras (que o Instagram limita ou recusa).
 */
export const OBSERVER_SCRIPT = `
(function () {
  if (window.__saverLab) return;
  window.__saverLab = true;
  function send(type, value) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, value: value }));
  }
  var last = '';
  function report() {
    if (location.href !== last) { last = location.href; send('url', location.href); }
  }
  ['pushState', 'replaceState'].forEach(function (name) {
    var original = history[name];
    history[name] = function () { var r = original.apply(this, arguments); report(); return r; };
  });
  window.addEventListener('popstate', report);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    var write = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = function (text) {
      send('copy', String(text));
      return write(text).catch(function () {});
    };
  }
  document.addEventListener('copy', function () {
    var el = document.activeElement;
    var text = el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')
      ? el.value.substring(el.selectionStart, el.selectionEnd)
      : String(window.getSelection() || '');
    if (text) send('copy', text);
  });

  function isStory(i) {
    return i && typeof i === 'object' && (i.video_versions || i.image_versions2) &&
      (i.product_type === 'story' || i.expiring_at != null);
  }
  // Post do feed (ou aberto): manda as URLs das mídias para baixar direto, sem o servidor.
  function postItem(m) {
    var video = m.video_versions && m.video_versions[0];
    var image = m.image_versions2 && m.image_versions2.candidates && m.image_versions2.candidates[0];
    // Vídeo sem a URL do arquivo (só streaming): fica para o servidor.
    if ((m.media_type === 2 && !video) || (!video && !image)) return null;
    return {
      pk: String(m.pk != null ? m.pk : m.id),
      video: video ? video.url : undefined,
      image: image ? image.url : undefined,
      duration: m.video_duration,
      width: m.original_width,
      height: m.original_height
    };
  }
  var postsSent = {};
  function capturePost(v) {
    var children = v.carousel_media && v.carousel_media.length ? v.carousel_media : [v];
    var items = [];
    for (var i = 0; i < children.length; i++) {
      var item = postItem(children[i]);
      // Post incompleto: melhor o servidor do que baixar só parte do carrossel.
      if (!item) return;
      items.push(item);
    }
    var signature = items.length + ':' + (items[0].video || items[0].image);
    if (postsSent[v.code] === signature) return;
    postsSent[v.code] = signature;
    var user = v.user || v.owner || {};
    send('post', {
      code: v.code,
      username: user.username,
      fullName: user.full_name,
      caption: v.caption && v.caption.text ? String(v.caption.text).slice(0, 300) : '',
      items: items
    });
  }

  var reelsSent = {};
  // Conjunto de stories (de um perfil ou destaque): manda ao app só o necessário para baixar.
  function captureReel(v) {
    var id = v.id != null ? String(v.id) : '';
    var user = v.user || {};
    var key = id.indexOf('highlight:') === 0 ? id : user.username ? String(user.username).toLowerCase() : null;
    if (!key) return;
    var items = [];
    for (var i = 0; i < v.items.length; i++) {
      var it = v.items[i];
      if (!isStory(it)) continue;
      var video = it.video_versions && it.video_versions[0];
      var image = it.image_versions2 && it.image_versions2.candidates && it.image_versions2.candidates[0];
      items.push({
        pk: String(it.pk != null ? it.pk : String(it.id).split('_')[0]),
        video_versions: video ? [{ url: video.url }] : undefined,
        image_versions2: image ? { candidates: [{ url: image.url }] } : undefined,
        video_duration: it.video_duration,
        original_width: it.original_width,
        original_height: it.original_height,
        taken_at: it.taken_at
      });
    }
    var signature = items.map(function (x) { return x.pk; }).join(',');
    if (!items.length || reelsSent[key] === signature) return;
    reelsSent[key] = signature;
    send('reel', { key: key, reel: { id: id || undefined, user: { username: user.username, full_name: user.full_name }, items: items } });
  }

  var known = {};
  var found = null;
  function collect(v, depth) {
    if (!v || typeof v !== 'object' || depth > 60) return;
    if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) collect(v[i], depth + 1); return; }
    var id = v.pk != null ? v.pk : v.id;
    if (typeof v.username === 'string' && id != null && /^[0-9]+$/.test(String(id)) && known[v.username] !== String(id)) {
      known[v.username] = String(id);
      if (!found) { found = {}; setTimeout(function () { send('user-ids', found); found = null; }, 1000); }
      found[v.username] = String(id);
    }
    if (Array.isArray(v.items) && v.items.some(isStory)) captureReel(v);
    if (typeof v.code === 'string' && !v.carousel_parent_id && !isStory(v) &&
        (v.carousel_media || v.video_versions || v.image_versions2)) capturePost(v);
    for (var k in v) if (v[k] && typeof v[k] === 'object') collect(v[k], depth + 1);
  }
  function inspect(text) {
    if (typeof text !== 'string' || text.indexOf('"username"') < 0) return;
    // Algumas respostas vêm em várias linhas de JSON.
    text.split('\\n').forEach(function (line) { try { collect(JSON.parse(line), 0); } catch (e) {} });
  }
  var originalFetch = window.fetch;
  window.fetch = function () {
    return originalFetch.apply(this, arguments).then(function (r) {
      try { r.clone().text().then(inspect, function () {}); } catch (e) {}
      return r;
    });
  };
  var originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', function () {
      try {
        if (this.responseType === 'json') collect(this.response, 0);
        else if (!this.responseType || this.responseType === 'text') inspect(this.responseText);
      } catch (e) {}
    });
    return originalSend.apply(this, arguments);
  };
  // Post do feed mais visível na tela: cada post é um <article> com o link dele.
  var POST_TYPES = { p: 'p', reel: 'reel', reels: 'reel', tv: 'tv' };
  function postLink(article) {
    var links = article.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var parts = links[i].pathname.split('/').filter(Boolean);
      for (var j = 0; j < parts.length - 1; j++) {
        if (POST_TYPES[parts[j]] && parts[j + 1] !== 'audio') {
          return location.origin + '/' + POST_TYPES[parts[j]] + '/' + parts[j + 1] + '/';
        }
      }
    }
    return null;
  }
  var visible;
  function findVisible() {
    var articles = document.querySelectorAll('article');
    var height = window.innerHeight;
    var best = null;
    var bestArea = 0;
    for (var i = 0; i < articles.length; i++) {
      var r = articles[i].getBoundingClientRect();
      var area = Math.min(r.bottom, height) - Math.max(r.top, 0);
      if (area > bestArea) { bestArea = area; best = articles[i]; }
    }
    // Só conta se o post ocupar uma parte razoável da tela.
    var link = best && bestArea > height * 0.25 ? postLink(best) : null;
    if (link !== visible) { visible = link; send('visible', link); }
  }
  var scheduled = false;
  function scheduleVisible() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () { scheduled = false; findVisible(); }, 200);
  }
  // "true": pega também a rolagem de elementos internos, não só a da página.
  window.addEventListener('scroll', scheduleVisible, true);
  // Posts que aparecem sem rolagem (feed carregando, troca de página).
  setInterval(findVisible, 1500);

  // Dados que já vêm embutidos no HTML da página.
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('script[type="application/json"]').forEach(function (s) { inspect(s.textContent); });
  });

  report();
})();
true;
`;

export type StoryReel = { username: string } | { highlightId: string };

export type StoryTarget = {
  /** URL canônica do conjunto de stories (sem o id do story), usada como chave. */
  url: string;
  reel: StoryReel;
  /** Story aberto no momento, quando a URL informa. */
  mediaId: string | null;
};

const STORY_URL = /https:\/\/(?:www\.)?instagram\.com\/stories\/(?:highlights\/(\d+)|([\w.]+))(?:\/(\d+))?/i;

// Destaque compartilhado pelo app oficial: `/s/<base64 de "highlight:<id>">?story_media_id=<id>_<usuário>`.
const SHARED_HIGHLIGHT = /https:\/\/(?:www\.)?instagram\.com\/s\/([\w=-]+)\/?(\?\S*)?/i;

function sharedHighlight(text: string): StoryTarget | null {
  const m = text.match(SHARED_HIGHLIGHT);
  if (!m) return null;
  let decoded: string;
  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    decoded = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  } catch {
    return null;
  }
  const highlightId = decoded.match(/^highlight:(\d+)$/)?.[1];
  if (!highlightId) return null;
  const mediaId = m[2]?.match(/story_media_id=(\d+)/)?.[1] ?? null;
  return { url: `${INSTAGRAM_HOME}stories/highlights/${highlightId}/`, reel: { highlightId }, mediaId };
}

/** Reconhece `/stories/<usuário>/<id>/`, `/stories/highlights/<id>/` e destaques compartilhados (`/s/...`). */
export function parseStoryUrl(text: string | null | undefined): StoryTarget | null {
  if (!text) return null;
  const m = text.match(STORY_URL);
  if (!m) return sharedHighlight(text);
  const [, highlightId, username, mediaId] = m;
  return highlightId
    ? { url: `${INSTAGRAM_HOME}stories/highlights/${highlightId}/`, reel: { highlightId }, mediaId: mediaId ?? null }
    : { url: `${INSTAGRAM_HOME}stories/${username}/`, reel: { username }, mediaId: mediaId ?? null };
}

export const RATE_LIMITED = 'O Instagram limitou as consultas por agora (HTTP 429). Aguarde alguns minutos e tente de novo.';

/** Página do site que abre o story: o do link, quando ele informa qual é. */
export function storyPageUrl(target: StoryTarget) {
  return 'username' in target.reel && target.mediaId ? `${target.url}${target.mediaId}/` : target.url;
}

/**
 * Busca os stories pela própria página do Instagram, com a sessão do usuário.
 * Para stories de um perfil, usa o id já conhecido ou descobre antes pelo perfil.
 */
export function storiesFetchScript(id: string, reel: StoryReel, knownUserId: string | null) {
  return `
(function () {
  function send(msg) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  // Mesmos cabeçalhos que o site manda nas chamadas à API web.
  var csrf = (document.cookie.match(/(?:^|; )csrftoken=([^;]+)/) || [])[1];
  var headers = { 'X-IG-App-ID': '${IG_APP_ID}', 'X-Requested-With': 'XMLHttpRequest', 'X-IG-WWW-Claim': '0' };
  if (csrf) headers['X-CSRFToken'] = csrf;
  function get(path) {
    return fetch(path, { credentials: 'include', headers: headers });
  }
  var reel = ${JSON.stringify(reel)};
  var knownUserId = ${JSON.stringify(knownUserId)};
  var reelId = reel.highlightId
    ? Promise.resolve('highlight:' + reel.highlightId)
    : knownUserId
    ? Promise.resolve(knownUserId)
    : get('/api/v1/users/web_profile_info/?username=' + encodeURIComponent(reel.username))
        .then(function (r) {
          if (r.status === 404) throw new Error('Perfil não encontrado.');
          if (r.status === 429) throw new Error('${RATE_LIMITED}');
          if (!r.ok) throw new Error('HTTP ' + r.status + ' ao buscar o perfil.');
          return r.json();
        })
        .then(function (j) { return j.data.user.id; });
  reelId
    .then(function (rid) { return get('/api/v1/feed/reels_media/?reel_ids=' + encodeURIComponent(rid)); })
    .then(function (r) { return r.text().then(function (body) { send({ type: 'response', id: ${JSON.stringify(id)}, status: r.status, body: body }); }); })
    .catch(function (e) { send({ type: 'response-error', id: ${JSON.stringify(id)}, error: e && e.message ? e.message : String(e) }); });
})();
true;
`;
}

export type RawStoryItem = {
  pk: string | number;
  video_versions?: { url: string }[];
  image_versions2?: { candidates?: { url: string }[] };
  video_duration?: number;
  original_width?: number;
  original_height?: number;
  taken_at?: number;
};

/** Post como o script injetado o captura dos dados do site (ver `capturePost`). */
export type CapturedPost = {
  code: string;
  username?: string;
  fullName?: string;
  caption?: string;
  items: { pk: string; video?: string; image?: string; duration?: number; width?: number; height?: number }[];
};

export type RawReel = { id?: string | number; user?: { username?: string; full_name?: string }; items?: RawStoryItem[] };

/** Chave de um conjunto de stories: o usuário, ou `highlight:<id>` para destaques. */
export function reelKey(reel: StoryReel) {
  return 'highlightId' in reel ? `highlight:${reel.highlightId}` : reel.username.toLowerCase();
}

/** Converte a resposta de `reels_media` num "post" com um item por story. */
export function parseStories(body: string, target: StoryTarget): PostInfo | null {
  try {
    const json = JSON.parse(body);
    return storyPost(json?.reels_media?.[0] ?? Object.values(json?.reels ?? {})[0], target);
  } catch {
    return null;
  }
}

/** Monta o "post" de um conjunto de stories, venha da API ou dos dados que o site já carregou. */
export function storyPost(reel: RawReel | undefined, target: StoryTarget): PostInfo | null {
  const items: MediaItem[] = [];
  for (const raw of reel?.items ?? []) {
    // A primeira versão/candidata é a de maior resolução.
    const video = raw.video_versions?.[0]?.url;
    const image = raw.image_versions2?.candidates?.[0]?.url;
    if (!video && !image) continue;
    items.push({
      index: items.length + 1,
      id: String(raw.pk),
      type: video ? 'video' : 'image',
      ext: video ? 'mp4' : 'jpg',
      duration: raw.video_duration ?? null,
      width: raw.original_width ?? null,
      height: raw.original_height ?? null,
      thumbnail: image ?? null,
      src: video ?? image,
    });
  }
  if (!reel || !items.length) return null;
  const username = reel.user?.username ?? ('username' in target.reel ? target.reel.username : null);
  return {
    kind: 'story',
    url: target.url,
    id: `story-${reel.id ?? target.url}`,
    title: 'highlightId' in target.reel ? 'Destaque' : 'Story',
    caption: '',
    author: reel.user?.full_name || username,
    username,
    items,
  };
}
