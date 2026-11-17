import { Platform } from 'react-native';

// Seule variable d'environnement de l'application : tout `EXPO_PUBLIC_*` est embarqué dans le bundle,
// donc jamais de secret ici.
const envApiUrl = process.env.EXPO_PUBLIC_API_URL;

function defaultApiUrl(): string {
  // L'émulateur Android joint la machine hôte via 10.0.2.2.
  if (Platform.OS === 'android') return 'http://10.0.2.2:4000/api';
  return 'http://localhost:4000/api';
}

export const API_URL = (envApiUrl && envApiUrl.length > 0 ? envApiUrl : defaultApiUrl()).replace(/\/$/, '');

export const PLATFORM: 'web' | 'native' = Platform.OS === 'web' ? 'web' : 'native';

export const DEMO_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_DEMO === 'true';
