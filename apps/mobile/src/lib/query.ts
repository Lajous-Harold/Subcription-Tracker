import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './http';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => !(error instanceof ApiError && error.status < 500) && failureCount < 2,
    },
  },
});

/** Clés de cache centralisées pour invalider précisément après une mutation. */
export const keys = {
  dashboard: ['dashboard'] as const,
  subscriptions: ['subscriptions'] as const,
  subscription: (id: string) => ['subscriptions', id] as const,
  payments: (id: string) => ['subscriptions', id, 'payments'] as const,
  providers: (q?: string) => ['providers', q ?? ''] as const,
  candidates: ['candidates'] as const,
  bankLink: ['bank', 'link'] as const,
  bankAccounts: ['bank', 'accounts'] as const,
  transactions: (q?: string) => ['transactions', q ?? ''] as const,
};

/** Après toute modification d'abonnement : liste, détail, tableau de bord. */
export function invalidateSubscriptionData(id?: string) {
  void queryClient.invalidateQueries({ queryKey: keys.subscriptions });
  void queryClient.invalidateQueries({ queryKey: keys.dashboard });
  if (id) void queryClient.invalidateQueries({ queryKey: keys.subscription(id) });
}

export function invalidateDetectionData() {
  void queryClient.invalidateQueries({ queryKey: keys.candidates });
  invalidateSubscriptionData();
}
