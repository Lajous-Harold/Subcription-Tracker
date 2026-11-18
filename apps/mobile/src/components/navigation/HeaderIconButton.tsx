import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { radii, useBrand } from '@/lib/theme';

export const HEADER_ICON_BUTTON_SIZE = 44;

/** Bouton rond des en-têtes de page (retour, modifier) : l'icône seule, nommée par `accessibilityLabel`. */
export function HeaderIconButton({
  accessibilityLabel,
  onPress,
  children,
}: {
  accessibilityLabel: string;
  onPress: () => void;
  children: ReactNode;
}) {
  const brand = useBrand();
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: hovered || pressed ? brand.colors.controlBorder : brand.colors.border,
          backgroundColor: pressed ? brand.colors.tile : brand.colors.surface,
        },
      ]}
    >
      {children}
    </Pressable>
  );
}

export function BackButton({ onPress }: { onPress: () => void }) {
  const brand = useBrand();
  return (
    <HeaderIconButton accessibilityLabel="Retour" onPress={onPress}>
      {/* Masqué par la `View` : sur le web, `Svg` transmet ses props telles quelles au DOM. */}
      <View aria-hidden>
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Path
            d="M15 6l-6 6 6 6"
            fill="none"
            stroke={brand.colors.ink}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </HeaderIconButton>
  );
}

const styles = StyleSheet.create({
  button: {
    width: HEADER_ICON_BUTTON_SIZE,
    height: HEADER_ICON_BUTTON_SIZE,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
