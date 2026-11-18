import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import { AppButton } from '@/components/AppButton';
import { ErrorState, Loading, Muted, Panel, Screen } from '@/components/ui';
import { ADD_SUBSCRIPTION_LABEL, openNewSubscription } from '@/features/subscriptions-list/add-subscription';
import { filterSubscriptions, type StatusFilter } from '@/features/subscriptions-list/filters';
import { SubscriptionList } from '@/features/subscriptions-list/SubscriptionRows';
import {
  NoSubscriptions,
  OBSERVATION_DISCLAIMER,
  SubscriptionsTablePanel,
} from '@/features/subscriptions-list/SubscriptionsTablePanel';
import { api } from '@/lib/api';
import { useLayoutMode } from '@/lib/layout';
import { queryKeys } from '@/lib/query';

/** Paper n'annonce pas le libellé visible de ses boutons segmentés sur le web : il est repris en nom accessible. */
const STATUS_FILTER_LABELS: [StatusFilter, string][] = [
  ['tracked', 'Suivis'],
  ['cancelled', 'Résiliés'],
  ['archived', 'Archivés'],
];

function StatusFilterButtons({ value, onChange }: { value: StatusFilter; onChange: (value: StatusFilter) => void }) {
  return (
    <SegmentedButtons
      value={value}
      onValueChange={(next) => onChange(next as StatusFilter)}
      buttons={STATUS_FILTER_LABELS.map(([filter, label]) => ({ value: filter, label, accessibilityLabel: label }))}
    />
  );
}

export default function SubscriptionsScreen() {
  const layoutMode = useLayoutMode();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('tracked');
  const { data, error, isLoading, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.subscriptions,
    queryFn: () => api.subscriptions(),
  });

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  const isWide = layoutMode === 'wide';
  if (isWide) {
    return (
      <Screen refreshing={isRefetching} onRefresh={refetch}>
        <SubscriptionsTablePanel
          subscriptions={data}
          statusFilter={statusFilter}
          heading={
            <View style={styles.filters}>
              <StatusFilterButtons value={statusFilter} onChange={setStatusFilter} />
            </View>
          }
        />
      </Screen>
    );
  }

  const items = filterSubscriptions(data, statusFilter);
  return (
    <View style={styles.fill}>
      <Screen refreshing={isRefetching} onRefresh={refetch}>
        <StatusFilterButtons value={statusFilter} onChange={setStatusFilter} />
        {items.length === 0 ? (
          <Panel>
            <NoSubscriptions statusFilter={statusFilter} searching={false} />
          </Panel>
        ) : (
          <Panel style={styles.listPanel}>
            <SubscriptionList subscriptions={items} />
          </Panel>
        )}
        <Muted>{OBSERVATION_DISCLAIMER}</Muted>
      </Screen>
      <AppButton icon="plus" onPress={openNewSubscription} style={styles.floatingButton}>
        {ADD_SUBSCRIPTION_LABEL}
      </AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  filters: { width: 360, maxWidth: '100%' },
  listPanel: { paddingVertical: 4, gap: 0 },
  /** Bouton maison posé au-dessus de la liste : l'ombre seule le distingue du contenu qui défile dessous. */
  floatingButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    boxShadow: '0 6px 16px rgba(14, 17, 22, 0.18)',
  },
});
