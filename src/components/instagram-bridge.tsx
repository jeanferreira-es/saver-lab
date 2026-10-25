import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import type { PostInfo } from '@/lib/api';
import {
  INSTAGRAM_HOME,
  parseStories,
  parseWebMessage,
  RATE_LIMITED,
  storiesFetchScript,
  type StoryTarget,
} from '@/lib/instagram-web';
import { getUserId, rememberUserIds } from '@/lib/user-ids';

export type InstagramBridgeHandle = {
  /** Busca os stories (ou um destaque) pelo celular, com a sessão do usuário. */
  fetchStories(target: StoryTarget): Promise<PostInfo>;
};

const TIMEOUT_MS = 20_000;

/** Guarda o par usuário → id de um objeto `user` da resposta, se houver. */
function rememberUser(user: { username?: string; id?: string | number; pk?: string | number } | undefined) {
  const id = user?.pk ?? user?.id;
  if (user?.username && id != null) rememberUserIds({ [user.username]: String(id) });
}

/** Motivo que o Instagram manda no corpo do erro (ex.: "login_required"), se houver. */
function igMessage(body: string) {
  try {
    const { message } = JSON.parse(body) as { message?: string };
    return message ? `: ${message}` : '';
  } catch {
    return '';
  }
}

type Response = { status: number; body: string };
type Pending = { resolve: (r: Response) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };

/** WebView invisível aberta no domínio do Instagram, usada só para consultas. */
export const InstagramBridge = forwardRef<InstagramBridgeHandle>(function InstagramBridge(_, ref) {
  const webview = useRef<WebView<object>>(null);
  const pending = useRef(new Map<string, Pending>());
  const ready = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  if (!ready.current) {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => (resolve = r));
    ready.current = { promise, resolve };
  }

  /** Injeta o script na página e espera a resposta que ele devolve por `postMessage`. */
  async function request(script: (id: string) => string): Promise<Response> {
    await ready.current!.promise;
    const id = `${Date.now()}-${Math.random()}`;
    return new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.current.delete(id);
        reject(new Error('O Instagram demorou para responder.'));
      }, TIMEOUT_MS);
      pending.current.set(id, { resolve, reject, timer });
      webview.current?.injectJavaScript(script(id));
    });
  }

  useImperativeHandle(ref, () => ({
    async fetchStories(target) {
      const known = 'username' in target.reel ? await getUserId(target.reel.username) : null;
      const { status, body } = await request((id) => storiesFetchScript(id, target.reel, known));
      console.log('[bridge] stories pelo celular: HTTP', status, known ? '(id já conhecido)' : '', body.slice(0, 500));
      if (status === 429) throw new Error(RATE_LIMITED);
      if (status !== 200) {
        throw new Error(`O Instagram recusou a consulta dos stories (HTTP ${status}${igMessage(body)}).`);
      }
      const post = parseStories(body, target);
      if (!post) throw new Error('Nenhum story disponível — eles expiram em 24 horas.');
      try {
        const json = JSON.parse(body);
        rememberUser((json?.reels_media?.[0] ?? Object.values(json?.reels ?? {})[0])?.user);
      } catch {}
      return post;
    },
  }));

  function settle(id: string, fn: (p: Pending) => void) {
    const p = pending.current.get(id);
    if (!p) return;
    clearTimeout(p.timer);
    pending.current.delete(id);
    fn(p);
  }

  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        ref={webview}
        // Página leve do domínio do Instagram: basta para as requisições levarem os cookies da sessão.
        source={{ uri: `${INSTAGRAM_HOME}robots.txt` }}
        sharedCookiesEnabled
        onLoadEnd={() => ready.current!.resolve()}
        onMessage={({ nativeEvent }) => {
          const msg = parseWebMessage(nativeEvent.data);
          if (msg?.type === 'response-error') settle(msg.id, (p) => p.reject(new Error(msg.error)));
          if (msg?.type === 'response') settle(msg.id, (p) => p.resolve({ status: msg.status, body: msg.body }));
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
