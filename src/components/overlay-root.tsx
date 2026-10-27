import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import FloatingBubble from '../../modules/floating-bubble';
import { SelectItemsPanel } from '@/components/select-items-modal';
import { Button } from '@/components/ui';
import { fetchInfo, type MediaItem, type PostInfo } from '@/lib/api';
import { entryKey, startDownload } from '@/lib/downloader';
import { loadHistory, useHistory } from '@/lib/history';
import { cachedPost } from '@/lib/post-cache';
import { recordPost } from '@/lib/profiles';
import { getSettings } from '@/lib/settings';
import { applyThemePreference, useTheme } from '@/lib/theme';

type State = { status: 'loading' } | { status: 'ready'; post: PostInfo } | { status: 'error'; message: string };

/**
 * Escolha dos itens de um post aberta pela bolha por cima de outro app (Android).
 * O app de trás continua visível; nada do Saver Lab vem para frente.
 */
export function OverlayRoot({ url }: { url?: string }) {
  return (
    <SafeAreaProvider>
      <OverlaySheet url={url ?? ''} />
    </SafeAreaProvider>
  );
}

function close() {
  FloatingBubble?.closeOverlay();
}

function OverlaySheet({ url }: { url: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const history = useHistory();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // O app pode não ter sido aberto antes: carrega o que as telas dele carregariam.
        const [settings] = await Promise.all([getSettings(), loadHistory()]);
        applyThemePreference(settings.theme);
        // Post já visto na aba Navegar baixa direto da CDN; senão, o servidor busca.
        const post = cachedPost(url) ?? (await fetchInfo(url));
        recordPost(post);
        if (active) setState({ status: 'ready', post });
      } catch (e) {
        if (active) setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      active = false;
    };
  }, [url]);

  function confirm(post: PostInfo, items: MediaItem[]) {
    ToastAndroid.show(`Baixando ${items.length} ${items.length === 1 ? 'item' : 'itens'}…`, ToastAndroid.SHORT);
    // Os downloads seguem depois que a tela fecha (o processo continua vivo com a bolha).
    Promise.all(items.map((item) => startDownload(post, item))).then((results) => {
      const failed = results.filter((ok) => !ok).length;
      ToastAndroid.show(
        failed ? `${failed} ${failed === 1 ? 'item falhou' : 'itens falharam'}. Tente pelo Saver Lab.` : 'Download concluído',
        ToastAndroid.LONG,
      );
    });
  }

  const post = state.status === 'ready' ? state.post : null;
  const downloaded = new Set(
    post ? post.items.filter((i) => history.some((h) => h.key === entryKey(post, i))).map((i) => i.index) : [],
  );

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Fechar" />
      <View style={[styles.sheet, { backgroundColor: t.bg, paddingTop: 4 }]}>
        <View style={[styles.handle, { backgroundColor: t.border }]} />
        {post ? (
          <SelectItemsPanel
            items={post.items}
            downloaded={downloaded}
            onClose={close}
            onConfirm={(items) => confirm(post, items)}
          />
        ) : (
          <View style={[styles.status, { paddingBottom: insets.bottom + 24 }]}>
            {state.status === 'error' ? (
              <>
                <Text style={{ color: t.danger, fontSize: 15, lineHeight: 21, textAlign: 'center' }}>{state.message}</Text>
                <Button label="Fechar" variant="secondary" onPress={close} />
              </>
            ) : (
              <>
                <ActivityIndicator color={t.accent} />
                <Text style={{ color: t.muted, fontSize: 14 }}>Buscando o post…</Text>
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { maxHeight: '80%', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginTop: 6 },
  status: { alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingTop: 32 },
});
