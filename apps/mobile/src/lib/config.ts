import { Platform } from 'react-native';

/**
 * URL de l'API. Seule variable d'environnement côté application :
 * tout `EXPO_PUBLIC_*` est embarqué dans le bundle, donc jamais de secret ici.
 */
const fromEnv = process.env.EXPO_PUBLIC_API_URL;

function defaultApiUrl(): string {
  // L'émulateur Android joint la machine hôte via 10.0.2.2.
  if (Platform.OS === 'android') return 'http://10.0.2.2:4000/api';
  return 'http://localhost:4000/api';
}

export const API_URL = (fromEnv && fromEnv.length > 0 ? fromEnv : defaultApiUrl()).replace(/\/$/, '');

export const PLATFORM: 'web' | 'native' = Platform.OS === 'web' ? 'web' : 'native';

/** Données de démonstration : en développement, ou dans un build de démo (EXPO_PUBLIC_ENABLE_DEMO=true). */
export const DEMO_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_DEMO === 'true';
