import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const REFRESH_KEY = 'subtracker.refreshToken';

/**
 * Refresh token natif dans le trousseau sécurisé (Keychain / Keystore).
 * Sur le web, il vit dans un cookie httpOnly posé par l'API : rien n'est stocké en JavaScript.
 */
export async function readRefreshToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function writeRefreshToken(token: string | null | undefined): Promise<void> {
  if (Platform.OS === 'web') return;
  if (token) await SecureStore.setItemAsync(REFRESH_KEY, token);
  else await SecureStore.deleteItemAsync(REFRESH_KEY);
}
