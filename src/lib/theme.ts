import { useSyncExternalStore } from 'react';
import { Appearance, AppState } from 'react-native';

import type { ThemePreference } from '@/lib/settings';

const light = {
  bg: '#F6F5F2',
  card: '#FFFFFF',
  text: '#16151A',
  muted: '#6B6875',
  border: '#E4E2DC',
  accent: '#5B3DF5',
  accentText: '#FFFFFF',
  danger: '#D93A3A',
  success: '#1F9D55',
};

const dark: typeof light = {
  bg: '#0F0E13',
  card: '#1A1920',
  text: '#F2F1F5',
  muted: '#9C99A8',
  border: '#2A2932',
  accent: '#8C75FF',
  accentText: '#0F0E13',
  danger: '#FF6B6B',
  success: '#4ADE80',
};

export type Theme = typeof light;

export type ColorScheme = 'light' | 'dark';

// Fonte única do tema. O `useColorScheme` do React Native não serve aqui:
// `Appearance.setColorScheme` troca o valor sem avisar os inscritos (só quem
// re-renderiza por outro motivo vê a mudança, e pai/filho ficam com temas
// opostos), e no iOS o sistema alterna claro/escuro ao tirar o snapshot do app
// em segundo plano.
let preference: ThemePreference = 'system';
let system: ColorScheme = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
let scheme: ColorScheme = system;
const listeners = new Set<() => void>();

function update() {
  const next = preference === 'system' ? system : preference;
  if (next === scheme) return;
  scheme = next;
  listeners.forEach((l) => l());
}

function readSystem() {
  // Com preferência forçada o valor do Appearance é o forçado, não o do sistema.
  if (preference !== 'system') return;
  system = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  update();
}

Appearance.addChangeListener(() => {
  // Fora de primeiro plano os eventos podem ser do snapshot; relê ao voltar.
  if (AppState.currentState === 'active') readSystem();
});
AppState.addEventListener('change', (state) => {
  if (state === 'active') readSystem();
});

/** Força claro/escuro no app inteiro (inclusive componentes nativos) ou volta a seguir o sistema. */
export function applyThemePreference(pref: ThemePreference) {
  preference = pref;
  Appearance.setColorScheme(pref === 'system' ? 'unspecified' : pref);
  readSystem();
  update();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useColorScheme(): ColorScheme {
  return useSyncExternalStore(subscribe, () => scheme);
}

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
