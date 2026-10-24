import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { SelectItemsModal } from '@/components/select-items-modal';
import { extractInstagramUrl, fetchInfo, type MediaItem, type PostInfo } from '@/lib/api';
import { entryKey, startDownload, useDownloadStates } from '@/lib/downloader';
import { getEntry, useHistory } from '@/lib/history';
import { INSTAGRAM_HOME, OBSERVER_SCRIPT, parseWebMessage } from '@/lib/instagram-web';
import { recordPost } from '@/lib/profiles';
import { captureSession, getSession, loginAvailable } from '@/lib/session';
import { useTheme } from '@/lib/theme';

type Grab = { url: string; status: 'loading' | 'ready' | 'error'; post?: PostInfo; message?: string };

export default function BrowserScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const webview = useRef<WebView<object>>(null);
  const history = useHistory();
  const downloads = useDownloadStates();
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  // Post aberto na WebView no momento (detectado pela URL).
  const [current, setCurrent] = useState<string | null>(null);
  const [grab, setGrab] = useState<Grab | null>(null);
  const [selecting, setSelecting] = useState(false);

  // Botão voltar do Android navega dentro da WebView enquanto houver histórico.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!canGoBack) return false;
        webview.current?.goBack();
        return true;
      });
      return () => sub.remove();
    }, [canGoBack]),
  );

  function onUrl(url: string) {
    const post = extractInstagramUrl(url);
    setCurrent(post);
    if (post !== grab?.url) setGrab(null);
  }

  function onNavigation(nav: WebViewNavigation) {
    setCanGoBack(nav.canGoBack);
    onUrl(nav.url);
    // Login feito por aqui também vale para o resto do app.
    if (loginAvailable && !getSession()) captureSession().catch(() => {});
  }

  /** Busca o post e baixa: mídia única vai direto; carrossel abre a escolha. */
  async function download(url: string) {
    setGrab({ url, status: 'loading' });
    try {
      const post = await fetchInfo(url);
      recordPost(post);
      setGrab({ url, status: 'ready', post });
      const [first] = post.items;
      if (post.items.length > 1) setSelecting(true);
      else if (first && !getEntry(entryKey(post, first))) startDownload(post, first);
    } catch (e) {
      setGrab({ url, status: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }

  function downloadSelected(items: MediaItem[]) {
    if (grab?.post) items.forEach((item) => startDownload(grab.post!, item));
  }

  const target = grab?.url ?? current;
  const post = grab?.post;
  const downloaded = new Set(
    post ? post.items.filter((i) => history.some((h) => h.key === entryKey(post, i))).map((i) => i.index) : [],
  );
  const active = post?.items.map((i) => downloads[entryKey(post, i)]).filter((s) => s?.status === 'downloading') ?? [];
  const progress = active.length
    ? active.reduce((sum, s) => sum + (s?.status === 'downloading' && s.totalBytes ? s.bytesWritten / s.totalBytes : 0), 0) /
      active.length
    : null;

  let label = 'Baixar este post';
  let icon: 'download-outline' | 'checkmark-circle' | 'alert-circle' | 'checkbox-outline' = 'download-outline';
  if (grab?.status === 'loading') label = 'Buscando…';
  else if (grab?.status === 'error') {
    label = 'Erro — tocar para tentar de novo';
    icon = 'alert-circle';
  } else if (active.length) label = progress ? `Baixando… ${Math.round(progress * 100)}%` : 'Baixando…';
  else if (post && post.items.length > 1) {
    label = `Escolher itens (${post.items.length})`;
    icon = 'checkbox-outline';
  } else if (post && downloaded.size) {
    label = 'Baixado — abrir';
    icon = 'checkmark-circle';
  }

  function onPill() {
    if (!target) return;
    if (post && post.items.length > 1 && grab?.status === 'ready') return setSelecting(true);
    if (post && downloaded.size && !active.length) {
      const entry = getEntry(entryKey(post, post.items[0]));
      if (entry) return router.push({ pathname: '/player/[key]', params: { key: entry.key } });
    }
    if (grab?.status !== 'loading' && !active.length) download(target);
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: t.bg }}>
      <View style={[styles.toolbar, { borderColor: t.border }]}>
        <Pressable
          onPress={() => webview.current?.goBack()}
          disabled={!canGoBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="chevron-back" size={24} color={canGoBack ? t.text : t.border} />
        </Pressable>
        <Text style={[styles.title, { color: t.text }]}>Instagram</Text>
        <Pressable
          onPress={() => webview.current?.reload()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Recarregar"
        >
          <Ionicons name="refresh" size={22} color={t.text} />
        </Pressable>
      </View>

      <WebView
        ref={webview}
        source={{ uri: INSTAGRAM_HOME }}
        sharedCookiesEnabled
        allowsBackForwardNavigationGestures
        injectedJavaScriptBeforeContentLoaded={OBSERVER_SCRIPT}
        onNavigationStateChange={onNavigation}
        onLoadEnd={() => setLoading(false)}
        onMessage={({ nativeEvent }) => {
          const msg = parseWebMessage(nativeEvent.data);
          if (msg?.type === 'url') onUrl(msg.value);
          // "Copiar link" dentro do site: baixa na hora, sem passar pela área de transferência.
          if (msg?.type === 'copy') {
            const url = extractInstagramUrl(msg.value);
            if (url) download(url);
          }
        }}
        style={{ flex: 1 }}
      />

      {loading ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <ActivityIndicator color={t.accent} />
        </View>
      ) : null}

      {target ? (
        <Pressable
          onPress={onPill}
          style={({ pressed }) => [
            styles.pill,
            { backgroundColor: grab?.status === 'error' ? t.danger : t.accent, opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          {grab?.status === 'loading' || active.length ? (
            <ActivityIndicator color={t.accentText} />
          ) : (
            <Ionicons name={icon} size={20} color={t.accentText} />
          )}
          <Text style={[styles.pillText, { color: t.accentText }]} numberOfLines={1}>
            {label}
          </Text>
        </Pressable>
      ) : null}

      {post ? (
        <SelectItemsModal
          visible={selecting}
          items={post.items}
          downloaded={downloaded}
          onClose={() => setSelecting(false)}
          onConfirm={downloadSelected}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 16, fontWeight: '700' },
  center: { alignItems: 'center', justifyContent: 'center' },
  pill: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    maxWidth: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    minHeight: 48,
    borderRadius: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  pillText: { fontSize: 15, fontWeight: '600' },
});
