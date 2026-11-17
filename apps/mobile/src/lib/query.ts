import { QueryClient } from '@tanstack/react-query';
import type { SubscriptionDetail } from '@subtracker/contracts';
import { ApiError } from './http';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => !(error instanceof ApiError && error.status < 500) && failureCount < 2,
    },
  },
});

export const queryKeys = {
  dashboard: ['dashboard'] as const,
  subscriptions: ['subscriptions'] as const,
  subscription: (id: string) => ['subscriptions', id] as const,
  payments: (id: string) => ['subscriptions', id, 'payments'] as const,
  providers: (q?: string) => ['providers', q ?? ''] as const,
  provider: (slug: string | undefined) => ['provider', slug] as const,
  candidates: ['candidates'] as const,
  bank: ['bank'] as const,
  bankLink: ['bank', 'link'] as const,
  bankAccounts: ['bank', 'accounts'] as const,
  allTransactions: ['transactions'] as const,
  transactions: (q?: string) => ['transactions', q ?? ''] as const,
};

export function invalidateSubscriptionData(id?: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
  if (id) void queryClient.invalidateQueries({ queryKey: queryKeys.subscription(id) });
}

export function storeUpdatedSubscription(updated: SubscriptionDetail) {
  queryClient.setQueryData(queryKeys.subscription(updated.id), updated);
  invalidateSubscriptionData(updated.id);
}

export function invalidatePaymentData(subscriptionId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.payments(subscriptionId) });
  invalidateSubscriptionData(subscriptionId);
}

export function invalidateDetectionData() {
  void queryClient.invalidateQueries({ queryKey: queryKeys.candidates });
  invalidateSubscriptionData();
}

export function invalidateBankData() {
  void queryClient.invalidateQueries({ queryKey: queryKeys.bank });
  invalidateDetectionData();
}
