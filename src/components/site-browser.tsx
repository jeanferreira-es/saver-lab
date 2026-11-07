import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { DownloadPill, useDownloadedItems, type Grab } from '@/components/download-pill';
import { SelectItemsModal } from '@/components/select-items-modal';
import { WebViewRefresh } from '@/components/webview-refresh';
import { entryKey, startDownload } from '@/lib/downloader';
import { getEntry } from '@/lib/history';
import type { MediaItem, PostInfo } from '@/lib/api';
import { paintBackgroundScript, parseWebMessage, type CapturedPost } from '@/lib/instagram-web';
import { useColorScheme, useTheme } from '@/lib/theme';

// Tempo para a página de um post carregar os dados dele.
const LOAD_TIMEOUT = 10000;
// Na página já aberta os dados chegaram ou estão quase: sem eles, o post não tem mídia.
const ON_PAGE_TIMEOUT = 3000;

/** O que muda de um site para outro: a tela e o fluxo de download são os mesmos. */
export type Site = {
  home: string;
  observerScript: string;
  idleLabel: string;
  noMedia: string;
  /** Primeiro link de post do site em um texto, no formato padrão. */
  extractUrl: (text: string | null | undefined) => string | null;
  /** Identificador do post no link; null em link curto, que só revela o post ao redirecionar. */
  code: (text: string | null | undefined) => string | null;
  cachedPost: (url: string | null | undefined) => PostInfo | null;
  rememberPost: (post: CapturedPost) => void;
  /** Os dados do post só vêm no carregamento da página: abrir outro post dentro do site não os traz. */
  reloadToCapture?: boolean;
  /** Páginas https que tirariam o usuário do app (ex.: loja de aplicativos). */
  blockedUrl?: RegExp;
};

