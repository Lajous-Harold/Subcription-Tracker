import { describe, expect, it } from '@jest/globals';
import { stackParentHref } from '../stack-parent';

describe('stackParentHref', () => {
  it('ramène la fiche d’un abonnement à la liste', () => {
    expect(stackParentHref('subscriptions/[id]/index', { id: 'abc' })).toBe('/subscriptions');
  });

  it.each(['edit', 'cancel', 'link-payment'])('ramène l’écran %s à la fiche de son abonnement', (screen) => {
    expect(stackParentHref(`subscriptions/[id]/${screen}`, { id: 'abc' })).toBe('/subscriptions/abc');
  });

  it('se rabat sur la liste quand l’identifiant manque', () => {
    expect(stackParentHref('subscriptions/[id]/edit', {})).toBe('/subscriptions');
  });

  it('ramène la création d’un abonnement à la liste', () => {
    expect(stackParentHref('subscriptions/new', undefined)).toBe('/subscriptions');
  });

  it('ramène une détection à la file « À vérifier »', () => {
    expect(stackParentHref('candidates/[id]', { id: 'abc' })).toBe('/review');
  });

  it('ramène le retour de connexion bancaire à l’écran Banque', () => {
    expect(stackParentHref('powens/callback', undefined)).toBe('/bank');
  });

  it('ramène un écran inconnu au tableau de bord', () => {
    expect(stackParentHref('inconnu', undefined)).toBe('/');
  });
});
