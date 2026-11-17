import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, Card, List, Searchbar, Text } from 'react-native-paper';
import { useToast } from '@/components/toast';
import { EmptyState, ErrorState, Loading, Muted, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { invalidatePaymentData, queryClient, queryKeys } from '@/lib/query';

export default function LinkPaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const [searchInput, setSearchInput] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');

  const transactions = useInfiniteQuery({
    queryKey: queryKeys.transactions(submittedSearch),
    queryFn: ({ pageParam }) => api.transactions({ q: submittedSearch || undefined, cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const linkTransaction = useMutation({
    mutationFn: (transactionId: string) => api.linkTransaction(id, transactionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.allTransactions });
      invalidatePaymentData(id);
      toast.show('Opération rattachée');
      router.back();
    },
    onError: toast.showError,
  });

  const loadedTransactions = transactions.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Screen>
      <Searchbar
        placeholder="Rechercher un libellé"
        value={searchInput}
        onChangeText={setSearchInput}
        onSubmitEditing={() => setSubmittedSearch(searchInput.trim())}
        onIconPress={() => setSubmittedSearch(searchInput.trim())}
      />
      <Muted>Seules les opérations de débit importées depuis votre banque apparaissent ici.</Muted>
      {transactions.isLoading ? (
        <Loading />
      ) : transactions.error ? (
        <ErrorState error={transactions.error} onRetry={transactions.refetch} />
      ) : loadedTransactions.length === 0 ? (
        <Card>
          <EmptyState title="Aucune opération" description="Connectez votre banque ou utilisez « Paiement manuel »." />
        </Card>
      ) : (
        <Card>
          {loadedTransactions.map((tx) => (
            <List.Item
              key={tx.id}
              title={tx.label}
              titleNumberOfLines={2}
              description={`${formatDate(tx.date)}${tx.subscriptionId ? ' · déjà rattachée' : ''}${tx.coming ? ' · à venir' : ''}`}
              disabled={Boolean(tx.subscriptionId) || linkTransaction.isPending}
              onPress={() => linkTransaction.mutate(tx.id)}
              right={() => <Text variant="titleSmall">{formatMoney(Math.abs(tx.amountCents), tx.currency)}</Text>}
            />
          ))}
          {transactions.hasNextPage ? (
            <Card.Actions>
              <Button onPress={() => transactions.fetchNextPage()} loading={transactions.isFetchingNextPage}>
                Plus d’opérations
              </Button>
            </Card.Actions>
          ) : null}
        </Card>
      )}
    </Screen>
  );
}
