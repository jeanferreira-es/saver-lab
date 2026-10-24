import type { MediaItem, PostInfo, ProfileInfo } from './api';

export const INSTAGRAM_HOME = 'https://www.instagram.com/';
// App ID público usado pelo próprio site do Instagram nas chamadas à API web.
export const IG_APP_ID = '936619743392459';

export type WebMessage =
  | { type: 'url'; value: string }
  | { type: 'copy'; value: string }
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
 * troca de página sem recarregar) e quando algo é copiado ("Copiar link").
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

/**
 * Busca os stories pela própria página do Instagram, com a sessão do usuário.
 * Para stories de um perfil, descobre antes o id numérico do usuário.
 */
export function storiesFetchScript(id: string, reel: StoryReel) {
  return `
(function () {
  function send(msg) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  function get(path) {
    return fetch(path, { credentials: 'include', headers: { 'X-IG-App-ID': '${IG_APP_ID}' } });
  }
  var reel = ${JSON.stringify(reel)};
  var reelId = reel.highlightId
    ? Promise.resolve('highlight:' + reel.highlightId)
    : get('/api/v1/users/web_profile_info/?username=' + encodeURIComponent(reel.username))
        .then(function (r) {
          if (!r.ok) throw new Error(r.status === 404 ? 'Perfil não encontrado.' : 'HTTP ' + r.status + ' ao buscar o perfil.');
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

type RawStoryItem = {
  pk: string | number;
  video_versions?: { url: string }[];
  image_versions2?: { candidates?: { url: string }[] };
  video_duration?: number;
  original_width?: number;
  original_height?: number;
};

type RawReel = { id?: string | number; user?: { username?: string; full_name?: string }; items?: RawStoryItem[] };

/** Converte a resposta de `reels_media` num "post" com um item por story. */
export function parseStories(body: string, target: StoryTarget): PostInfo | null {
  let reel: RawReel | undefined;
  try {
    const json = JSON.parse(body);
    reel = json?.reels_media?.[0] ?? Object.values(json?.reels ?? {})[0];
  } catch {
    return null;
  }
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
