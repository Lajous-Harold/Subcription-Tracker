import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, FAB, List, SegmentedButtons, Text } from 'react-native-paper';
import type { Subscription, SubscriptionStatus } from '@subtracker/contracts';
import { EmptyState, ErrorState, Loading, Muted, OriginChip, Screen, styles } from '@/components/ui';
import { api } from '@/lib/api';
import { formatMoney, formatShortDate } from '@/lib/format';
import { keys } from '@/lib/query';

type Filter = 'tracked' | 'cancelled' | 'archived';

const FILTERS: Record<Filter, SubscriptionStatus[]> = {
  tracked: ['active', 'cancellation_pending'],
  cancelled: ['cancelled'],
  archived: ['archived'],
};

function describe(sub: Subscription): string {
  const parts = [sub.provider?.name ?? sub.customProviderName ?? 'Fournisseur non renseigné'];
  if (sub.status === 'cancellation_pending') parts.push('Résiliation en cours');
  else if (sub.nextDueDate) parts.push(`Prochaine échéance ${formatShortDate(sub.nextDueDate.value)}`);
  return parts.join(' · ');
}

export default function SubscriptionsScreen() {
  const [filter, setFilter] = useState<Filter>('tracked');
  const { data, error, isLoading, refetch, isRefetching } = useQuery({
    queryKey: keys.subscriptions,
    queryFn: () => api.subscriptions(),
  });

  const items = (data ?? []).filter((sub) => FILTERS[filter].includes(sub.status));

  return (
    <View style={{ flex: 1 }}>
      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <Screen refreshing={isRefetching} onRefresh={refetch}>
          <SegmentedButtons
            value={filter}
            onValueChange={(value) => setFilter(value as Filter)}
            buttons={[
              { value: 'tracked', label: 'Suivis' },
              { value: 'cancelled', label: 'Résiliés' },
              { value: 'archived', label: 'Archivés' },
            ]}
          />
          <Button
            mode="text"
            icon="magnify-scan"
            onPress={() => router.push('/candidates')}
            style={{ alignSelf: 'flex-start' }}
          >
            Abonnements détectés à vérifier
          </Button>
          {items.length === 0 ? (
            <Card>
              <EmptyState
                title={filter === 'tracked' ? 'Aucun abonnement suivi' : 'Rien ici pour le moment'}
                description={
                  filter === 'tracked' ? 'Ajoutez-en un avec le bouton +, ou connectez votre banque.' : undefined
                }
              />
            </Card>
          ) : (
            <Card>
              {items.map((sub) => (
                <List.Item
                  key={sub.id}
                  title={sub.label}
                  description={describe(sub)}
                  descriptionNumberOfLines={2}
                  onPress={() => router.push(`/subscriptions/${sub.id}`)}
                  left={(props) => (
                    <List.Icon
                      {...props}
                      icon={sub.paymentMissing ? 'calendar-alert' : sub.bankLinked ? 'bank-check' : 'pencil-outline'}
                    />
                  )}
                  right={() => (
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text variant="titleMedium">
                        {formatMoney(sub.amount.value.cents, sub.amount.value.currency)}
                      </Text>
                      <OriginChip origin={sub.amount.origin} />
                    </View>
                  )}
                />
              ))}
            </Card>
          )}
          <View style={styles.row}>
            <List.Icon icon="bank-check" />
            <Muted>Lié à la banque</Muted>
            <List.Icon icon="pencil-outline" />
            <Muted>Déclaré à la main</Muted>
            <List.Icon icon="calendar-alert" />
            <Muted>Paiement non observé</Muted>
          </View>
        </Screen>
      )}
      <FAB
        icon="plus"
        label="Ajouter"
        style={{ position: 'absolute', right: 16, bottom: 16 }}
        onPress={() => router.push('/subscriptions/new')}
        accessibilityLabel="Ajouter un abonnement"
      />
    </View>
  );
}
