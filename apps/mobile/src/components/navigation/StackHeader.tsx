import { router, type NativeStackHeaderProps } from 'expo-router';
import { Platform } from 'react-native';
import { useBrand } from '@/lib/theme';
import { PageHeader } from './PageHeader';
import { stackParentHref } from './stack-parent';

/**
 * En-tête des écrans de pile. Le retour est toujours présent : sans historique (rafraîchissement, lien direct),
 * il remplace l'écran par son parent logique plutôt que de laisser l'utilisateur sans issue.
 */
export function StackHeader({ back, navigation, options, route }: NativeStackHeaderProps) {
  const brand = useBrand();
  const goBack = () => {
    if (back) navigation.goBack();
    else router.replace(stackParentHref(route.name, route.params));
  };
  const title = typeof options.headerTitle === 'string' ? options.headerTitle : (options.title ?? '');

  return (
    <PageHeader
      title={typeof options.headerTitle === 'function' ? options.headerTitle({ children: title }) : title}
      right={options.headerRight?.({ canGoBack: true, tintColor: brand.colors.ink })}
      onBack={goBack}
      ignoresTopInset={Platform.OS === 'ios' && options.presentation === 'modal'}
    />
  );
}
