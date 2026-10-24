import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { syncBubble } from '@/lib/bubble';
import { loadHistory } from '@/lib/history';
import { loadProfiles } from '@/lib/profiles';
import { loadSession } from '@/lib/session';
import { getSettings } from '@/lib/settings';
import { applyThemePreference, useTheme } from '@/lib/theme';

export default function RootLayout() {
  const t = useTheme();

  useEffect(() => {
    loadHistory();
    loadProfiles();
    loadSession();
    syncBubble();
    getSettings().then((s) => applyThemePreference(s.theme));
  }, []);

  return (
    <>
      <StatusBar style="auto" />
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
    </>
  );
}
