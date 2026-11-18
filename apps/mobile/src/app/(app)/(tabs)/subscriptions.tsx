import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, FAB, SegmentedButtons, TextInput } from 'react-native-paper';
import { controlStyles, EmptyState, ErrorState, Loading, Muted, Panel, Screen } from '@/components/ui';
import { filterSubscriptions, type StatusFilter } from '@/features/subscriptions-list/filters';
import { SubscriptionList, SubscriptionTable } from '@/features/subscriptions-list/SubscriptionRows';
import { api } from '@/lib/api';
import { useLayoutMode } from '@/lib/layout';
import { queryKeys } from '@/lib/query';
import { useBrand } from '@/lib/theme';

const ADD_SUBSCRIPTION_LABEL = 'Ajouter un abonnement';
const OBSERVATION_DISCLAIMER = 'Une opération observée ne prouve pas qu’un abonnement est actif.';

const openNewSubscription = () => router.push('/subscriptions/new');

function StatusFilterButtons({ value, onChange }: { value: StatusFilter; onChange: (value: StatusFilter) => void }) {
  return (
    <SegmentedButtons
      value={value}
      onValueChange={(next) => onChange(next as StatusFilter)}
      buttons={[
        { value: 'tracked', label: 'Suivis' },
        { value: 'cancelled', label: 'Résiliés' },
        { value: 'archived', label: 'Archivés' },
      ]}
    />
  );
}

function NoSubscriptions({ statusFilter, searching }: { statusFilter: StatusFilter; searching: boolean }) {
  if (searching)
    return <EmptyState title="Aucun résultat" description="Aucun abonnement ne correspond à la recherche." />;
  if (statusFilter !== 'tracked') return <EmptyState title="Rien ici pour le moment" />;
  return (
    <EmptyState
      title="Aucun abonnement suivi"
      description="Ajoutez-en un à la main, ou connectez votre banque pour qu’ils soient détectés."
    />
  );
}

export default function SubscriptionsScreen() {
  const brand = useBrand();
  const layoutMode = useLayoutMode();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('tracked');
  const [searchQuery, setSearchQuery] = useState('');
  const { data, error, isLoading, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.subscriptions,
    queryFn: () => api.subscriptions(),
  });

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  if (layoutMode === 'wide') {
    const rows = filterSubscriptions(data, statusFilter, searchQuery);
    return (
      <Screen refreshing={isRefetching} onRefresh={refetch}>
        <View style={styles.toolbar}>
          <View style={styles.filters}>
            <StatusFilterButtons value={statusFilter} onChange={setStatusFilter} />
          </View>
          <Button mode="contained" icon="plus" onPress={openNewSubscription} contentStyle={styles.mainActionContent}>
            {ADD_SUBSCRIPTION_LABEL}
          </Button>
        </View>
        <Panel>
          <TextInput
            mode="outlined"
            dense
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rechercher un abonnement"
            accessibilityLabel="Rechercher un abonnement"
            left={<TextInput.Icon icon="magnify" />}
            outlineStyle={controlStyles.fieldOutline}
          />
          {rows.length === 0 ? (
            <NoSubscriptions statusFilter={statusFilter} searching={searchQuery.trim() !== ''} />
          ) : (
            <SubscriptionTable subscriptions={rows} />
          )}
          <Muted>{OBSERVATION_DISCLAIMER}</Muted>
        </Panel>
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
      <FAB
        icon="plus"
        label={ADD_SUBSCRIPTION_LABEL}
        color={brand.colors.onAction}
        style={[styles.fab, { backgroundColor: brand.colors.action }]}
        onPress={openNewSubscription}
        accessibilityLabel={ADD_SUBSCRIPTION_LABEL}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
  filters: { flexGrow: 1, flexShrink: 1, minWidth: 280, maxWidth: 420 },
  mainActionContent: { minHeight: 48 },
  listPanel: { paddingVertical: 4, gap: 0 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
