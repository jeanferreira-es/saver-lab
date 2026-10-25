import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import type { ReactElement } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState, IconButton, formatBytes, formatDuration } from '@/components/ui';
import { deleteDownload, saveToGallery } from '@/lib/downloader';
import type { HistoryEntry } from '@/lib/history';
import { useTheme } from '@/lib/theme';

type Props = {
  entries: HistoryEntry[];
  header?: ReactElement;
  emptyTitle: string;
  emptyText: string;
};

/** Downloads com reprodução, compartilhar, salvar na galeria e apagar. */
export function DownloadList({ entries, header, emptyTitle, emptyText }: Props) {
  const t = useTheme();

  async function share(entry: HistoryEntry) {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Compartilhar', 'Compartilhamento não disponível neste dispositivo.');
      return;
    }
    await Sharing.shareAsync(entry.fileUri, {
      mimeType: entry.type === 'video' ? 'video/mp4' : 'image/jpeg',
    });
  }

  async function toGallery(entry: HistoryEntry) {
    try {
      await saveToGallery(entry);
      Alert.alert('Pronto', 'Salvo na galeria, no álbum "Saver Lab".');
    } catch (e) {
      Alert.alert('Não foi possível salvar', (e as Error).message);
    }
  }

  function confirmDelete(entry: HistoryEntry) {
    Alert.alert('Apagar download?', 'O arquivo sai do app. Cópias já salvas na galeria continuam lá.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => deleteDownload(entry) },
    ]);
  }

  return (
    <FlatList
      data={entries}
      keyExtractor={(e) => e.key}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListHeaderComponent={header}
      ListEmptyComponent={<EmptyState icon="albums-outline" title={emptyTitle} text={emptyText} />}
      renderItem={({ item }) => (
        <View style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}>
          <Pressable
            style={styles.main}
            onPress={() => router.push({ pathname: '/player/[key]', params: { key: item.key } })}
            accessibilityRole="button"
            accessibilityLabel="Reproduzir"
          >
            <View style={[styles.thumb, { backgroundColor: t.border }]}>
              <Image
                source={{ uri: item.type === 'image' ? item.fileUri : (item.thumbnail ?? undefined) }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
              {item.type === 'video' ? (
                <View style={styles.play}>
                  <Ionicons name="play" size={16} color="#fff" />
                </View>
              ) : null}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text numberOfLines={1} style={{ color: t.text, fontWeight: '600' }}>
                {item.username ? `@${item.username}` : item.author ? `@${item.author}` : 'Instagram'}
              </Text>
              {item.caption ? (
                <Text numberOfLines={2} style={{ color: t.muted, fontSize: 13, lineHeight: 18 }}>
                  {item.caption}
                </Text>
              ) : null}
              <Text style={{ color: t.muted, fontSize: 12 }}>
                {[formatDuration(item.duration), formatBytes(item.sizeBytes), new Date(item.createdAt).toLocaleDateString()]
                  .filter(Boolean)
                  .join(' · ')}
                {item.savedToGallery ? '  ✓ galeria' : ''}
              </Text>
            </View>
          </Pressable>
          <View style={styles.actions}>
            <IconButton icon="share-outline" label="Compartilhar" onPress={() => share(item)} />
            {!item.savedToGallery ? (
              <IconButton icon="images-outline" label="Salvar na galeria" onPress={() => toGallery(item)} />
            ) : null}
            <IconButton icon="trash-outline" label="Apagar" color={t.danger} onPress={() => confirmDelete(item)} />
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 48, flexGrow: 1 },
  row: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 },
  main: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 64, height: 80, borderRadius: 10, overflow: 'hidden' },
  play: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
});
