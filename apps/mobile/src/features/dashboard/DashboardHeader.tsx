import { useQuery } from '@tanstack/react-query';
import type { BottomTabHeaderProps } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { TabHeader } from '@/components/navigation/TabHeader';
import { ADD_SUBSCRIPTION_LABEL, openNewSubscription } from '@/features/subscriptions-list/add-subscription';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { describeDashboardPeriod } from './dashboard-period';
import { useBankPullToSync } from './useBankPullToSync';

/** En-tête du tableau de bord en mode large : le sous-titre situe les montants dans le mois en cours. */
export function DashboardHeader(props: BottomTabHeaderProps) {
  const { data } = useQuery({ queryKey: queryKeys.dashboard, queryFn: api.dashboard });
  return <TabHeader {...props} subtitle={data ? describeDashboardPeriod(data.trackedCount) : undefined} />;
}

export function DashboardHeaderActions() {
  const bankSync = useBankPullToSync();
  const { linkedBank, syncing, refreshing } = bankSync;
  return (
    <View style={styles.actions}>
      {linkedBank ? (
        <AppButton variant="secondary" onPress={() => void bankSync.refresh()} loading={refreshing || syncing}>
          Synchroniser la banque
        </AppButton>
      ) : null}
      <AppButton onPress={openNewSubscription}>{ADD_SUBSCRIPTION_LABEL}</AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
