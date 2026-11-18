import { router, type Href } from 'expo-router';

/**
 * Quitte l'écran après une action. Ouvert sans historique (lien direct, rafraîchissement sur le web),
 * `router.back()` ne ferait rien : on remplace alors l'écran par son parent.
 */
export function leaveTo(parent: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(parent);
}
