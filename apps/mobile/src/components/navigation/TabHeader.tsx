import type { BottomTabHeaderProps } from 'expo-router/js-tabs';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ACCOUNT_AVATAR_BUTTON_SIZE } from '@/components/AccountAvatar';
import { useLayoutMode } from '@/lib/layout';
import { useBrand } from '@/lib/theme';

/** En-tête de page des onglets : grand titre aligné à gauche, sans barre, sur le fond de l'écran. */
export function TabHeader({ options, route }: BottomTabHeaderProps) {
  const brand = useBrand();
  const insets = useSafeAreaInsets();
  const isWide = useLayoutMode() === 'wide';
  const title = typeof options.headerTitle === 'string' ? options.headerTitle : (options.title ?? route.name);

  return (
    <View
      style={[
        styles.header,
        isWide ? styles.wideHeader : styles.compactHeader,
        { paddingTop: insets.top + (isWide ? 32 : 16), backgroundColor: brand.colors.background },
      ]}
    >
      {typeof options.headerTitle === 'function' ? (
        options.headerTitle({ children: title })
      ) : (
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={[
            isWide ? styles.wideTitle : styles.compactTitle,
            { fontFamily: brand.fonts.displayBold, color: brand.colors.ink },
          ]}
        >
          {title}
        </Text>
      )}
      {options.headerRight?.({ canGoBack: false })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  compactHeader: { minHeight: ACCOUNT_AVATAR_BUTTON_SIZE, paddingHorizontal: 20, paddingBottom: 8 },
  wideHeader: { paddingHorizontal: 32, paddingBottom: 8 },
  compactTitle: { flexShrink: 1, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  wideTitle: { flexShrink: 1, fontSize: 32, lineHeight: 38, letterSpacing: -1 },
});
