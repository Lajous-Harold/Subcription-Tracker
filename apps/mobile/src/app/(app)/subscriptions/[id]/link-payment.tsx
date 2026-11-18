import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import type { Transaction } from '@subtracker/contracts';
import { AppButton } from '@/components/AppButton';
import { useToast } from '@/components/toast';
import { EmptyState, ErrorState, FormColumn, controlStyles, Loading, Muted, Panel, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { invalidatePaymentData, queryClient, queryKeys } from '@/lib/query';
import { tabularNums, useBrand } from '@/lib/theme';

function TransactionRow({
  transaction,
  disabled,
  onLink,
}: {
  transaction: Transaction;
  disabled: boolean;
  onLink: () => void;
}) {
  const brand = useBrand();
  const alreadyLinked = Boolean(transaction.subscriptionId);
  const amount = formatMoney(Math.abs(transaction.amountCents), transaction.currency);
  const description = [
    formatDate(transaction.date),
    alreadyLinked ? 'déjà rattachée' : null,
    transaction.coming ? 'à venir' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Rattacher ${transaction.label}, ${amount}, ${description}`}
      accessibilityState={{ disabled: alreadyLinked || disabled }}
      disabled={alreadyLinked || disabled}
      onPress={onLink}
      style={({ pressed }) => [
        linkStyles.row,
        { borderTopColor: brand.colors.border },
        pressed && !alreadyLinked && { backgroundColor: brand.colors.tile },
        alreadyLinked && linkStyles.linked,
      ]}
    >
      <View style={linkStyles.rowText}>
        <Text variant="bodyLarge" numberOfLines={2}>
          {transaction.label}
        </Text>
        <Muted>{description}</Muted>
      </View>
      <Text style={[linkStyles.amount, tabularNums, { fontFamily: brand.fonts.displayBold }]}>{amount}</Text>
    </Pressable>
  );
}

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
  const submitSearch = () => setSubmittedSearch(searchInput.trim());

  return (
    <Screen>
      <FormColumn>
        <TextInput
          mode="outlined"
          outlineStyle={controlStyles.fieldOutline}
          label="Rechercher un libellé"
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmitEditing={submitSearch}
          returnKeyType="search"
          right={<TextInput.Icon icon="magnify" onPress={submitSearch} accessibilityLabel="Lancer la recherche" />}
        />
        <Muted>Seules les opérations de débit importées depuis votre banque apparaissent ici.</Muted>
        {transactions.isLoading ? (
          <Loading />
        ) : transactions.error ? (
          <ErrorState error={transactions.error} onRetry={transactions.refetch} />
        ) : loadedTransactions.length === 0 ? (
          <Panel>
            <EmptyState
              title="Aucune opération"
              description="Connectez votre banque, ou ajoutez un paiement à la main depuis la fiche."
            />
          </Panel>
        ) : (
          <Panel style={linkStyles.list}>
            {loadedTransactions.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                disabled={linkTransaction.isPending}
                onLink={() => linkTransaction.mutate(transaction.id)}
              />
            ))}
            {transactions.hasNextPage ? (
              <AppButton
                variant="secondary"
                style={linkStyles.more}
                onPress={() => transactions.fetchNextPage()}
                loading={transactions.isFetchingNextPage}
              >
                Afficher plus d’opérations
              </AppButton>
            ) : null}
          </Panel>
        )}
      </FormColumn>
    </Screen>
  );
}

const linkStyles = StyleSheet.create({
  list: { paddingHorizontal: 0, paddingVertical: 8, gap: 0, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  linked: { opacity: 0.55 },
  rowText: { flex: 1, gap: 2 },
  amount: { fontSize: 16 },
  more: { marginHorizontal: 20, marginTop: 8, marginBottom: 8 },
});
