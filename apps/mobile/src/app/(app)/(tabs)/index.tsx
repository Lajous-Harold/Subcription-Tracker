import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';
import { EmptyState, ErrorState, Loading, Muted, Panel, Screen } from '@/components/ui';
import { DashboardNotices } from '@/features/dashboard/DashboardNotices';
import { DashboardIndicators, MonthHero, ReviewPrompt } from '@/features/dashboard/SummaryPanels';
import { describeLastBankRead, SyncHint } from '@/features/dashboard/SyncHint';
import { UpcomingPayments } from '@/features/dashboard/UpcomingPayments';
import { useBankPullToSync, type BankPullToSync } from '@/features/dashboard/useBankPullToSync';
import { api } from '@/lib/api';
import { useLayoutMode } from '@/lib/layout';
import { queryKeys } from '@/lib/query';

const ADD_SUBSCRIPTION_LABEL = 'Ajouter un abonnement';

const openNewSubscription = () => router.push('/subscriptions/new');

function NoSubscriptions({ showAddButton }: { showAddButton: boolean }) {
  return (
    <Panel>
      <EmptyState
        title="Aucun abonnement suivi"
        description="Déclarez vos abonnements à la main, ou connectez votre banque pour qu’ils soient détectés."
      >
        {showAddButton ? (
          <Button mode="contained" icon="plus" onPress={openNewSubscription} contentStyle={styles.mainActionContent}>
            {ADD_SUBSCRIPTION_LABEL}
          </Button>
        ) : null}
        <Button
          mode="outlined"
          icon="bank-plus"
          onPress={() => router.push('/bank')}
          contentStyle={styles.mainActionContent}
        >
          Connecter ma banque
        </Button>
      </EmptyState>
    </Panel>
  );
}

function WideToolbar({ bankSync }: { bankSync: BankPullToSync }) {
  const { linkedBank, syncing, refreshing } = bankSync;
  const syncBusy = refreshing || syncing;
  return (
    <View style={styles.toolbar}>
      {linkedBank ? (
        <Muted style={styles.toolbarStatus}>
          {syncing ? 'Synchronisation en cours…' : `Banque ${describeLastBankRead(linkedBank)}`}
        </Muted>
      ) : null}
      <View style={styles.toolbarActions}>
        {linkedBank ? (
          <Button
            mode="outlined"
            icon="sync"
            onPress={() => void bankSync.refresh()}
            loading={syncBusy}
            disabled={syncBusy}
            contentStyle={styles.mainActionContent}
          >
            Synchroniser la banque
          </Button>
        ) : null}
        <Button mode="contained" icon="plus" onPress={openNewSubscription} contentStyle={styles.mainActionContent}>
          {ADD_SUBSCRIPTION_LABEL}
        </Button>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const layoutMode = useLayoutMode();
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: api.dashboard,
  });
  const bankSync = useBankPullToSync(refetch);

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  const isWide = layoutMode === 'wide';
  const hasSubscriptions = data.trackedCount > 0;
  const hasPendingDetections = data.pendingCandidates > 0;
  const { linkedBank } = bankSync;

  return (
    <Screen refreshing={bankSync.refreshing} onRefresh={() => void bankSync.refresh()}>
      {isWide ? <WideToolbar bankSync={bankSync} /> : null}
      {!isWide && linkedBank ? (
        <SyncHint bank={linkedBank} syncing={bankSync.syncing} onSync={() => void bankSync.refresh()} />
      ) : null}

      {hasSubscriptions && isWide ? <DashboardIndicators summary={data} /> : null}
      {hasSubscriptions && !isWide ? <MonthHero summary={data} /> : null}
      {hasPendingDetections && !(hasSubscriptions && isWide) ? (
        <ReviewPrompt pendingCount={data.pendingCandidates} />
      ) : null}

      <DashboardNotices summary={data} />

      {hasSubscriptions ? (
        <UpcomingPayments upcoming={data.upcoming} layoutMode={layoutMode} />
      ) : (
        <NoSubscriptions showAddButton={!isWide} />
      )}

      <Muted style={styles.disclaimer}>
        Les montants observés proviennent de vos opérations bancaires ; une opération ne prouve pas qu’un abonnement est
        actif.
      </Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mainActionContent: { minHeight: 48 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 12 },
  toolbarStatus: { flexGrow: 1, fontSize: 14 },
  toolbarActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  disclaimer: { textAlign: 'center', marginTop: 8 },
});
