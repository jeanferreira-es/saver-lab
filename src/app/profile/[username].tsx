import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { InstagramBridge, type InstagramBridgeHandle } from '@/components/instagram-bridge';
import { Button, EmptyState } from '@/components/ui';
import { fetchProfile, type ProfileInfo, type ProfilePost } from '@/lib/api';
import { recordProfile, useProfiles } from '@/lib/profiles';
import { loginAvailable, useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const COLUMNS = 3;
const GAP = 2;

export default function ProfileScreen() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const { username } = useLocalSearchParams<{ username: string }>();
  const saved = useProfiles().find((p) => p.username === username);
  const session = useSession();
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const bridge = useRef<InstagramBridgeHandle>(null);

  useEffect(() => {
    const controller = new AbortController();
    // Com login, consulta pelo celular (IP e sessão do usuário); se falhar, usa o servidor.
    const viaPhone = session && bridge.current ? bridge.current.fetchProfile(username) : Promise.reject(null);
    viaPhone
      .catch((e) => {
        if (e) console.log('[profile] consulta pelo celular falhou, usando o servidor', e);
        return fetchProfile(username, controller.signal);
      })
      .then((info) => {
        if (controller.signal.aborted) return;
        setProfile(info);
        setError(null);
        recordProfile(info);
      })
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') setError(friendlyError(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [username, attempt, session]);

  function retry() {
    setLoading(true);
    setError(null);
    setAttempt((n) => n + 1);
  }

  // Sem o feed do Instagram, mostra as publicações já buscadas no app.
  const posts = profile?.posts ?? saved?.posts ?? [];
  const avatar = profile?.avatar ?? saved?.avatar;
  const fullName = profile?.fullName ?? saved?.fullName;
  const size = (width - GAP * (COLUMNS - 1)) / COLUMNS;

  function openPost(post: ProfilePost) {
    router.navigate({ pathname: '/', params: { url: post.url } });
  }

  return (
    <>
      <Stack.Screen options={{ title: `@${username}` }} />
      {session ? <InstagramBridge ref={bridge} /> : null}
      <FlatList
        data={posts}
        keyExtractor={(p) => p.url}
        numColumns={COLUMNS}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ gap: GAP, paddingBottom: 48, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.identity}>
              <View style={[styles.avatar, { backgroundColor: t.border }]}>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <Ionicons name="person" size={32} color={t.muted} />
                )}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.username, { color: t.text }]}>@{username}</Text>
                {fullName ? <Text style={{ color: t.muted, fontSize: 14 }}>{fullName}</Text> : null}
              </View>
              <Button
                compact
                label="Instagram"
                icon="open-outline"
                variant="secondary"
                onPress={() => Linking.openURL(`https://www.instagram.com/${username}/`)}
              />
            </View>

            {loading ? <ActivityIndicator color={t.accent} /> : null}
            {error ? (
              <View style={{ gap: 10 }}>
                <Text style={{ color: t.danger, fontSize: 14, lineHeight: 20 }}>{error}</Text>
                {posts.length ? (
                  <Text style={{ color: t.muted, fontSize: 13 }}>Mostrando as publicações que você já buscou.</Text>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Button compact label="Tentar de novo" icon="refresh" variant="secondary" onPress={retry} />
                  {!session && loginAvailable ? (
                    <Button compact label="Entrar no Instagram" icon="log-in-outline" onPress={() => router.push('/instagram-login')} />
                  ) : null}
                </View>
              </View>
            ) : null}
            {profile?.isPrivate ? (
              <Text style={{ color: t.muted, fontSize: 13 }}>Perfil privado: só aparecem publicações se você o seguir.</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? undefined : (
            <EmptyState icon="images-outline" title="Nenhuma publicação" text="Não há publicações para mostrar agora." />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openPost(item)}
            style={({ pressed }) => [{ width: size, height: size * 1.25, backgroundColor: t.border, opacity: pressed ? 0.8 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={item.caption ? `Abrir publicação: ${item.caption.slice(0, 60)}` : 'Abrir publicação'}
          >
            {item.thumbnail ? (
              <Image source={{ uri: item.thumbnail }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : null}
            {item.type !== 'image' ? (
              <View style={styles.badge}>
                <Ionicons name={item.type === 'carousel' ? 'copy' : 'play'} size={14} color="#fff" />
              </View>
            ) : null}
          </Pressable>
        )}
      />
    </>
  );
}

function friendlyError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (/Network request failed|Failed to fetch/i.test(msg)) {
    return 'Não consegui falar com o servidor. Confira o endereço em Ajustes e se o celular está na mesma rede.';
  }
  return msg;
}

const styles = StyleSheet.create({
  header: { padding: 16, gap: 14 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  username: { fontSize: 17, fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
