import { useEffect, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { bubbleAvailable, disableBubble, enableBubble, isBubbleRunning, syncBubble } from '@/lib/bubble';
import { getSettings, saveSettings, type ThemePreference } from '@/lib/settings';
import { applyThemePreference, useTheme } from '@/lib/theme';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
];

export default function SettingsScreen() {
  const t = useTheme();
  const [autoSave, setAutoSave] = useState(true);
  const [bubble, setBubble] = useState(isBubbleRunning);
  const [theme, setTheme] = useState<ThemePreference>('system');

  useEffect(() => {
    getSettings().then((s) => {
      setAutoSave(s.autoSaveToGallery);
      setTheme(s.theme);
    });
  }, []);

  // Ao voltar da tela de permissão do sistema, liga o balão e atualiza a chave.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      await syncBubble();
      setBubble(isBubbleRunning());
    });
    return () => sub.remove();
  }, []);

  async function toggleBubble(on: boolean) {
    if (!on) {
      await disableBubble();
      setBubble(false);
      return;
    }
    if (await enableBubble()) {
      setBubble(true);
      return;
    }
    Alert.alert('Permita sobrepor a outros apps', 'Na tela que abriu, ative o Saver Lab e volte para cá.');
  }

  function changeTheme(pref: ThemePreference) {
    setTheme(pref);
    applyThemePreference(pref);
    saveSettings({ theme: pref });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card>
        <Text style={[styles.label, { color: t.muted }]}>Aparência</Text>
        <View style={[styles.segmented, { backgroundColor: t.bg, borderColor: t.border }]}>
          {THEME_OPTIONS.map((o) => {
            const active = theme === o.value;
            return (
              <Pressable
                key={o.value}
                onPress={() => changeTheme(o.value)}
                style={[styles.segment, active && { backgroundColor: t.accent }]}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
              >
                <Text style={{ color: active ? t.accentText : t.text, fontWeight: '600' }}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>Salvar na galeria</Text>
            <Text style={{ color: t.muted, fontSize: 13, marginTop: 2 }}>Copia cada download para o álbum “Saver Lab”.</Text>
          </View>
          <Switch
            value={autoSave}
            trackColor={{ true: t.accent }}
            onValueChange={(v) => {
              setAutoSave(v);
              saveSettings({ autoSaveToGallery: v });
            }}
          />
        </View>
      </Card>

      {bubbleAvailable ? (
        <Card>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>Balão flutuante</Text>
              <Text style={{ color: t.muted, fontSize: 13, marginTop: 2, lineHeight: 18 }}>
                Fica sobre os outros apps. Copie um link do Instagram e toque no balão para baixar. Segure o balão para
                deixá-lo quase transparente; um toque traz de volta. Para fechar, desligue aqui ou use a notificação.
              </Text>
            </View>
            <Switch value={bubble} trackColor={{ true: t.accent }} onValueChange={toggleBubble} />
          </View>
        </Card>
      ) : null}

      <Text style={[styles.footer, { color: t.muted }]}>
        Projeto acadêmico. Baixe apenas conteúdo seu ou com autorização do autor.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  segmented: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 4, gap: 4 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 },
  footer: { fontSize: 13, textAlign: 'center', lineHeight: 18, paddingHorizontal: 16 },
});
