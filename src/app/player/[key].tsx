import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ui';
import { useHistory, type HistoryEntry } from '@/lib/history';

export default function PlayerScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const entry = useHistory().find((e) => e.key === key);

  if (!entry) {
    return <EmptyState icon="alert-circle-outline" title="Arquivo não encontrado" text="Ele pode ter sido apagado." />;
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: entry.author ? `@${entry.author}` : 'Reproduzir' }} />
      {entry.type === 'video' ? <VideoPlayer entry={entry} /> : (
        <Image source={{ uri: entry.fileUri }} style={styles.media} contentFit="contain" />
      )}
    </View>
  );
}

function VideoPlayer({ entry }: { entry: HistoryEntry }) {
  const player = useVideoPlayer(entry.fileUri, (p) => {
    p.loop = true;
    p.play();
  });
  return <VideoView player={player} style={styles.media} contentFit="contain" nativeControls allowsPictureInPicture />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  media: { flex: 1 },
});
