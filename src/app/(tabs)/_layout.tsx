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
          title: 'Navegar',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="compass-outline" color={color as string} size={size} />,
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
        name="downloads"
        options={{
          title: 'Downloads',
          tabBarIcon: ({ color, size }) => <Ionicons name="albums-outline" color={color as string} size={size} />,
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
