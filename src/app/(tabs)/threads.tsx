import { SiteBrowser, type Site } from '@/components/site-browser';
import { cachedThreadsPost, rememberThreadsPost } from '@/lib/post-cache';
import { extractThreadsUrl, THREADS_HOME, THREADS_OBSERVER_SCRIPT, threadsCode } from '@/lib/threads-web';

const THREADS: Site = {
  home: THREADS_HOME,
  observerScript: THREADS_OBSERVER_SCRIPT,
  idleLabel: 'Baixar este post',
  noMedia: 'Não encontrei foto ou vídeo neste post. Se ele tiver, espere carregar e tente de novo.',
  extractUrl: extractThreadsUrl,
  code: threadsCode,
  cachedPost: cachedThreadsPost,
  rememberPost: rememberThreadsPost,
};

export default function ThreadsScreen() {
  return <SiteBrowser site={THREADS} />;
}
