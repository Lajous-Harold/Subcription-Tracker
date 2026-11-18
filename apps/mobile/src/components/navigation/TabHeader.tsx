import type { BottomTabHeaderProps } from 'expo-router/js-tabs';
import { PageHeader } from './PageHeader';

/** En-tête des onglets : `headerTitle` en fonction remplace le titre (le logo de l'Accueil en compact). */
export function TabHeader({ options, route }: BottomTabHeaderProps) {
  const title = typeof options.headerTitle === 'string' ? options.headerTitle : (options.title ?? route.name);
  return (
    <PageHeader
      title={typeof options.headerTitle === 'function' ? options.headerTitle({ children: title }) : title}
      right={options.headerRight?.({ canGoBack: false })}
    />
  );
}
