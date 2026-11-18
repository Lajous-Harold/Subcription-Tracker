import { useWindowDimensions } from 'react-native';

export type LayoutMode = 'compact' | 'wide';

/** Décidé sur la largeur seule, jamais sur la plateforme : Safari sur iPhone reste en `compact`. */
const WIDE_LAYOUT_MIN_WIDTH = 1024;

function layoutModeForWidth(width: number): LayoutMode {
  return width >= WIDE_LAYOUT_MIN_WIDTH ? 'wide' : 'compact';
}

export function useLayoutMode(): LayoutMode {
  const { width } = useWindowDimensions();
  return layoutModeForWidth(width);
}

/** Marge latérale des pages en mode large, comme `clamp(16px, 3vw, 48px)` dans les maquettes. */
export function useWidePageGutter(): number {
  const { width } = useWindowDimensions();
  return Math.min(48, Math.max(16, Math.round(width * 0.03)));
}
