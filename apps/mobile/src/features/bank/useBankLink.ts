import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { invalidateBankData, queryKeys } from '@/lib/query';
import { isSyncing } from './bank-display';

const SYNC_POLL_INTERVAL_MS = 3000;

/**
 * La synchronisation est asynchrone côté API (202) : on suit le lien bancaire tant qu'elle tourne,
 * puis on invalide les données qui en dépendent (accueil, abonnements, détections).
 */
export function useBankLink() {
  const bankLinkQuery = useQuery({
    queryKey: queryKeys.bankLink,
    queryFn: api.bankLink,
    refetchInterval: (query) => (isSyncing(query.state.data) ? SYNC_POLL_INTERVAL_MS : false),
  });
  const syncing = isSyncing(bankLinkQuery.data);

  const wasSyncing = useRef(syncing);
  useEffect(() => {
    if (wasSyncing.current && !syncing) invalidateBankData();
    wasSyncing.current = syncing;
  }, [syncing]);

  const bankLink = bankLinkQuery.data ?? null;
  /** Banque liée et lisible : une déconnexion laisse le lien en base, au statut `disconnected`. */
  const linkedBank = bankLink && bankLink.status !== 'disconnected' ? bankLink : null;
  return { bankLinkQuery, bankLink, linkedBank, syncing };
}
