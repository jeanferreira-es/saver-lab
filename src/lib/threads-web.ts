import { observerScript } from './instagram-web';

export const THREADS_HOME = 'https://www.threads.com/';

// `threads.net` é o domínio antigo; os dois formatos de link identificam o post pelo código.
const THREADS_URL = /https:\/\/(?:www\.)?threads\.(?:com|net)\/(?:@([\w.]+)\/post|t)\/([\w-]+)/i;

/** Extrai o primeiro link de post do Threads de um texto, no formato padrão (sem parâmetros nem `/media`). */
export function extractThreadsUrl(text: string | null | undefined): string | null {
  const m = text?.match(THREADS_URL);
  if (!m) return null;
  const [, user, code] = m;
  return user ? `${THREADS_HOME}@${user}/post/${code}` : `${THREADS_HOME}t/${code}`;
}

export function threadsCode(text: string | null | undefined): string | null {
  return text?.match(THREADS_URL)?.[2] ?? null;
}

/**
 * Os dados dos posts têm o mesmo formato do Instagram; só a página é diferente: não há
 * <article> e cada post tem um link `/@usuário/post/<código>` no cabeçalho. O post na tela é o
 * último cujo link já passou do meio da tela, o que também funciona em posts mais altos que ela.
 * No topo de um perfil nenhum link chegou ao meio: vale o primeiro que estiver visível.
 */
const THREADS_VISIBLE_LINK = `
  function visibleLink() {
    var links = document.querySelectorAll('a[href*="/post/"]');
    var height = window.innerHeight;
    var middle = height / 2;
    var above = null;
    var aboveTop = -Infinity;
    var below = null;
    var belowTop = Infinity;
    for (var i = 0; i < links.length; i++) {
      var parts = links[i].pathname.split('/').filter(Boolean);
      if (parts.length < 3 || parts[0].charAt(0) !== '@' || parts[1] !== 'post') continue;
      var r = links[i].getBoundingClientRect();
      if (!r.height) continue;
      var link = location.origin + '/' + parts[0] + '/post/' + parts[2];
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

export const THREADS_OBSERVER_SCRIPT = observerScript(THREADS_VISIBLE_LINK);
