import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { EmptyState, ErrorState, Loading, Muted, Panel, Screen } from '@/components/ui';
import { DashboardNotices } from '@/features/dashboard/DashboardNotices';
import { DashboardIndicators, MonthHero, ReviewPrompt } from '@/features/dashboard/SummaryPanels';
import { SyncHint } from '@/features/dashboard/SyncHint';
import { UpcomingPayments } from '@/features/dashboard/UpcomingPayments';
import { useBankPullToSync } from '@/features/dashboard/useBankPullToSync';
import { ADD_SUBSCRIPTION_LABEL, openNewSubscription } from '@/features/subscriptions-list/add-subscription';
import { SubscriptionsTablePanel } from '@/features/subscriptions-list/SubscriptionsTablePanel';
import { api } from '@/lib/api';
import { useLayoutMode } from '@/lib/layout';
import { queryKeys } from '@/lib/query';
import { useBrand } from '@/lib/theme';

function NoSubscriptions({ showAddButton }: { showAddButton: boolean }) {
  return (
    <Panel>
      <EmptyState
        title="Aucun abonnement suivi"
        description="Déclarez vos abonnements à la main, ou connectez votre banque pour qu’ils soient détectés."
      >
        {showAddButton ? (
          <AppButton icon="plus" onPress={openNewSubscription}>
            {ADD_SUBSCRIPTION_LABEL}
          </AppButton>
        ) : null}
        <AppButton variant="secondary" icon="bank-plus" onPress={() => router.push('/bank')}>
          Connecter ma banque
        </AppButton>
      </EmptyState>
    </Panel>
  );
}

function TrackedSubscriptionsPanel() {
  const { colors, fonts } = useBrand();
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: queryKeys.subscriptions,
    queryFn: () => api.subscriptions(),
  });
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;
  return (
    <SubscriptionsTablePanel
      subscriptions={data}
      statusFilter="tracked"
      heading={
        <Text
          accessibilityRole="header"
          style={[styles.panelTitle, { fontFamily: fonts.displayBold, color: colors.ink }]}
        >
          Abonnements
        </Text>
      }
    />
  );
}

export default function DashboardScreen() {
  const layoutMode = useLayoutMode();
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: api.dashboard,
  });
  const bankSync = useBankPullToSync();

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  const isWide = layoutMode === 'wide';
  const hasSubscriptions = data.trackedCount > 0;
  const hasPendingDetections = data.pendingCandidates > 0;
  const { linkedBank } = bankSync;

  return (
    <Screen refreshing={bankSync.refreshing} onRefresh={() => void bankSync.refresh()}>
      <View style={isWide ? styles.wideSections : styles.compactSections}>
        {!isWide && linkedBank ? (
          <SyncHint bank={linkedBank} syncing={bankSync.syncing} onSync={() => void bankSync.refresh()} />
        ) : null}

        {hasSubscriptions && isWide ? <DashboardIndicators summary={data} /> : null}
        {hasSubscriptions && !isWide ? <MonthHero summary={data} /> : null}
        {hasPendingDetections && !(hasSubscriptions && isWide) ? (
          <ReviewPrompt pendingCount={data.pendingCandidates} />
        ) : null}

        <DashboardNotices summary={data} />

        {!hasSubscriptions ? <NoSubscriptions showAddButton={!isWide} /> : null}
        {hasSubscriptions && isWide ? <TrackedSubscriptionsPanel /> : null}
        {hasSubscriptions && !isWide ? <UpcomingPayments upcoming={data.upcoming} /> : null}

        {isWide ? null : (
          <Muted style={styles.disclaimer}>
            Les montants observés proviennent de vos opérations bancaires ; une opération ne prouve pas qu’un abonnement
            est actif.
          </Muted>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** La maquette du tableau de bord espace davantage ses blocs que l'accueil mobile. */
  wideSections: { gap: 24 },
  compactSections: { gap: 16 },
  panelTitle: { fontSize: 20, lineHeight: 26 },
  disclaimer: { textAlign: 'center', marginTop: 8 },
});
