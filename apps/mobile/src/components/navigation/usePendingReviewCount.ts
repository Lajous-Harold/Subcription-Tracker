import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query';

/** Partage la requête du tableau de bord : le badge ne coûte pas d'appel supplémentaire. */
export function usePendingReviewCount(): number {
  const dashboard = useQuery({ queryKey: queryKeys.dashboard, queryFn: api.dashboard });
  return dashboard.data?.pendingCandidates ?? 0;
}
