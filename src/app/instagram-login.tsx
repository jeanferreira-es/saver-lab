import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { captureSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const LOGIN_URL = 'https://www.instagram.com/accounts/login/';

export default function InstagramLoginScreen() {
  const t = useTheme();
  const [loading, setLoading] = useState(true);
  const done = useRef(false);

  // A cada página carregada, confere se o Instagram já criou a sessão.
  async function check() {
    setLoading(false);
    if (done.current) return;
    try {
      if (await captureSession()) {
        done.current = true;
        router.back();
      }
    } catch (e) {
      console.log('[login] erro ao ler cookies do Instagram', e);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.note, { color: t.muted, backgroundColor: t.card, borderColor: t.border }]}>
        Você entra na página do próprio Instagram. O app guarda só o cookie de sessão, nunca a sua senha.
      </Text>
      <WebView
        source={{ uri: LOGIN_URL }}
        sharedCookiesEnabled
        onLoadEnd={check}
        onNavigationStateChange={check}
        style={{ flex: 1 }}
      />
      {loading ? (
        <View style={[StyleSheet.absoluteFill, styles.loading]} pointerEvents="none">
          <ActivityIndicator color={t.accent} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 13, lineHeight: 18, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  loading: { alignItems: 'center', justifyContent: 'center' },
});
