import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useReducer, useState } from 'react';
import type { Candidate } from '@subtracker/contracts';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { createDeferredActions } from '@/lib/deferred-actions';
import { formatAccountLabel } from '@/lib/format';
import { errorMessage } from '@/lib/http';
import { invalidateDetectionData, queryKeys } from '@/lib/query';
import {
  acceptBodyFor,
  initialReviewSession,
  reviewProgress,
  reviewSessionReducer,
  visibleCandidates,
  type ReviewDecision,
} from './review-session';

/**
 * File des détections à vérifier, dont les décisions sont différées pour rester annulables.
 *
 * Un candidat décidé disparaît aussitôt ; l'appel part 5 s plus tard, ou dès que l'écran perd le focus.
 * Un envoi en échec remet le candidat dans la file et prévient l'utilisateur.
 */
export function useReviewQueue() {
  const toast = useToast();
  const candidatesQuery = useQuery({ queryKey: queryKeys.candidates, queryFn: () => api.candidates('pending') });
  const [session, dispatch] = useReducer(reviewSessionReducer, initialReviewSession);
  const [deferredDecisions] = useState(() => createDeferredActions());

  useFocusEffect(
    useCallback(
      () => () => {
        void deferredDecisions.flush();
        dispatch({ type: 'visitEnded' });
      },
      [deferredDecisions],
    ),
  );

  async function send(candidate: Candidate, decision: ReviewDecision) {
    dispatch({ type: 'sent', candidateId: candidate.id });
    try {
      if (decision === 'follow') await api.acceptCandidate(candidate.id, acceptBodyFor(candidate));
      else await api.rejectCandidate(candidate.id);
    } catch (error) {
      dispatch({ type: 'restored', candidateId: candidate.id });
      toast.show(`« ${candidate.label} » est de nouveau à vérifier : ${errorMessage(error)}`);
    } finally {
      invalidateDetectionData();
    }
  }

  function decide(candidate: Candidate, decision: ReviewDecision) {
    dispatch({ type: 'decided', decided: { candidateId: candidate.id, label: candidate.label, decision } });
    deferredDecisions.schedule(candidate.id, () => send(candidate, decision));
  }

  /** Renvoie `false` si la décision est déjà partie. */
  function undo(candidateId: string): boolean {
    const cancelled = deferredDecisions.cancel(candidateId);
    if (cancelled) dispatch({ type: 'restored', candidateId });
    return cancelled;
  }

  function undoLast(): string | null {
    const candidateId = deferredDecisions.cancelLast();
    if (candidateId) dispatch({ type: 'restored', candidateId });
    return candidateId;
  }

  const candidates = visibleCandidates(candidatesQuery.data ?? [], session.hiddenIds);
  return {
    candidatesQuery,
    candidates,
    progress: reviewProgress(candidates.length, session.decidedThisVisit),
    undoable: session.undoable,
    decide,
    undo,
    undoLast,
  };
}

export type ReviewQueue = ReturnType<typeof useReviewQueue>;

/** Libellés des comptes bancaires (« Compte courant ••4821 »), pour situer chaque détection. */
export function useAccountNames(): ReadonlyMap<string, string> {
  const accounts = useQuery({ queryKey: queryKeys.bankAccounts, queryFn: api.bankAccounts });
  return new Map((accounts.data ?? []).map((account) => [account.id, formatAccountLabel(account)]));
}
