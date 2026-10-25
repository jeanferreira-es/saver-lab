import type { MediaItem, PostInfo, ProfileInfo } from './api';

export const INSTAGRAM_HOME = 'https://www.instagram.com/';
// App ID público usado pelo próprio site do Instagram nas chamadas à API web.
export const IG_APP_ID = '936619743392459';

export type WebMessage =
  | { type: 'url'; value: string }
  | { type: 'copy'; value: string }
  | { type: 'user-ids'; value: Record<string, string> }
  | { type: 'reel'; value: { key: string; reel: RawReel } }
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
 * troca de página sem recarregar), quando algo é copiado ("Copiar link") e
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
  // Dados que já vêm embutidos no HTML da página.
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('script[type="application/json"]').forEach(function (s) { inspect(s.textContent); });
  });

  report();
})();
true;
`;

/** Consulta o perfil pela própria página do Instagram, com a sessão do usuário. */
export function profileFetchScript(id: string, username: string) {
  return `
(function () {
  function send(msg) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  fetch('/api/v1/users/web_profile_info/?username=' + encodeURIComponent(${JSON.stringify(username)}), {
    credentials: 'include',
    headers: { 'X-IG-App-ID': '${IG_APP_ID}' }
  })
    .then(function (r) { return r.text().then(function (body) { send({ type: 'response', id: ${JSON.stringify(id)}, status: r.status, body: body }); }); })
    .catch(function (e) { send({ type: 'response-error', id: ${JSON.stringify(id)}, error: String(e) }); });
})();
true;
`;
}

type RawNode = {
  id: string;
  shortcode: string;
  product_type?: string;
  __typename?: string;
  is_video?: boolean;
  thumbnail_src?: string;
  display_url?: string;
  taken_at_timestamp?: number;
  edge_media_to_caption?: { edges?: { node?: { text?: string } }[] };
};

/** Converte a resposta de `web_profile_info` (mesmo formato tratado no servidor). */
export function parseProfile(body: string): ProfileInfo | null {
  let user;
  try {
    user = JSON.parse(body)?.data?.user;
  } catch {
    return null;
  }
  if (!user) return null;
  const edges: { node: RawNode }[] = user.edge_owner_to_timeline_media?.edges ?? [];
  return {
    username: user.username,
    fullName: user.full_name || null,
    avatar: user.profile_pic_url_hd || user.profile_pic_url || null,
    isPrivate: Boolean(user.is_private),
    posts: edges.map(({ node }) => ({
      id: node.id,
      url: `https://www.instagram.com/${node.product_type === 'clips' ? 'reel' : 'p'}/${node.shortcode}/`,
      type: node.__typename === 'GraphSidecar' ? 'carousel' : node.is_video ? 'video' : 'image',
      thumbnail: node.thumbnail_src || node.display_url || null,
      caption: (node.edge_media_to_caption?.edges?.[0]?.node?.text ?? '').slice(0, 300),
      takenAt: node.taken_at_timestamp ? node.taken_at_timestamp * 1000 : null,
    })),
  };
}

export type StoryReel = { username: string } | { highlightId: string };

export type StoryTarget = {
  /** URL canônica do conjunto de stories (sem o id do story), usada como chave. */
  url: string;
  reel: StoryReel;
  /** Story aberto no momento, quando a URL informa. */
  mediaId: string | null;
};

const STORY_URL = /https:\/\/(?:www\.)?instagram\.com\/stories\/(?:highlights\/(\d+)|([\w.]+))(?:\/(\d+))?/i;

/** Reconhece `/stories/<usuário>/<id>/` e `/stories/highlights/<id>/`. */
export function parseStoryUrl(text: string | null | undefined): StoryTarget | null {
  const m = text?.match(STORY_URL);
  if (!m) return null;
  const [, highlightId, username, mediaId] = m;
  return highlightId
    ? { url: `${INSTAGRAM_HOME}stories/highlights/${highlightId}/`, reel: { highlightId }, mediaId: mediaId ?? null }
    : { url: `${INSTAGRAM_HOME}stories/${username}/`, reel: { username }, mediaId: mediaId ?? null };
}

export const RATE_LIMITED = 'O Instagram limitou as consultas por agora (HTTP 429). Aguarde alguns minutos e tente de novo.';

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
