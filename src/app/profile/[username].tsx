import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DownloadList } from '@/components/download-list';
import { Button } from '@/components/ui';
import { useHistory, type HistoryEntry } from '@/lib/history';
import { INSTAGRAM_HOME } from '@/lib/instagram-web';
import { recordVisit, useProfiles } from '@/lib/profiles';
import { useTheme } from '@/lib/theme';

/** Downloads antigos não guardam o usuário; neles `author` costuma ser o usuário. */
function belongsTo(entry: HistoryEntry, username: string) {
  return (entry.username ?? entry.author)?.toLowerCase() === username.toLowerCase();
}

// Não consulta o Instagram: mostra só o que já foi baixado deste perfil.
export default function ProfileScreen() {
  const t = useTheme();
  const { username } = useLocalSearchParams<{ username: string }>();
  const saved = useProfiles().find((p) => p.username === username);
  const downloads = useHistory().filter((e) => belongsTo(e, username));

  useEffect(() => {
    recordVisit(username);
  }, [username]);

  function openInBrowser() {
    // `t` faz a aba Navegar abrir o perfil mesmo se o mesmo link já foi pedido antes.
    router.navigate({ pathname: '/browser', params: { url: `${INSTAGRAM_HOME}${username}/`, t: String(Date.now()) } });
  }

  return (
    <>
      <Stack.Screen options={{ title: `@${username}` }} />
      <DownloadList
        entries={downloads}
        emptyTitle="Nenhum download deste perfil"
        emptyText="Abra o perfil no Instagram para encontrar posts, reels e stories para baixar."
        header={
          <View style={styles.identity}>
            <View style={[styles.avatar, { backgroundColor: t.border }]}>
              {saved?.avatar ? (
                <Image source={{ uri: saved.avatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <Ionicons name="person" size={32} color={t.muted} />
              )}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.username, { color: t.text }]}>@{username}</Text>
              {saved?.fullName ? <Text style={{ color: t.muted, fontSize: 14 }}>{saved.fullName}</Text> : null}
              <Text style={{ color: t.muted, fontSize: 13 }}>
                {downloads.length} {downloads.length === 1 ? 'download' : 'downloads'}
              </Text>
            </View>
            <Button compact label="Instagram" icon="compass-outline" variant="secondary" onPress={openInBrowser} />
          </View>
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  username: { fontSize: 17, fontWeight: '700' },
});
