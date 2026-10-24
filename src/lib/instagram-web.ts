import type { ProfileInfo } from './api';

export const INSTAGRAM_HOME = 'https://www.instagram.com/';
// App ID público usado pelo próprio site do Instagram nas chamadas à API web.
export const IG_APP_ID = '936619743392459';

export type WebMessage =
  | { type: 'url'; value: string }
  | { type: 'copy'; value: string }
  | { type: 'profile'; id: string; status: number; body: string }
  | { type: 'profile-error'; id: string; error: string };

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
    .then(function (r) { return r.text().then(function (body) { send({ type: 'profile', id: ${JSON.stringify(id)}, status: r.status, body: body }); }); })
    .catch(function (e) { send({ type: 'profile-error', id: ${JSON.stringify(id)}, error: String(e) }); });
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
