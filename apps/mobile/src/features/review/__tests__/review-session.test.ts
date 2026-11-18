import { describe, expect, it } from '@jest/globals';
import type { Candidate } from '@subtracker/contracts';
import {
  acceptBodyFor,
  candidateAfter,
  decisionMessage,
  describeCandidateSource,
  describeHiddenOperations,
  describeOperationsLink,
  initialReviewSession,
  reviewProgress,
  reviewSessionReducer,
  shortcutForKey,
  swipeDecision,
  visibleCandidates,
  type ReviewSessionState,
  type ShortcutKeyEvent,
} from '../review-session';

function candidate(id: string): Candidate {
  return { id, label: id } as Candidate;
}

const disney = { candidateId: 'disney', label: 'Disney+', decision: 'follow' } as const;
const journal = { candidateId: 'journal', label: 'Le Journal', decision: 'ignore' } as const;

function decide(...decisions: (typeof disney | typeof journal)[]): ReviewSessionState {
  return decisions.reduce(
    (state, decided) => reviewSessionReducer(state, { type: 'decided', decided }),
    initialReviewSession,
  );
}

describe('reviewSessionReducer', () => {
  it('masque le candidat décidé et le propose à l’annulation', () => {
    const state = decide(disney);
    expect(state.hiddenIds).toEqual(['disney']);
    expect(state.decidedThisVisit).toBe(1);
    expect(state.undoable).toEqual(disney);
  });

  it('remet à sa place un candidat annulé et retire le bandeau qui le concernait', () => {
    const state = reviewSessionReducer(decide(journal, disney), { type: 'restored', candidateId: 'disney' });
    expect(state.hiddenIds).toEqual(['journal']);
    expect(state.decidedThisVisit).toBe(1);
    expect(state.undoable).toBeNull();
  });

  it('garde le bandeau de la dernière décision quand une décision plus ancienne échoue', () => {
    const state = reviewSessionReducer(decide(journal, disney), { type: 'restored', candidateId: 'journal' });
    expect(state.undoable).toEqual(disney);
  });

  it('ne change rien quand le candidat restauré n’était pas masqué', () => {
    const state = decide(disney);
    expect(reviewSessionReducer(state, { type: 'restored', candidateId: 'inconnu' })).toBe(state);
  });

  it('retire le bandeau une fois la décision envoyée, sans réafficher le candidat', () => {
    const state = reviewSessionReducer(decide(disney), { type: 'sent', candidateId: 'disney' });
    expect(state.undoable).toBeNull();
    expect(state.hiddenIds).toEqual(['disney']);
  });

  it('remet la progression à zéro en quittant l’écran, sans réafficher les candidats décidés', () => {
    const state = reviewSessionReducer(decide(disney, journal), { type: 'visitEnded' });
    expect(state).toEqual({ hiddenIds: ['disney', 'journal'], decidedThisVisit: 0, undoable: null });
  });
});

describe('visibleCandidates et reviewProgress', () => {
  it('garde l’ordre d’origine sans les candidats masqués', () => {
    const list = [candidate('a'), candidate('b'), candidate('c')];
    expect(visibleCandidates(list, ['b']).map((item) => item.id)).toEqual(['a', 'c']);
  });

  it('compte les décisions de la visite dans la progression', () => {
    expect(reviewProgress(2, 1)).toEqual({ position: 2, total: 3 });
  });
});

describe('candidateAfter', () => {
  const list = [candidate('a'), candidate('b'), candidate('c')];

  it('passe au suivant', () => {
    expect(candidateAfter(list, 'b')?.id).toBe('c');
  });

  it('revient au précédent après le dernier', () => {
    expect(candidateAfter(list, 'c')?.id).toBe('b');
  });

  it('ne renvoie rien quand la liste ne contenait que lui', () => {
    expect(candidateAfter([candidate('a')], 'a')).toBeNull();
  });
});

