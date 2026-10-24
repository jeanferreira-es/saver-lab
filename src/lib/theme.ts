import { useColorScheme } from 'react-native';

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

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
