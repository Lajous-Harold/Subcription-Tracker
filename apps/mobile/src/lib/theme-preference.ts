import { useState } from 'react';
import { Platform, useColorScheme } from 'react-native';

type ThemePreference = 'light' | 'dark' | 'auto';

const THEME_STORAGE_KEY = 'abo.theme';
const THEME_QUERY_PARAM = 'theme';

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'auto';
}

/**
 * Sur le web, `?theme=light|dark` force le thème (comparaison aux maquettes, démonstration) et reste mémorisé ;
 * `?theme=auto` rend la main au système. Le stockage peut être indisponible (navigation privée) : on l'ignore alors.
 */
function readWebThemePreference(): ThemePreference {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'auto';
  const requested = new URLSearchParams(window.location.search).get(THEME_QUERY_PARAM);
  try {
    if (isThemePreference(requested)) {
      if (requested === 'auto') window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, requested);
      return requested;
    }
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'auto';
  } catch {
    return isThemePreference(requested) ? requested : 'auto';
  }
}

export function useIsDarkTheme(): boolean {
  const systemScheme = useColorScheme();
  const [preference] = useState(readWebThemePreference);
  return preference === 'auto' ? systemScheme === 'dark' : preference === 'dark';
}
