import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/tabs';

import { useTheme } from '@/lib/theme';

export default function TabsLayout() {
  const t = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.text,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Baixar',
          tabBarIcon: ({ color, size }) => <Ionicons name="download-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="browser"
        options={{
          title: 'Instagram',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="logo-instagram" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="threads"
        options={{
          title: 'Threads',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="at" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tiktok"
        options={{
          title: 'TikTok',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="logo-tiktok" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profiles"
        options={{
          title: 'Perfis',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}
