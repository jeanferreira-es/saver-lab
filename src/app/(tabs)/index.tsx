import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { SelectItemsModal } from '@/components/select-items-modal';
import { Button, Card, formatBytes, formatDuration } from '@/components/ui';
import { extractInstagramUrl, fetchInfo, type MediaItem, type PostInfo } from '@/lib/api';
import { entryKey, startDownload, useDownloadStates, type DownloadState } from '@/lib/downloader';
import { getEntry, useHistory } from '@/lib/history';
import { recordPost } from '@/lib/profiles';
import { useTheme } from '@/lib/theme';

export default function DownloadScreen() {
  const t = useTheme();
  const history = useHistory();
  const downloads = useDownloadStates();
  const params = useLocalSearchParams<{ url?: string; t?: string }>();
  const [input, setInput] = useState('');
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [post, setPost] = useState<PostInfo | null>(null);
  const [selecting, setSelecting] = useState(false);
  const dismissed = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  // Ao voltar para a tela, verifica se há um link do Instagram copiado.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      Clipboard.hasStringAsync()
        .then((has) => (has ? Clipboard.getStringAsync() : ''))
        .then((text) => {
          const url = extractInstagramUrl(text);
          if (active && url && url !== dismissed.current && url !== input.trim()) setClipboardUrl(url);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [input]),
  );

  // Link aberto a partir da aba Perfis ou do balão flutuante (`t` força nova busca do mesmo link).
  useEffect(() => {
    if (params.url) search(params.url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.url, params.t]);

  async function search(raw = input) {
    Keyboard.dismiss();
    const url = extractInstagramUrl(raw);
    if (!url) {
      setError('Cole um link de post, reel ou IGTV (ex.: instagram.com/reel/...).');
      return;
    }
    setInput(url);
    setClipboardUrl(null);
    setError(null);
    setPost(null);
    abort.current?.abort();
    abort.current = new AbortController();
    setLoading(true);
    try {
      const info = await fetchInfo(url, abort.current.signal);
      setPost(info);
      recordPost(info);
      const [first] = info.items;
      // Carrossel: já abre a escolha dos itens.
      if (info.items.length > 1) setSelecting(true);
      // Vídeo ou foto única: baixa direto, a menos que já esteja nos downloads.
      else if (first && !getEntry(entryKey(info, first))) startDownload(info, first);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }

  async function paste() {
    const text = await Clipboard.getStringAsync();
    setInput(text);
    if (extractInstagramUrl(text)) search(text);
  }

  function download(item: MediaItem) {
    if (post) startDownload(post, item);
  }

  // Inicia todos de uma vez: no iOS o sistema enfileira as transferências e
  // segue com elas mesmo com o app em segundo plano.
  function downloadSelected(selected: MediaItem[]) {
    selected.forEach(download);
  }

  const downloaded = new Set(
    post ? post.items.filter((i) => history.some((h) => h.key === entryKey(post, i))).map((i) => i.index) : [],
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {clipboardUrl ? (
          <Pressable
            onPress={() => search(clipboardUrl)}
            style={[styles.banner, { backgroundColor: t.card, borderColor: t.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Usar link copiado"
          >
            <Ionicons name="clipboard-outline" size={20} color={t.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: t.text }]}>Link copiado detectado</Text>
              <Text numberOfLines={1} style={{ color: t.muted, fontSize: 13 }}>
                {clipboardUrl}
              </Text>
            </View>
            <Pressable
              hitSlop={10}
              onPress={() => {
                dismissed.current = clipboardUrl;
                setClipboardUrl(null);
              }}
              accessibilityLabel="Dispensar"
            >
              <Ionicons name="close" size={20} color={t.muted} />
            </Pressable>
          </Pressable>
        ) : null}

        <Card>
          <Text style={[styles.label, { color: t.muted }]}>Link do Instagram</Text>
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => search()}
            placeholder="https://www.instagram.com/reel/..."
            placeholderTextColor={t.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="search"
            style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]}
          />
          <View style={styles.row}>
            <Button label="Colar" icon="clipboard-outline" variant="secondary" onPress={paste} style={{ flex: 1 }} />
            <Button label="Buscar" icon="search" onPress={() => search()} loading={loading} style={{ flex: 1 }} />
          </View>
          {error ? <Text style={[styles.error, { color: t.danger }]}>{error}</Text> : null}
        </Card>

        {post ? (
          <View style={{ gap: 12 }}>
            <View style={styles.postHeader}>
              <View style={{ flex: 1 }}>
                {post.username ? (
                  <Pressable
                    onPress={() => router.push({ pathname: '/profile/[username]', params: { username: post.username! } })}
                    accessibilityRole="link"
                    accessibilityLabel={`Ver perfil @${post.username}`}
                  >
                    <Text style={[styles.author, { color: t.accent }]}>@{post.username}</Text>
                  </Pressable>
                ) : post.author ? (
                  <Text style={[styles.author, { color: t.text }]}>{post.author}</Text>
                ) : null}
                {post.caption ? (
                  <Text numberOfLines={3} style={{ color: t.muted, fontSize: 14, lineHeight: 20 }}>
                    {post.caption}
                  </Text>
                ) : null}
              </View>
            </View>

            {post.items.length > 1 ? (
              <Button
                label={`Escolher itens do carrossel (${post.items.length})`}
                icon="checkbox-outline"
                onPress={() => setSelecting(true)}
              />
            ) : null}

            {post.items.map((item) => {
              const saved = history.find((h) => h.key === entryKey(post, item));
              const state = downloads[entryKey(post, item)] ?? { status: 'idle' };
              return (
                <Card key={item.index} style={styles.item}>
                  <View style={[styles.thumb, { backgroundColor: t.border }]}>
                    {item.thumbnail ? (
                      <Image source={{ uri: item.thumbnail }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    ) : (
                      <Ionicons name={item.type === 'video' ? 'videocam' : 'image'} size={28} color={t.muted} />
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={{ color: t.text, fontWeight: '600' }}>
                      {item.type === 'video' ? 'Vídeo' : 'Foto'} {post.items.length > 1 ? `${item.index}/${post.items.length}` : ''}
                    </Text>
                    <Text style={{ color: t.muted, fontSize: 13 }}>
                      {[formatDuration(item.duration), item.width && item.height ? `${item.width}×${item.height}` : null]
                        .filter(Boolean)
                        .join(' · ') || item.ext.toUpperCase()}
                    </Text>
                    {state.status === 'downloading' ? (
                      <>
                        <View style={[styles.progressTrack, { backgroundColor: t.border }]}>
                          <View
                            style={[
                              styles.progressBar,
                              { backgroundColor: t.accent, width: `${Math.round((fraction(state) ?? 0.15) * 100)}%` },
                            ]}
                          />
                        </View>
                        {state.bytesWritten > 0 ? (
                          <Text style={{ color: t.muted, fontSize: 12, fontVariant: ['tabular-nums'] }}>
                            {state.totalBytes
                              ? `${formatBytes(state.bytesWritten)} de ${formatBytes(state.totalBytes)}`
                              : formatBytes(state.bytesWritten)}
                          </Text>
                        ) : null}
                      </>
                    ) : null}
                    {state.status === 'error' ? (
                      <Text style={{ color: t.danger, fontSize: 13 }}>{friendlyError(state.error)}</Text>
                    ) : null}
                  </View>
                  {saved && state.status !== 'downloading' ? (
                    <Button
                      compact
                      label="Abrir"
                      icon="play"
                      variant="secondary"
                      onPress={() => router.push({ pathname: '/player/[key]', params: { key: saved.key } })}
                    />
                  ) : (
                    <Button
                      compact
                      label={state.status === 'downloading' ? progressLabel(state) : 'Baixar'}
                      icon={state.status === 'downloading' ? undefined : 'download-outline'}
                      disabled={state.status === 'downloading'}
                      onPress={() => download(item)}
                    />
                  )}
                </Card>
              );
            })}
          </View>
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

        {!post && !loading ? (
          <Text style={[styles.hint, { color: t.muted }]}>
            No Instagram, toque em ··· › Copiar link e volte para cá. Funciona com fotos, reels e carrosséis públicos.
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type Downloading = Extract<DownloadState, { status: 'downloading' }>;

function fraction(state: Downloading) {
  return state.totalBytes ? state.bytesWritten / state.totalBytes : null;
}

function progressLabel(state: Downloading) {
  // Antes do primeiro byte o servidor ainda está buscando a mídia no Instagram.
  if (state.bytesWritten === 0) return 'Preparando…';
  const f = fraction(state);
  return f == null ? 'Baixando…' : `${Math.floor(f * 100)}%`;
}

function friendlyError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (/Network request failed|Failed to fetch/i.test(msg)) {
    return 'Não consegui falar com o servidor. Confira o endereço em Ajustes e se o celular está na mesma rede.';
  }
  if (/login|cookies|rate-limit|empty media/i.test(msg)) {
    return 'O Instagram pediu login para este conteúdo. Configure IG_COOKIES no servidor (veja o README).';
  }
  if (/no video|no formats|não devolveu a foto/i.test(msg)) return 'Não encontrei mídia para baixar neste post.';
  return msg;
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16, paddingBottom: 48 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  bannerTitle: { fontWeight: '600', fontSize: 14 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10 },
  error: { marginTop: 12, fontSize: 14, lineHeight: 20 },
  postHeader: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 4 },
  author: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  thumb: { width: 64, height: 80, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressBar: { height: 4, borderRadius: 2 },
  hint: { fontSize: 14, lineHeight: 20, textAlign: 'center', paddingHorizontal: 24 },
});
