import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, Card, List, Searchbar, Text } from 'react-native-paper';
import { useToast } from '@/components/toast';
import { EmptyState, ErrorState, Loading, Muted, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { errorMessage } from '@/lib/http';
import { invalidateSubscriptionData, keys, queryClient } from '@/lib/query';

/** Rattacher manuellement une opération bancaire que la détection n'a pas associée. */
export default function LinkPaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  const transactions = useInfiniteQuery({
    queryKey: keys.transactions(q),
    queryFn: ({ pageParam }) => api.transactions({ q: q || undefined, cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const link = useMutation({
    mutationFn: (transactionId: string) => api.linkTransaction(id, transactionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.payments(id) });
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      invalidateSubscriptionData(id);
      toast.show('Opération rattachée');
      router.back();
    },
    onError: (error) => toast.show(errorMessage(error)),
  });

  const items = transactions.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Screen>
      <Searchbar
        placeholder="Rechercher un libellé"
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={() => setQ(search.trim())}
        onIconPress={() => setQ(search.trim())}
      />
      <Muted>Seules les opérations de débit importées depuis votre banque apparaissent ici.</Muted>
      {transactions.isLoading ? (
        <Loading />
      ) : transactions.error ? (
        <ErrorState error={transactions.error} onRetry={transactions.refetch} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState title="Aucune opération" description="Connectez votre banque ou utilisez « Paiement manuel »." />
        </Card>
      ) : (
        <Card>
          {items.map((tx) => (
            <List.Item
              key={tx.id}
              title={tx.label}
              titleNumberOfLines={2}
              description={`${formatDate(tx.date)}${tx.subscriptionId ? ' · déjà rattachée' : ''}${tx.coming ? ' · à venir' : ''}`}
              disabled={Boolean(tx.subscriptionId) || link.isPending}
              onPress={() => link.mutate(tx.id)}
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
