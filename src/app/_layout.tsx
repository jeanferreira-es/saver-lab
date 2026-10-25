import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';

import { syncBubble } from '@/lib/bubble';
import { loadHistory } from '@/lib/history';
import { loadProfiles } from '@/lib/profiles';
import { loadSession } from '@/lib/session';
import { getSettings } from '@/lib/settings';
import { applyThemePreference, useColorScheme, useTheme } from '@/lib/theme';

export default function RootLayout() {
  const scheme = useColorScheme();
  const t = useTheme();
  // Tema da navegação com as mesmas cores: fundos e cabeçalhos que não recebem estilo próprio.
  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: t.accent, background: t.bg, card: t.card, text: t.text, border: t.border },
    };
  }, [scheme, t]);

  useEffect(() => {
    loadHistory();
    loadProfiles();
    loadSession();
    syncBubble();
    getSettings().then((s) => applyThemePreference(s.theme));
  }, []);

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="player/[key]" options={{ title: 'Reproduzir', presentation: 'modal' }} />
        <Stack.Screen name="profile/[username]" options={{ title: 'Perfil' }} />
        <Stack.Screen name="instagram-login" options={{ title: 'Entrar no Instagram', presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