describe('acceptBodyFor', () => {
  it('n’envoie aucune valeur, pour qu’elles restent observées', () => {
    expect(acceptBodyFor({ suggestedSubscriptionId: null })).toEqual({});
  });

  it('rattache à l’abonnement existant suggéré', () => {
    expect(acceptBodyFor({ suggestedSubscriptionId: 'sub-1' })).toEqual({ mergeIntoSubscriptionId: 'sub-1' });
  });
});

describe('decisionMessage', () => {
  it('nomme le candidat et la décision', () => {
    expect(decisionMessage(disney)).toBe('« Disney+ » suivi');
    expect(decisionMessage(journal)).toBe('« Le Journal » ignoré');
  });
});

describe('shortcutForKey', () => {
  const press = (key: string, overrides: Partial<ShortcutKeyEvent> = {}): ShortcutKeyEvent => ({
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    repeat: false,
    targetIsEditable: false,
    ...overrides,
  });

  it('associe C à suivre et I à ignorer, majuscules comprises', () => {
    expect(shortcutForKey(press('c'))).toBe('follow');
    expect(shortcutForKey(press('I'))).toBe('ignore');
  });

  it('annule avec Ctrl+Z ou Cmd+Z', () => {
    expect(shortcutForKey(press('z', { ctrlKey: true }))).toBe('undo');
    expect(shortcutForKey(press('z', { metaKey: true }))).toBe('undo');
  });

  it('ignore la saisie dans un champ, la répétition et les combinaisons', () => {
    expect(shortcutForKey(press('c', { targetIsEditable: true }))).toBeNull();
    expect(shortcutForKey(press('z', { ctrlKey: true, targetIsEditable: true }))).toBeNull();
    expect(shortcutForKey(press('c', { repeat: true }))).toBeNull();
    expect(shortcutForKey(press('c', { ctrlKey: true }))).toBeNull();
    expect(shortcutForKey(press('i', { altKey: true }))).toBeNull();
    expect(shortcutForKey(press('z'))).toBeNull();
  });
});

describe('swipeDecision', () => {
  const width = 360;

  it('valide au-delà de 35 % de la largeur, dans le sens du glissement', () => {
    expect(swipeDecision(130, 0, width)).toBe('follow');
    expect(swipeDecision(-130, 0, width)).toBe('ignore');
  });

  it('ramène la carte en deçà du seuil', () => {
    expect(swipeDecision(120, 0, width)).toBeNull();
  });

  it('valide un lancer rapide avant le seuil', () => {
    expect(swipeDecision(60, 1200, width)).toBe('follow');
    expect(swipeDecision(-60, -1200, width)).toBe('ignore');
  });

  it('annule quand la carte est relancée vers le centre', () => {
    expect(swipeDecision(200, -1200, width)).toBeNull();
  });

  it('ne valide pas un simple effleurement rapide', () => {
    expect(swipeDecision(10, 1200, width)).toBeNull();
  });
});

describe('libellés des opérations et de la provenance', () => {
  it('annonce le nombre d’opérations du lien vers le détail', () => {
    expect(describeOperationsLink(6)).toBe('Voir les 6 opérations');
    expect(describeOperationsLink(1)).toBe('Voir l’opération');
    expect(describeOperationsLink(0)).toBe('Voir le détail');
  });

  it('compte les opérations repliées', () => {
    expect(describeHiddenOperations(1)).toBe('+ 1 autre');
    expect(describeHiddenOperations(4)).toBe('+ 4 autres');
  });

  it('situe une détection par son compte puis par la reconnaissance du fournisseur', () => {
    const provider = { id: 'disney', slug: 'disney-plus', name: 'Disney+' } as Candidate['provider'];
    expect(describeCandidateSource({ provider }, 'Compte courant ••4821')).toBe(
      'Compte courant ••4821 · reconnu dans le catalogue',
    );
    expect(describeCandidateSource({ provider: null }, undefined)).toBe('fournisseur non reconnu');
  });
});
