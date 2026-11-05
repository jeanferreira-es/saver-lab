import type { ReactNode } from 'react';
import { Platform, RefreshControl, ScrollView } from 'react-native';

import { useTheme } from '@/lib/theme';

type Props = { refreshing: boolean; enabled: boolean; onRefresh: () => void; children: ReactNode };

/** Puxar para atualizar da WebView no Android; o iOS usa o nativo (`pullToRefreshEnabled`). */
export function WebViewRefresh({ refreshing, enabled, onRefresh, children }: Props) {
  const t = useTheme();
  if (Platform.OS !== 'android') return children;
  return (
    <ScrollView
      contentContainerStyle={{ flex: 1 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          enabled={enabled}
          colors={[t.accent]}
          progressBackgroundColor={t.card}
        />
      }
    >
      {children}
    </ScrollView>
  );
}
