import type { Href } from 'expo-router';

/**
 * Parent logique d'un écran de pile, pour le retour quand la pile n'a pas d'historique : un rafraîchissement
 * ou un lien direct sur le web ouvre l'écran seul, sans la barre d'onglets en mode compact.
 */
export function stackParentHref(routeName: string, params: object | undefined): Href {
  const id = params && 'id' in params && typeof params.id === 'string' ? params.id : undefined;
  switch (routeName) {
    case 'subscriptions/[id]/edit':
    case 'subscriptions/[id]/cancel':
    case 'subscriptions/[id]/link-payment':
      return id ? `/subscriptions/${encodeURIComponent(id)}` : '/subscriptions';
    case 'subscriptions/[id]/index':
    case 'subscriptions/new':
      return '/subscriptions';
    case 'candidates/[id]':
      return '/review';
    case 'powens/callback':
      return '/bank';
    default:
      return '/';
  }
}
