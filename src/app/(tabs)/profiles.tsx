import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, EmptyState } from '@/components/ui';
import { removeProfile, useProfiles, type ProfileEntry } from '@/lib/profiles';
import { loginAvailable, logout, useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const USERNAME = /^[\w.]{1,30}$/;

export default function ProfilesScreen() {
  const t = useTheme();
  const profiles = useProfiles();
  const session = useSession();
  const [input, setInput] = useState('');

  function open(username: string) {
    router.push({ pathname: '/profile/[username]', params: { username } });
  }

  function submit() {
    const username = input.trim().replace(/^@/, '');
    if (!USERNAME.test(username)) {
      Alert.alert('Usuário inválido', 'Digite só o nome de usuário, ex.: @instagram.');
      return;
    }
    setInput('');
    open(username);
  }

  function confirmRemove(entry: ProfileEntry) {
    Alert.alert(`Remover @${entry.username}?`, 'O perfil sai da lista de visitados.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => removeProfile(entry.username) },
    ]);
  }

  function login() {
    if (!loginAvailable) {
      Alert.alert(
        'Login indisponível neste build',
        'O login do Instagram usa um módulo nativo que não existe no Expo Go. Gere um development build (npx expo run:android) e abra o app por ele.',
      );
      return;
    }
    router.push('/instagram-login');
  }

  function confirmLogout() {
    Alert.alert('Sair do Instagram?', 'O app apaga a sessão salva. Sem ela, o feed dos perfis pode não carregar.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => logout() },
    ]);
  }

  return (
    <FlatList
      data={profiles}
      keyExtractor={(p) => p.username}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListHeaderComponent={
        <View style={{ gap: 16, marginBottom: 16 }}>
          <View style={[styles.account, { backgroundColor: t.card, borderColor: t.border }]}>
            <Ionicons
              name={session ? 'checkmark-circle' : 'logo-instagram'}
              size={22}
              color={session ? t.success : t.muted}
            />
            <Text style={{ flex: 1, color: session ? t.text : t.muted, fontSize: 14, lineHeight: 19 }}>
              {session ? 'Conectado ao Instagram' : 'Entre no Instagram para ver as últimas publicações dos perfis.'}
            </Text>
            {session ? (
              <Button compact label="Sair" variant="secondary" onPress={confirmLogout} />
            ) : (
              <Button compact label="Entrar" icon="log-in-outline" onPress={login} />
            )}
          </View>
          <View style={styles.search}>
            <TextInput
              value={input}
              onChangeText={setInput}
              onSubmitEditing={submit}
              placeholder="@usuario"
              placeholderTextColor={t.muted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.card }]}
            />
            <Button label="Abrir" icon="person-outline" onPress={submit} />
          </View>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          icon="people-outline"
          title="Nenhum perfil visitado"
          text="Os autores dos posts que você buscar e os perfis que abrir aparecem aqui."
        />
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => open(item.username)}
          onLongPress={() => confirmRemove(item)}
          style={({ pressed }) => [styles.row, { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.8 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={`Abrir perfil @${item.username}`}
          accessibilityHint="Toque e segure para remover"
        >
          <View style={[styles.avatar, { backgroundColor: t.border }]}>
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Ionicons name="person" size={22} color={t.muted} />
            )}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={1} style={{ color: t.text, fontWeight: '600' }}>
              @{item.username}
            </Text>
            <Text numberOfLines={1} style={{ color: t.muted, fontSize: 13 }}>
              {[item.fullName, new Date(item.visitedAt).toLocaleDateString()].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={t.muted} />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 48, flexGrow: 1 },
  search: { flexDirection: 'row', gap: 10 },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, minHeight: 48 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
