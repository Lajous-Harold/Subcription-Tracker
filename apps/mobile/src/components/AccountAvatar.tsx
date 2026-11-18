import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useAuth } from '@/lib/auth';
import { initialOf } from '@/lib/format';
import { radii, useBrand } from '@/lib/theme';

export const ACCOUNT_AVATAR_BUTTON_SIZE = 44;

/** Décoratif : l'adresse e-mail est toujours lue à côté, ou portée par le bouton qui l'entoure. */
export function AccountAvatar({ email, size = 40 }: { email: string | null | undefined; size?: number }) {
  const brand = useBrand();
  return (
    <View style={[styles.avatar, { width: size, height: size, backgroundColor: brand.colors.actionTint }]} aria-hidden>
      <Text
        style={{ fontFamily: brand.fonts.displayBold, fontSize: Math.round(size * 0.45), color: brand.colors.action }}
      >
        {initialOf(email)}
      </Text>
    </View>
  );
}

/** Accès au compte depuis l'en-tête des onglets en mode compact. */
export function AccountAvatarButton() {
  const { user } = useAuth();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Compte"
      onPress={() => router.navigate('/account')}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <AccountAvatar email={user?.email} size={ACCOUNT_AVATAR_BUTTON_SIZE} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: { borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  button: { borderRadius: radii.pill },
  pressed: { opacity: 0.75 },
});
