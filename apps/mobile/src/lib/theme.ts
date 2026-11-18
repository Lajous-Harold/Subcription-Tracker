import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { DarkTheme as NavDark, DefaultTheme as NavLight } from 'expo-router';
import type { TextStyle } from 'react-native';
import { configureFonts, MD3DarkTheme, MD3LightTheme, useTheme, type MD3Theme } from 'react-native-paper';

export const fontFamilies = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  displayMedium: 'SpaceGrotesk_500Medium',
  displayBold: 'SpaceGrotesk_700Bold',
} as const;

/** Import graisse par graisse : l'index des paquets embarquerait toutes les variantes dans le bundle. */
export const fontAssets = {
  [fontFamilies.regular]: Inter_400Regular,
  [fontFamilies.medium]: Inter_500Medium,
  [fontFamilies.semiBold]: Inter_600SemiBold,
  [fontFamilies.bold]: Inter_700Bold,
  [fontFamilies.displayMedium]: SpaceGrotesk_500Medium,
  [fontFamilies.displayBold]: SpaceGrotesk_700Bold,
};

export const radii = { panel: 20, control: 12, pill: 999 } as const;

export const tabularNums: TextStyle = { fontVariant: ['tabular-nums'] };

const lightBrandColors = {
  background: '#F4F5F7',
  surface: '#FFFFFF',
  ink: '#0E1116',
  inkMuted: '#4A5260',
  border: '#E3E6EB',
  tile: '#EEF0F3',
  trackInactive: '#D5DAE2',
  action: '#2B50E6',
  actionPressed: '#1E3BB3',
  actionTint: '#E8ECFF',
  onAction: '#FFFFFF',
  signal: '#FF7A45',
  signalText: '#B93D0C',
  signalTint: '#FFF1EA',
  signalBorder: '#FFD2BF',
  onSignal: '#0E1116',
  destructive: '#B42318',
  hero: { background: '#0E1116', text: '#FFFFFF', muted: '#C9CED6', divider: '#2A303A' },
};

export type BrandColors = typeof lightBrandColors;

const darkBrandColors: BrandColors = {
  background: '#0B0D11',
  surface: '#151920',
  ink: '#F2F4F7',
  inkMuted: '#A3ABB8',
  border: '#2A303A',
  tile: '#1F242D',
  trackInactive: '#353C48',
  action: '#9DAEFF',
  actionPressed: '#C3CDFF',
  actionTint: '#1E2A5E',
  onAction: '#0E1116',
  signal: '#FF8F61',
  signalText: '#FFB38F',
  signalTint: '#2E1A12',
  signalBorder: '#5C2E1A',
  onSignal: '#0E1116',
  destructive: '#F97066',
  hero: { background: '#1A1F29', text: '#FFFFFF', muted: '#C9CED6', divider: '#2F3644' },
};

export interface BrandTokens {
  colors: BrandColors;
  radii: typeof radii;
  fonts: typeof fontFamilies;
}

export type AppTheme = MD3Theme & { brand: BrandTokens };

/**
 * Chaque graisse est une famille distincte : une `fontWeight` autre que `normal` ferait synthétiser
 * un faux gras par le navigateur et rabattre Android sur la police système.
 */
const typescale = configureFonts({
  config: {
    displayLarge: { fontFamily: fontFamilies.displayBold, fontWeight: 'normal', letterSpacing: -2 },
    displayMedium: { fontFamily: fontFamilies.displayBold, fontWeight: 'normal', letterSpacing: -1.5 },
    displaySmall: { fontFamily: fontFamilies.displayBold, fontWeight: 'normal', letterSpacing: -1 },
    headlineLarge: { fontFamily: fontFamilies.displayBold, fontWeight: 'normal', letterSpacing: -1 },
    headlineMedium: { fontFamily: fontFamilies.displayBold, fontWeight: 'normal', letterSpacing: -1 },
    headlineSmall: { fontFamily: fontFamilies.displayBold, fontWeight: 'normal', letterSpacing: -0.5 },
    titleLarge: { fontFamily: fontFamilies.displayBold, fontWeight: 'normal', fontSize: 20, lineHeight: 26 },
    titleMedium: { fontFamily: fontFamilies.semiBold, fontWeight: 'normal', letterSpacing: 0 },
    titleSmall: { fontFamily: fontFamilies.semiBold, fontWeight: 'normal', letterSpacing: 0 },
    labelLarge: { fontFamily: fontFamilies.semiBold, fontWeight: 'normal', letterSpacing: 0 },
    labelMedium: { fontFamily: fontFamilies.semiBold, fontWeight: 'normal', letterSpacing: 0 },
    labelSmall: { fontFamily: fontFamilies.medium, fontWeight: 'normal', letterSpacing: 0 },
    bodyLarge: { fontFamily: fontFamilies.regular, fontWeight: 'normal', letterSpacing: 0 },
    bodyMedium: { fontFamily: fontFamilies.regular, fontWeight: 'normal', letterSpacing: 0 },
    bodySmall: { fontFamily: fontFamilies.regular, fontWeight: 'normal', letterSpacing: 0 },
  },
});
const fonts = {
  ...typescale,
  default: { ...typescale.default, fontFamily: fontFamilies.regular, fontWeight: 'normal', letterSpacing: 0 },
} satisfies MD3Theme['fonts'];

