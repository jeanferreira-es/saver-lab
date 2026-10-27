import { AppRegistry } from 'react-native';

import { OverlayRoot } from '@/components/overlay-root';

// Tela aberta pela bolha por cima de outro app (OverlayActivity, Android).
AppRegistry.registerComponent('SaverLabOverlay', () => OverlayRoot);

// O Expo Router pede que a entrada dele seja o último import.
import 'expo-router/entry';
