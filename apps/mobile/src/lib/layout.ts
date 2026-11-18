import { useWindowDimensions } from 'react-native';

export type LayoutMode = 'compact' | 'wide';

/** Décidé sur la largeur seule, jamais sur la plateforme : Safari sur iPhone reste en `compact`. */
export const WIDE_LAYOUT_MIN_WIDTH = 1024;

export function layoutModeForWidth(width: number): LayoutMode {
  return width >= WIDE_LAYOUT_MIN_WIDTH ? 'wide' : 'compact';
}

export function useLayoutMode(): LayoutMode {
  const { width } = useWindowDimensions();
  return layoutModeForWidth(width);
}
