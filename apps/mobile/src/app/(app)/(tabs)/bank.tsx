import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { AppButton } from '@/components/AppButton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/toast';
import { ErrorState, Loading, Panel, Screen } from '@/components/ui';
import { AnalyzedAccountsPanel, type AccountToggle } from '@/features/bank/AnalyzedAccountsPanel';
import { BankConnectPanel } from '@/features/bank/BankConnectPanel';
import { BankStatusPanel } from '@/features/bank/BankStatusPanel';
import { isDemoAccount } from '@/features/bank/bank-display';
import { DemoDataActions } from '@/features/bank/DemoDataActions';
import { useBankLink } from '@/features/bank/useBankLink';
import { api } from '@/lib/api';
import { DEMO_ENABLED } from '@/lib/config';
import { ApiError } from '@/lib/http';
import { useLayoutMode } from '@/lib/layout';
import { openPowensFlow } from '@/lib/powens-connect';
import { invalidateBankData, queryClient, queryKeys } from '@/lib/query';
import { useBrand } from '@/lib/theme';

function PowensNotConfiguredNotice() {
  const { colors } = useBrand();
  return (
    <Panel style={styles.notice}>
      <Icon source="information-outline" size={20} color={colors.inkMuted} />
      <Text variant="bodyMedium" style={styles.noticeText}>
        La connexion bancaire n’est pas encore configurée sur le serveur. Vous pouvez suivre vos abonnements à la main.
      </Text>
    </Panel>
  );
}

export default function BankScreen() {
  const toast = useToast();
  const isWide = useLayoutMode() === 'wide';
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [pulling, setPulling] = useState(false);
  const { bankLinkQuery, bankLink, linkedBank, syncing } = useBankLink();
  const accounts = useQuery({ queryKey: queryKeys.bankAccounts, queryFn: api.bankAccounts });

  const powensFlow = useMutation({
    mutationFn: openPowensFlow,
    onSuccess: (outcome) => {
      if (outcome.kind === 'completed') {
        invalidateBankData();
        toast.show('Connexion bancaire enregistrée : synchronisation en cours');
      } else if (outcome.kind === 'cancelled') {
        toast.show('Parcours bancaire fermé');
      }
    },
    onError: toast.showError,
  });
  const sync = useMutation({
    mutationFn: api.syncBank,
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.bankLink, updated);
      toast.show('Synchronisation lancée');
    },
    onError: toast.showError,
  });
  const updateAccount = useMutation({
    mutationFn: ({ id, analyzed }: AccountToggle) => api.updateBankAccount(id, analyzed),
    onSuccess: () => invalidateBankData(),
    onError: toast.showError,
  });
  const unlink = useMutation({
    mutationFn: api.unlinkBank,
    onSuccess: () => {
      setUnlinkOpen(false);
      invalidateBankData();
      toast.show('Banque déconnectée');
    },
    onError: toast.showError,
  });

  if (bankLinkQuery.isLoading) return <Loading />;
  if (bankLinkQuery.error) return <ErrorState error={bankLinkQuery.error} onRetry={bankLinkQuery.refetch} />;

  const accountList = accounts.data ?? [];
  const notConfigured = powensFlow.error instanceof ApiError && powensFlow.error.code === 'POWENS_NOT_CONFIGURED';
  // Les données de démonstration créent des comptes sans banque liée : ils restent pilotables ici.
  const showAccounts = linkedBank !== null || accountList.length > 0;
  const demoDataLoaded = accountList.some(isDemoAccount);

  // L'indicateur ne suit que le geste : le bouton « Synchroniser maintenant » a déjà son propre chargement.
  const pullToRefresh = () => {
    setPulling(true);
    const done = () => setPulling(false);
    if (linkedBank && !syncing) sync.mutate(undefined, { onSettled: done });
    else void Promise.all([bankLinkQuery.refetch(), accounts.refetch()]).finally(done);
  };

  return (
    <Screen refreshing={pulling} onRefresh={pullToRefresh}>
      {notConfigured ? <PowensNotConfiguredNotice /> : null}

      <View style={isWide ? styles.wideColumns : styles.columns}>
        <View style={isWide ? styles.wideColumn : null}>
          {linkedBank ? (
            <BankStatusPanel
              link={linkedBank}
              onSync={() => sync.mutate()}
              syncPending={sync.isPending}
              onReconnect={() => powensFlow.mutate('reconnect')}
              reconnectPending={powensFlow.isPending}
            />
          ) : (
            <BankConnectPanel
              previouslyDisconnected={bankLink?.status === 'disconnected'}
              onConnect={() => powensFlow.mutate('connect')}
              pending={powensFlow.isPending}
            />
          )}
        </View>

        {showAccounts ? (
          <View style={isWide ? styles.wideColumn : null}>
            <AnalyzedAccountsPanel
              accounts={accountList}
              loading={accounts.isLoading}
              error={accounts.error}
              pendingToggle={updateAccount.isPending ? updateAccount.variables : undefined}
              onToggle={(toggle) => updateAccount.mutate(toggle)}
              onManageSharing={linkedBank ? () => powensFlow.mutate('manage') : undefined}
              manageDisabled={powensFlow.isPending}
            />
          </View>
        ) : null}
      </View>

      <View style={[styles.secondaryActions, isWide ? styles.wideSecondaryActions : null]}>
        {DEMO_ENABLED && accounts.isSuccess ? <DemoDataActions demoDataLoaded={demoDataLoaded} wide={isWide} /> : null}
        {linkedBank ? (
          <AppButton
            variant="destructiveGhost"
            icon="link-off"
            onPress={() => setUnlinkOpen(true)}
            style={isWide ? styles.wideUnlink : null}
          >
            Déconnecter la banque
          </AppButton>
        ) : null}
      </View>

      <ConfirmDialog
        visible={unlinkOpen}
        title="Déconnecter la banque ?"
        message="La connexion sera supprimée chez Powens et les opérations importées seront effacées. Vos abonnements suivis sont conservés."
        confirmLabel="Déconnecter la banque"
        destructive
        loading={unlink.isPending}
        onConfirm={() => unlink.mutate()}
        onDismiss={() => setUnlinkOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 16 },
  noticeText: { flex: 1 },
  columns: { gap: 16 },
  wideColumns: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  wideColumn: { flex: 1, minWidth: 0, gap: 16 },
  secondaryActions: { gap: 8, marginTop: 8 },
  wideSecondaryActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 },
  wideUnlink: { marginLeft: 'auto' },
});
