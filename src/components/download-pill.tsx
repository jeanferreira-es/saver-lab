import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { PostInfo } from '@/lib/api';
import { entryKey, useDownloadStates } from '@/lib/downloader';
import { getEntry, useHistory } from '@/lib/history';
import { useTheme } from '@/lib/theme';

export type Grab = { url: string; status: 'loading' | 'ready' | 'error'; post?: PostInfo; message?: string };

/** Índices dos itens do post que já estão nos downloads. */
export function useDownloadedItems(post: PostInfo | undefined) {
  const history = useHistory();
  return new Set(post ? post.items.filter((i) => history.some((h) => h.key === entryKey(post, i))).map((i) => i.index) : []);
}

type Props = {
  target: string;
  grab: Grab | null;
  idleLabel: string;
  onDownload: (url: string) => void;
  onSelect: () => void;
};

/** Botão flutuante dos navegadores: baixa o post na tela e mostra o andamento. */
export function DownloadPill({ target, grab, idleLabel, onDownload, onSelect }: Props) {
  const t = useTheme();
  const downloads = useDownloadStates();
  const post = grab?.post;
  const downloaded = useDownloadedItems(post);
  const failure = post?.items.map((i) => downloads[entryKey(post, i)]).find((s) => s?.status === 'error');
  const failed = Boolean(failure);
  // Motivo do erro visível no botão: sem ele não dá para saber o que o site recusou.
  const errorDetail =
    grab?.status === 'error'
      ? grab.message
      : failure?.status === 'error'
        ? failure.error instanceof Error
          ? failure.error.message
          : String(failure.error)
        : null;
  const active = post?.items.map((i) => downloads[entryKey(post, i)]).filter((s) => s?.status === 'downloading') ?? [];
  const progress = active.length
    ? active.reduce((sum, s) => sum + (s?.status === 'downloading' && s.totalBytes ? s.bytesWritten / s.totalBytes : 0), 0) /
      active.length
    : null;

  let label = idleLabel;
  let icon: 'download-outline' | 'checkmark-circle' | 'alert-circle' | 'checkbox-outline' = 'download-outline';
  if (grab?.status === 'loading') label = 'Buscando…';
  else if (grab?.status === 'error') {
    label = 'Erro — tocar para tentar de novo';
    icon = 'alert-circle';
  } else if (failed && !active.length) {
    label = 'Falha no download — tocar para tentar de novo';
    icon = 'alert-circle';
  } else if (active.length) label = progress ? `Baixando… ${Math.round(progress * 100)}%` : 'Baixando…';
  else if (post && post.items.length > 1) {
    label = `Escolher itens (${post.items.length})`;
    icon = 'checkbox-outline';
  } else if (post && downloaded.size) {
    label = 'Baixado — abrir';
    icon = 'checkmark-circle';
  }

  function onPress() {
    if (post && post.items.length > 1 && grab?.status === 'ready' && !failed) return onSelect();
    if (post && downloaded.size && !active.length) {
      const entry = getEntry(entryKey(post, post.items[0]));
      if (entry) return router.push({ pathname: '/player/[key]', params: { key: entry.key } });
    }
    if (grab?.status !== 'loading' && !active.length) onDownload(target);
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: grab?.status === 'error' || failed ? t.danger : t.accent, opacity: pressed ? 0.85 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {grab?.status === 'loading' || active.length ? (
        <ActivityIndicator color={t.accentText} />
      ) : (
        <Ionicons name={icon} size={20} color={t.accentText} />
      )}
      <View style={{ flexShrink: 1 }}>
        <Text style={[styles.pillText, { color: t.accentText }]} numberOfLines={1}>
          {label}
        </Text>
        {errorDetail ? (
          <Text style={[styles.pillDetail, { color: t.accentText }]} numberOfLines={2}>
            {errorDetail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  pillDetail: { fontSize: 12, opacity: 0.85, marginTop: 1 },
});
