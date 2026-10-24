import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import type { ProfileInfo } from '@/lib/api';
import { INSTAGRAM_HOME, parseProfile, parseWebMessage, profileFetchScript } from '@/lib/instagram-web';

export type InstagramBridgeHandle = {
  /** Busca o perfil pelo celular, com a sessão do usuário (sem passar pelo servidor). */
  fetchProfile(username: string): Promise<ProfileInfo>;
};

const TIMEOUT_MS = 20_000;

type Pending = { resolve: (p: ProfileInfo) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };

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

  useImperativeHandle(ref, () => ({
    async fetchProfile(username) {
      await ready.current!.promise;
      const id = `${Date.now()}-${Math.random()}`;
      return new Promise<ProfileInfo>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.current.delete(id);
          reject(new Error('O Instagram demorou para responder.'));
        }, TIMEOUT_MS);
        pending.current.set(id, { resolve, reject, timer });
        webview.current?.injectJavaScript(profileFetchScript(id, username));
      });
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
          if (msg?.type === 'profile-error') settle(msg.id, (p) => p.reject(new Error(msg.error)));
          if (msg?.type !== 'profile') return;
          settle(msg.id, (p) => {
            console.log('[bridge] perfil pelo celular: HTTP', msg.status);
            if (msg.status === 404) return p.reject(new Error('Perfil não encontrado.'));
            const profile = msg.status === 200 ? parseProfile(msg.body) : null;
            if (profile) p.resolve(profile);
            else p.reject(new Error(`O Instagram recusou a consulta pelo celular (HTTP ${msg.status}).`));
          });
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
