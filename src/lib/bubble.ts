import Constants from 'expo-constants';
import { PermissionsAndroid, Platform } from 'react-native';

import FloatingBubble from '../../modules/floating-bubble';
import { getSettings, saveSettings } from './settings';

/** O balão só existe no Android, em development/release builds. */
export const bubbleAvailable = FloatingBubble != null;

function scheme() {
  const value = Constants.expoConfig?.scheme;
  return (Array.isArray(value) ? value[0] : value) ?? 'igsaver';
}

/**
 * Liga o balão. Sem a permissão de sobrepor apps, abre a tela do sistema e
 * retorna false — o balão sobe sozinho quando o app voltar ao foco ([syncBubble]).
 */
export async function enableBubble(): Promise<boolean> {
  if (!FloatingBubble) return false;
  await saveSettings({ floatingBubble: true });
  // Sem esta permissão (Android 13+) o balão funciona, só a notificação "Fechar balão" fica oculta.
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS').catch(() => {});
  }
  if (!FloatingBubble.canDrawOverlays()) {
    FloatingBubble.requestPermission();
    return false;
  }
  FloatingBubble.start(scheme());
  return true;
}

export async function disableBubble() {
  await saveSettings({ floatingBubble: false });
  FloatingBubble?.stop();
}

export function isBubbleRunning() {
  return FloatingBubble?.isRunning() ?? false;
}

/** Chamado quando o app abre ou volta ao foco: liga o balão se o usuário deixou ativado. */
export async function syncBubble() {
  if (!FloatingBubble || !(await getSettings()).floatingBubble) return;
  if (FloatingBubble.isRunning() || !FloatingBubble.canDrawOverlays()) return;
  try {
    FloatingBubble.start(scheme());
  } catch (e) {
    console.log('[bubble] não foi possível iniciar o balão', e);
  }
}
