import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import type { MediaItem } from '@/lib/api';
import { useTheme } from '@/lib/theme';

const COLUMNS = 3;
const GAP = 8;
const PADDING = 16;

type Props = {
  visible: boolean;
  items: MediaItem[];
  /** Índices já baixados — começam desmarcados e com selo. */
  downloaded: Set<number>;
  onClose: () => void;
  onConfirm: (items: MediaItem[]) => void;
};

export function SelectItemsModal({ visible, items, downloaded, onClose, onConfirm }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const size = (width - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
  const allSelected = selected.size === items.length;

  function toggle(index: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function confirm() {
    onConfirm(items.filter((i) => selected.has(i.index)));
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
      // Ao abrir, pré-seleciona o que ainda não foi baixado.
      onShow={() => setSelected(new Set(items.filter((i) => !downloaded.has(i.index)).map((i) => i.index)))}
    >
      {/* No iOS o pageSheet já fica abaixo da status bar; no Android o modal é tela cheia. */}
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: Platform.OS === 'android' ? insets.top : 0 }}>
        <View style={[styles.header, { borderColor: t.border }]}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar">
            <Ionicons name="close" size={24} color={t.text} />
          </Pressable>
          <Text style={[styles.title, { color: t.text }]}>Escolha os itens</Text>
          <Pressable
            onPress={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.index)))}
            hitSlop={10}
            accessibilityRole="button"
          >
            <Text style={{ color: t.accent, fontWeight: '600' }}>{allSelected ? 'Limpar' : 'Todos'}</Text>
          </Pressable>
        </View>

        <FlatList
          data={items}
          keyExtractor={(i) => String(i.index)}
          numColumns={COLUMNS}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ padding: PADDING, gap: GAP }}
          renderItem={({ item }) => {
            const checked = selected.has(item.index);
            return (
              <Pressable
                onPress={() => toggle(item.index)}
                style={[
                  styles.tile,
                  { width: size, height: size * 1.25, backgroundColor: t.border, borderColor: checked ? t.accent : 'transparent' },
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={`${item.type === 'video' ? 'Vídeo' : 'Foto'} ${item.index} de ${items.length}`}
              >
                {item.thumbnail ? (
                  <Image source={{ uri: item.thumbnail }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : null}
                <View style={[styles.check, { backgroundColor: checked ? t.accent : 'rgba(0,0,0,0.35)' }]}>
                  {checked ? <Ionicons name="checkmark" size={16} color={t.accentText} /> : null}
                </View>
                <View style={styles.badges}>
                  <View style={styles.badge}>
                    <Ionicons name={item.type === 'video' ? 'videocam' : 'image'} size={12} color="#fff" />
                    <Text style={styles.badgeText}>{item.index}</Text>
                  </View>
                  {downloaded.has(item.index) ? (
                    <View style={styles.badge}>
                      <Ionicons name="checkmark-done" size={12} color="#fff" />
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />

        <View style={[styles.footer, { borderColor: t.border, paddingBottom: insets.bottom + 12 }]}>
          <Button
            label={selected.size ? `Baixar ${selected.size} ${selected.size === 1 ? 'item' : 'itens'}` : 'Nenhum item selecionado'}
            icon="cloud-download-outline"
            disabled={!selected.size}
            onPress={confirm}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17, fontWeight: '700' },
  tile: { borderRadius: 12, overflow: 'hidden', borderWidth: 3 },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badges: { position: 'absolute', bottom: 6, left: 6, flexDirection: 'row', gap: 4 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
