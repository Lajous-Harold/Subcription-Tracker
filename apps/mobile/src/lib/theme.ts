import { DarkTheme as NavDark, DefaultTheme as NavLight } from 'expo-router';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

const brand = {
  light: { primary: '#3949AB', secondary: '#00897B', tertiary: '#8E24AA' },
  dark: { primary: '#9FA8DA', secondary: '#80CBC4', tertiary: '#CE93D8' },
};

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: { ...MD3LightTheme.colors, ...brand.light },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: { ...MD3DarkTheme.colors, ...brand.dark },
};

/** Thème de navigation dérivé des couleurs Paper (en-têtes, barre d'onglets). */
function navigationFrom(base: typeof NavLight, paper: MD3Theme): typeof NavLight {
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: paper.colors.primary,
      background: paper.colors.background,
      card: paper.colors.elevation.level2,
      text: paper.colors.onSurface,
      border: paper.colors.outlineVariant,
      notification: paper.colors.error,
    },
  };
}

export const navigationLight = navigationFrom(NavLight, lightTheme);
export const navigationDark = navigationFrom(NavDark, darkTheme);

/** Couleurs sémantiques des provenances, cohérentes partout dans l'application. */
export const originColors = {
  observed: { light: '#E0F2F1', dark: '#004D40' },
  declared: { light: '#E8EAF6', dark: '#283593' },
  estimated: { light: '#FFF3E0', dark: '#5D4037' },
} as const;
