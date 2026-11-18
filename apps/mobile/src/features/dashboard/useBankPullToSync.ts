import { useState } from 'react';
import type { BankLink } from '@subtracker/contracts';
import { useToast } from '@/components/toast';
import { useBankLink } from '@/features/bank/useBankLink';
import { api } from '@/lib/api';
import { queryClient, queryKeys } from '@/lib/query';

export interface BankPullToSync {
  /** Banque liée et lisible : le rafraîchissement lance alors une synchronisation. */
  linkedBank: BankLink | null;
  syncing: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
}

export function useBankPullToSync(refetchDashboard: () => Promise<unknown>): BankPullToSync {
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const { bankLinkQuery, linkedBank, syncing } = useBankLink();

  async function refresh() {
    setRefreshing(true);
    try {
      if (linkedBank) {
        try {
          queryClient.setQueryData(queryKeys.bankLink, await api.syncBank());
        } catch (error) {
          toast.showError(error);
        }
        await refetchDashboard();
      } else {
        await Promise.all([refetchDashboard(), bankLinkQuery.refetch()]);
      }
    } finally {
      setRefreshing(false);
    }
  }

  return { linkedBank, syncing, refreshing, refresh };
}
