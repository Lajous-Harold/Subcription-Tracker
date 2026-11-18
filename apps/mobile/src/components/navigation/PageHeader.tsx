import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayoutMode } from '@/lib/layout';
import { useBrand } from '@/lib/theme';
import { BackButton, HEADER_ICON_BUTTON_SIZE } from './HeaderIconButton';

interface PageHeaderProps {
  /** Une chaîne vide n'affiche aucun titre : l'écran porte alors le sien dans son contenu. */
  title: ReactNode;
  right?: ReactNode;
  /** Présent sur les écrans de pile : affiche le bouton retour. */
  onBack?: () => void;
  /** Zone de sécurité haute déjà absorbée par la présentation (modale iOS). */
  ignoresTopInset?: boolean;
}

/**
 * En-tête de page commun aux onglets et aux écrans de pile : grand titre sur le fond de l'écran, sans bande.
 * En compact, le titre d'un écran de pile passe sous la rangée retour/actions pour garder toute la largeur.
 */
export function PageHeader({ title, right, onBack, ignoresTopInset = false }: PageHeaderProps) {
  const brand = useBrand();
  const insets = useSafeAreaInsets();
  const isWide = useLayoutMode() === 'wide';
  const topInset = ignoresTopInset ? 0 : insets.top;

  const titleElement =
    typeof title === 'string' ? (
      title === '' ? null : (
        <Text
          accessibilityRole="header"
          numberOfLines={isWide ? 1 : 2}
          style={[
            styles.title,
            isWide ? styles.wideTitle : styles.compactTitle,
            { fontFamily: brand.fonts.displayBold, color: brand.colors.ink },
          ]}
        >
          {title}
        </Text>
      )
    ) : (
      title
    );
  const backButton = onBack ? <BackButton onPress={onBack} /> : null;
  const rightSlot = right ? <View style={styles.right}>{right}</View> : null;
  const background = { backgroundColor: brand.colors.background };

  if (isWide) {
    return (
      <View style={[styles.row, styles.wideHeader, background, { paddingTop: topInset + 32 }]}>
        <View style={styles.leading}>
          {backButton}
          {titleElement}
        </View>
        {rightSlot}
      </View>
    );
  }

  if (!onBack) {
    return (
      <View style={[styles.row, styles.compactTabHeader, background, { paddingTop: topInset + 20 }]}>
        {titleElement}
        {rightSlot}
      </View>
    );
  }

  return (
    <View style={[styles.compactStackHeader, background, { paddingTop: topInset + 20 }]}>
      <View style={styles.row}>
        {backButton}
        {rightSlot}
      </View>
      {titleElement}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: HEADER_ICON_BUTTON_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  leading: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 16 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wideHeader: { paddingHorizontal: 32, paddingBottom: 8 },
  compactTabHeader: { paddingHorizontal: 20, paddingBottom: 8 },
  compactStackHeader: { paddingHorizontal: 16, paddingBottom: 4, gap: 12 },
  title: { flexShrink: 1 },
  compactTitle: { fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  wideTitle: { fontSize: 32, lineHeight: 38, letterSpacing: -1 },
});