export function SiteBrowser({ site }: { site: Site }) {
  const t = useTheme();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const webview = useRef<WebView<object>>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  // Post aberto na WebView (detectado pela URL) e post mais visível na tela.
  const [current, setCurrent] = useState<string | null>(null);
  const [visible, setVisible] = useState<string | null>(null);
  const [grab, setGrab] = useState<Grab | null>(null);
  const [selecting, setSelecting] = useState(false);
  // Puxar para atualizar (Android): só com a página no topo, senão rolar para cima recarregaria.
  const [atTop, setAtTop] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Os dados chegam pela página: renderiza de novo para o botão reconhecer o post recém-capturado.
  const [, setCaptured] = useState(0);
  // Post aguardando os dados da página para começar a baixar.
  const pending = useRef<{ url: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  // Link vindo da aba Baixar; `t` repete o pedido do mesmo link.
  const params = useLocalSearchParams<{ url?: string; t?: string }>();
  const requested = site.extractUrl(params.url);
  const [initialUrl] = useState(() => requested ?? site.home);
  const handled = useRef<string | undefined>(undefined);

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

  function samePost(a: string | null | undefined, b: string | null | undefined) {
    return site.code(a) !== null && site.code(a) === site.code(b);
  }

  function clearPending() {
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = null;
  }

  function navigate(url: string) {
    webview.current?.injectJavaScript(`location.href = ${JSON.stringify(url)}; true;`);
  }

  /** Espera os dados do post chegarem pela página; se não chegarem, mostra o motivo no botão. */
  function waitFor(url: string, timeout: number) {
    clearPending();
    setGrab({ url, status: 'loading' });
    pending.current = {
      url,
      timer: setTimeout(() => {
        pending.current = null;
        setGrab({ url, status: 'error', message: site.noMedia });
      }, timeout),
    };
  }

  /** Mídia única vai direto; carrossel abre a escolha. Post ainda sem dados é aberto para carregá-los. */
  function download(url: string) {
    const post = site.cachedPost(url);
    if (!post) {
      const onPage = samePost(current, url) && !site.reloadToCapture;
      waitFor(url, onPage ? ON_PAGE_TIMEOUT : LOAD_TIMEOUT);
      if (!onPage) navigate(url);
      return;
    }
    clearPending();
    setGrab({ url, status: 'ready', post });
    const [first] = post.items;
    if (post.items.length > 1) setSelecting(true);
    else if (first && !getEntry(entryKey(post, first))) startDownload(post, first);
  }

  function downloadSelected(items: MediaItem[]) {
    if (grab?.post) items.forEach((item) => startDownload(grab.post!, item));
  }

  function onUrl(url: string) {
    const link = site.extractUrl(url);
    setCurrent(link);
    if (pending.current && site.code(link) && !site.code(pending.current.url)) {
      // O link curto redirecionou: agora se sabe qual é o post esperado.
      pending.current.url = link!;
      setGrab({ url: link!, status: 'loading' });
    } else if (pending.current && link && site.code(link) && !samePost(link, pending.current.url)) {
      // Abriu outro post no meio da espera: desiste do anterior.
      clearPending();
    }
    // Com a escolha aberta ou esperando os dados, não descarta o que foi pedido.
    if (!pending.current && !selecting && !samePost(link, grab?.url)) setGrab(null);
  }

  function onVisible(link: string | null) {
    setVisible(link);
    // O botão acompanha o post na tela; não interrompe uma busca em andamento.
    if (!samePost(link, grab?.url) && grab?.status !== 'loading' && !selecting) setGrab(null);
  }

  function onNavigation(nav: WebViewNavigation) {
    setCanGoBack(nav.canGoBack);
    onUrl(nav.url);
  }

  // Abre o post pedido pela aba Baixar e baixa assim que os dados chegarem.
  useEffect(() => {
    if (!requested || handled.current === params.t) return;
    // Na primeira montagem a WebView já abre direto na página pedida.
    const firstLoad = handled.current === undefined && requested === initialUrl;
    handled.current = params.t;
    // O pedido vem de outra tela pela navegação: não há evento aqui para tratá-lo fora do efeito.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (site.cachedPost(requested)) {
      download(requested);
      return;
    }
    waitFor(requested, LOAD_TIMEOUT);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (!firstLoad) navigate(requested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested, params.t]);

  useEffect(() => clearPending, []);

  // No feed, o botão só aparece em post com mídia; um post aberto sempre tem o botão, que explica se não houver.
  const feedPost = site.cachedPost(visible) ? visible : null;
  const target = grab?.url ?? feedPost ?? current;
  const post = grab?.post;
  const downloaded = useDownloadedItems(post);

  function refresh() {
    setRefreshing(true);
    webview.current?.reload();
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: t.bg }}>
      <WebViewRefresh refreshing={refreshing} onRefresh={refresh} enabled={atTop}>
        <WebView
          ref={webview}
          source={{ uri: initialUrl }}
          sharedCookiesEnabled
          allowsBackForwardNavigationGestures
          // iOS tem o puxar para atualizar nativo; no Android vem do ScrollView em volta.
          pullToRefreshEnabled
          nestedScrollEnabled
          // Sem isto, o iOS abre os vídeos do site em tela cheia, fora da página.
          allowsInlineMediaPlayback
          // Sem isto, a WebView entrega links `barcelona://`, `snssdk1233://` e afins ao sistema, e o usuário sai do app.
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={({ url }) => /^(https?|about|blob|data):/i.test(url) && !site.blockedUrl?.test(url)}
          onScroll={({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => setAtTop(nativeEvent.contentOffset.y <= 0)}
          injectedJavaScriptBeforeContentLoaded={
            site.observerScript + (scheme === 'dark' ? paintBackgroundScript(t.bg) : '')
          }
          onNavigationStateChange={onNavigation}
          onLoadEnd={() => {
            setLoading(false);
            setRefreshing(false);
          }}
          onMessage={({ nativeEvent }) => {
            const msg = parseWebMessage(nativeEvent.data);
            if (msg?.type === 'url') onUrl(msg.value);
            if (msg?.type === 'visible') onVisible(msg.value);
            if (msg?.type === 'post') {
              site.rememberPost(msg.value);
              setCaptured((n) => n + 1);
              if (pending.current && site.code(pending.current.url) === msg.value.code) download(pending.current.url);
            }
            // "Copiar link" dentro do site: baixa na hora, sem passar pela área de transferência.
            if (msg?.type === 'copy') {
              const url = site.extractUrl(msg.value);
              if (url) download(url);
            }
          }}
          // Fundo nativo da WebView (branco por padrão) até a página pintar o primeiro quadro.
          style={{ flex: 1, backgroundColor: t.bg }}
        />
      </WebViewRefresh>

      {loading ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <ActivityIndicator color={t.accent} />
        </View>
      ) : null}

      {target ? (
        <DownloadPill
          target={target}
          grab={grab}
          idleLabel={site.idleLabel}
          onDownload={download}
          onSelect={() => setSelecting(true)}
        />
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
  center: { alignItems: 'center', justifyContent: 'center' },
});
