import { useEffect, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Button, Card } from '@/components/ui';
import { ping } from '@/lib/api';
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
  const [apiUrl, setApiUrl] = useState('');
  const [autoSave, setAutoSave] = useState(true);
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [bubble, setBubble] = useState(isBubbleRunning);
  const [theme, setTheme] = useState<ThemePreference>('system');

  useEffect(() => {
    getSettings().then((s) => {
      setApiUrl(s.apiUrl);
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

  async function test() {
    setStatus('testing');
    const saved = await saveSettings({ apiUrl });
    setApiUrl(saved.apiUrl);
    setStatus((await ping(saved.apiUrl)) ? 'ok' : 'fail');
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={[styles.label, { color: t.muted }]}>Servidor</Text>
        <TextInput
          value={apiUrl}
          onChangeText={(v) => {
            setApiUrl(v);
            setStatus('idle');
          }}
          placeholder="https://igsaver-server.onrender.com"
          placeholderTextColor={t.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]}
        />
        <Button label="Salvar e testar" icon="pulse-outline" onPress={test} loading={status === 'testing'} />
        {status === 'ok' ? <Text style={[styles.status, { color: t.success }]}>Conectado ao servidor.</Text> : null}
        {status === 'fail' ? (
          <Text style={[styles.status, { color: t.danger }]}>
            Sem resposta. Use o IP do computador na rede local (não localhost) e confira se o servidor está rodando.
          </Text>
        ) : null}
      </Card>

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
                Fica sobre os outros apps. Copie um link do Instagram e toque no balão para abrir aqui. Segure o balão para
                fechá-lo.
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
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 12 },
  status: { marginTop: 12, fontSize: 14, lineHeight: 20 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  segmented: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 4, gap: 4 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 },
  footer: { fontSize: 13, textAlign: 'center', lineHeight: 18, paddingHorizontal: 16 },
});