/** Paper MD3 arrondit les boutons à 5 × `roundness` : on vise 12 px pour ces contrôles. */
const PAPER_ROUNDNESS = radii.control / 5;

export const lightTheme: AppTheme = {
  ...MD3LightTheme,
  roundness: PAPER_ROUNDNESS,
  fonts,
  colors: {
    ...MD3LightTheme.colors,
    primary: lightBrandColors.action,
    onPrimary: lightBrandColors.onAction,
    primaryContainer: lightBrandColors.actionTint,
    onPrimaryContainer: lightBrandColors.actionPressed,
    inversePrimary: '#A9B8FF',
    secondary: lightBrandColors.inkMuted,
    onSecondary: '#FFFFFF',
    secondaryContainer: lightBrandColors.tile,
    onSecondaryContainer: lightBrandColors.ink,
    tertiary: lightBrandColors.signalText,
    onTertiary: '#FFFFFF',
    tertiaryContainer: lightBrandColors.signalTint,
    onTertiaryContainer: lightBrandColors.signalText,
    error: lightBrandColors.destructive,
    onError: '#FFFFFF',
    errorContainer: '#FEE4E2',
    onErrorContainer: '#7A271A',
    background: lightBrandColors.background,
    onBackground: lightBrandColors.ink,
    surface: lightBrandColors.surface,
    onSurface: lightBrandColors.ink,
    surfaceVariant: lightBrandColors.tile,
    onSurfaceVariant: lightBrandColors.inkMuted,
    surfaceDisabled: 'rgba(14, 17, 22, 0.12)',
    onSurfaceDisabled: 'rgba(14, 17, 22, 0.38)',
    outline: '#8A93A3',
    outlineVariant: lightBrandColors.border,
    inverseSurface: lightBrandColors.ink,
    inverseOnSurface: '#FFFFFF',
    backdrop: 'rgba(14, 17, 22, 0.4)',
    elevation: {
      level0: 'transparent',
      level1: lightBrandColors.surface,
      level2: lightBrandColors.surface,
      level3: lightBrandColors.surface,
      level4: lightBrandColors.surface,
      level5: lightBrandColors.surface,
    },
  },
  brand: { colors: lightBrandColors, radii, fonts: fontFamilies },
};

export const darkTheme: AppTheme = {
  ...MD3DarkTheme,
  roundness: PAPER_ROUNDNESS,
  fonts,
  colors: {
    ...MD3DarkTheme.colors,
    primary: darkBrandColors.action,
    onPrimary: darkBrandColors.onAction,
    primaryContainer: darkBrandColors.actionTint,
    onPrimaryContainer: '#DCE2FF',
    inversePrimary: lightBrandColors.action,
    secondary: darkBrandColors.inkMuted,
    onSecondary: darkBrandColors.background,
    secondaryContainer: darkBrandColors.tile,
    onSecondaryContainer: darkBrandColors.ink,
    tertiary: darkBrandColors.signalText,
    onTertiary: darkBrandColors.onSignal,
    tertiaryContainer: darkBrandColors.signalTint,
    onTertiaryContainer: darkBrandColors.signalText,
    error: darkBrandColors.destructive,
    onError: '#0E1116',
    errorContainer: '#55160C',
    onErrorContainer: '#FECDCA',
    background: darkBrandColors.background,
    onBackground: darkBrandColors.ink,
    surface: darkBrandColors.surface,
    onSurface: darkBrandColors.ink,
    surfaceVariant: darkBrandColors.tile,
    onSurfaceVariant: darkBrandColors.inkMuted,
    surfaceDisabled: 'rgba(242, 244, 247, 0.12)',
    onSurfaceDisabled: 'rgba(242, 244, 247, 0.38)',
    outline: '#7A8394',
    outlineVariant: darkBrandColors.border,
    inverseSurface: darkBrandColors.ink,
    inverseOnSurface: lightBrandColors.ink,
    backdrop: 'rgba(0, 0, 0, 0.6)',
    elevation: {
      level0: 'transparent',
      level1: darkBrandColors.surface,
      level2: '#1A1F27',
      level3: '#1F242D',
      level4: '#222832',
      level5: '#262C37',
    },
  },
  brand: { colors: darkBrandColors, radii, fonts: fontFamilies },
};

export const useAppTheme = () => useTheme<AppTheme>();

export function useBrand(): BrandTokens {
  return useAppTheme().brand;
}

function toNavigationTheme(base: typeof NavLight, paper: AppTheme): typeof NavLight {
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: paper.colors.primary,
      background: paper.colors.background,
      card: paper.colors.surface,
      text: paper.colors.onSurface,
      border: paper.colors.outlineVariant,
      notification: paper.brand.colors.signal,
    },
    fonts: {
      regular: { fontFamily: fontFamilies.regular, fontWeight: 'normal' },
      medium: { fontFamily: fontFamilies.medium, fontWeight: 'normal' },
      bold: { fontFamily: fontFamilies.semiBold, fontWeight: 'normal' },
      heavy: { fontFamily: fontFamilies.displayBold, fontWeight: 'normal' },
    },
  };
}

export const navigationLight = toNavigationTheme(NavLight, lightTheme);
export const navigationDark = toNavigationTheme(NavDark, darkTheme);
