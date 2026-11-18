import type { AcceptCandidateBody, Candidate } from '@subtracker/contracts';

export type ReviewDecision = 'follow' | 'ignore';

export interface DecidedCandidate {
  candidateId: string;
  label: string;
  decision: ReviewDecision;
}

export interface ReviewSessionState {
  /** Candidats décidés, en attente d'envoi ou envoyés : masqués jusqu'à ce que la liste rechargée ne les contienne plus. */
  hiddenIds: string[];
  decidedThisVisit: number;
  /** Décision que le bandeau « Annuler » permet encore de reprendre. */
  undoable: DecidedCandidate | null;
}

export type ReviewSessionEvent =
  | { type: 'decided'; decided: DecidedCandidate }
  | { type: 'restored'; candidateId: string }
  | { type: 'sent'; candidateId: string }
  | { type: 'visitEnded' };

export const initialReviewSession: ReviewSessionState = { hiddenIds: [], decidedThisVisit: 0, undoable: null };

function clearUndoableIf(undoable: DecidedCandidate | null, candidateId: string): DecidedCandidate | null {
  return undoable?.candidateId === candidateId ? null : undoable;
}

export function reviewSessionReducer(state: ReviewSessionState, event: ReviewSessionEvent): ReviewSessionState {
  switch (event.type) {
    case 'decided':
      return {
        hiddenIds: [...state.hiddenIds.filter((id) => id !== event.decided.candidateId), event.decided.candidateId],
        decidedThisVisit: state.decidedThisVisit + 1,
        undoable: event.decided,
      };
    case 'restored':
      if (!state.hiddenIds.includes(event.candidateId)) return state;
      return {
        hiddenIds: state.hiddenIds.filter((id) => id !== event.candidateId),
        decidedThisVisit: Math.max(0, state.decidedThisVisit - 1),
        undoable: clearUndoableIf(state.undoable, event.candidateId),
      };
    case 'sent':
      return { ...state, undoable: clearUndoableIf(state.undoable, event.candidateId) };
    case 'visitEnded':
      return { ...state, decidedThisVisit: 0, undoable: null };
  }
}

export function visibleCandidates(candidates: readonly Candidate[], hiddenIds: readonly string[]): Candidate[] {
  return candidates.filter((candidate) => !hiddenIds.includes(candidate.id));
}

export interface ReviewProgress {
  position: number;
  total: number;
}

export function reviewProgress(remainingCount: number, decidedThisVisit: number): ReviewProgress {
  return { position: decidedThisVisit + 1, total: decidedThisVisit + remainingCount };
}

/** Candidat à sélectionner une fois `decidedId` traité : le suivant, sinon le précédent. */
export function candidateAfter(candidates: readonly Candidate[], decidedId: string): Candidate | null {
  const index = candidates.findIndex((candidate) => candidate.id === decidedId);
  if (index === -1) return candidates[0] ?? null;
  return candidates[index + 1] ?? candidates[index - 1] ?? null;
}

/**
 * Suivre sans retouche n'envoie aucune valeur : chaque champ fourni passerait en « Déclaré »
 * et ne suivrait plus les paiements observés.
 */
export function acceptBodyFor(candidate: Pick<Candidate, 'suggestedSubscriptionId'>): AcceptCandidateBody {
  return candidate.suggestedSubscriptionId ? { mergeIntoSubscriptionId: candidate.suggestedSubscriptionId } : {};
}

const DECISION_PAST_PARTICIPLES: Record<ReviewDecision, string> = { follow: 'suivi', ignore: 'ignoré' };

export function decisionMessage({ label, decision }: Pick<DecidedCandidate, 'label' | 'decision'>): string {
  return `« ${label} » ${DECISION_PAST_PARTICIPLES[decision]}`;
}

export function describeOperationsLink(operationCount: number): string {
  if (operationCount === 0) return 'Voir le détail';
  return operationCount === 1 ? 'Voir l’opération' : `Voir les ${operationCount} opérations`;
}

export function describeHiddenOperations(hiddenCount: number): string {
  return hiddenCount === 1 ? '+ 1 autre' : `+ ${hiddenCount} autres`;
}

export function describeCandidateSource(
  candidate: Pick<Candidate, 'provider'>,
  accountName: string | undefined,
): string {
  const origin = candidate.provider ? 'reconnu dans le catalogue' : 'fournisseur non reconnu';
  return [accountName, origin].filter(Boolean).join(' · ');
}

export type ReviewShortcut = ReviewDecision | 'undo';

export interface ShortcutKeyEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat: boolean;
  targetIsEditable: boolean;
}

export function shortcutForKey(event: ShortcutKeyEvent): ReviewShortcut | null {
  if (event.targetIsEditable || event.repeat || event.altKey) return null;
  const key = event.key.toLowerCase();
  if (event.ctrlKey || event.metaKey) return key === 'z' ? 'undo' : null;
  if (key === 'c') return 'follow';
  if (key === 'i') return 'ignore';
  return null;
}

export const SWIPE_ACTIVATION_DISTANCE = 15;
export const SWIPE_VERTICAL_TOLERANCE = 12;
export const SWIPE_COMMIT_WIDTH_RATIO = 0.35;
const FLING_MIN_VELOCITY = 800;
const FLING_MIN_DISTANCE = 40;

/** Exécuté dans le thread d'interface au relâchement de la carte. */
export function swipeDecision(translationX: number, velocityX: number, cardWidth: number): ReviewDecision | null {
  'worklet';
  const direction = Math.sign(translationX);
  const fastEnough = Math.abs(velocityX) >= FLING_MIN_VELOCITY;
  const flungBack = fastEnough && Math.sign(velocityX) === -direction;
  const passedThreshold = Math.abs(translationX) >= cardWidth * SWIPE_COMMIT_WIDTH_RATIO;
  const flung = fastEnough && Math.abs(translationX) >= FLING_MIN_DISTANCE && Math.sign(velocityX) === direction;
  if (direction === 0 || flungBack || !(passedThreshold || flung)) return null;
  return direction > 0 ? 'follow' : 'ignore';
}
