import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Subscription } from '@subtracker/contracts';
import { EmptyState, Muted, Panel } from '@/components/ui';
import { filterSubscriptions, type StatusFilter } from './filters';
import { SearchField } from './SearchField';
import { SubscriptionTable } from './SubscriptionRows';

export const OBSERVATION_DISCLAIMER = 'Une opération observée ne prouve pas qu’un abonnement est actif.';

export function NoSubscriptions({ statusFilter, searching }: { statusFilter: StatusFilter; searching: boolean }) {
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

/**
 * Tableau des abonnements du mode large, recherche comprise, tel que sur la maquette du tableau de bord.
 * `heading` occupe la gauche de la ligne de recherche : un titre sur l'accueil, les filtres de statut sur la liste.
 */
export function SubscriptionsTablePanel({
  subscriptions,
  statusFilter,
  heading,
}: {
  subscriptions: Subscription[];
  statusFilter: StatusFilter;
  heading: ReactNode;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const rows = filterSubscriptions(subscriptions, statusFilter, searchQuery);
  return (
    <Panel style={styles.panel}>
      <View style={styles.toolbar}>
        <View style={styles.heading}>{heading}</View>
        <SearchField value={searchQuery} onChangeText={setSearchQuery} style={styles.search} />
      </View>
      {rows.length === 0 ? (
        <NoSubscriptions statusFilter={statusFilter} searching={searchQuery.trim() !== ''} />
      ) : (
        <SubscriptionTable subscriptions={rows} />
      )}
      <Muted>{OBSERVATION_DISCLAIMER}</Muted>
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  heading: { flexShrink: 1 },
  search: { width: 250, maxWidth: '100%' },
});
