import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type ButtonProps = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  compact?: boolean;
};

export function Button({ label, onPress, icon, variant = 'primary', loading, disabled, style, compact }: ButtonProps) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.accent : 'transparent';
  const fg = variant === 'primary' ? t.accentText : variant === 'danger' ? t.danger : t.text;
  const border = variant === 'primary' ? t.accent : variant === 'danger' ? t.danger : t.border;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        { backgroundColor: bg, borderColor: border, opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={compact ? 16 : 18} color={fg} /> : null}
          <Text style={[styles.label, compact && styles.compactLabel, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, color }: { icon: IconName; label: string; onPress: () => void; color?: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={22} color={color ?? t.text} />
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}>{children}</View>;
}

export function EmptyState({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={40} color={t.muted} />
      <Text style={[styles.emptyTitle, { color: t.text }]}>{title}</Text>
      <Text style={[styles.emptyText, { color: t.muted }]}>{text}</Text>
    </View>
  );
}

export function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatBytes(bytes: number | null) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
  },
  compact: { minHeight: 36, paddingHorizontal: 12, borderRadius: 10 },
  label: { fontSize: 16, fontWeight: '600' },
  compactLabel: { fontSize: 14 },
  iconButton: { padding: 6 },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  empty: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 64, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginTop: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
