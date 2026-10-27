import { requireOptionalNativeModule } from 'expo';

type FloatingBubbleModule = {
  canDrawOverlays(): boolean;
  /** Abre a tela do sistema para liberar "Sobrepor a outros apps". */
  requestPermission(): void;
  /** `scheme` é o esquema de deep link do app, usado para abrir o link copiado. */
  start(scheme: string): void;
  /** Guarda o esquema de deep link usado pelo "Compartilhar" (sem precisar da bolha). */
  setScheme(scheme: string): void;
  /** Fecha a escolha de itens aberta pela bolha por cima de outro app. */
  closeOverlay(): void;
  stop(): void;
  isRunning(): boolean;
};

/** Só existe no Android, em builds nativos (não no Expo Go). */
export default requireOptionalNativeModule<FloatingBubbleModule>('FloatingBubble');
