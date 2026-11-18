import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/toast';
import { ErrorState, Loading, Panel, Screen } from '@/components/ui';
import { AnalyzedAccountsPanel, type AccountToggle } from '@/features/bank/AnalyzedAccountsPanel';
import { BankConnectPanel } from '@/features/bank/BankConnectPanel';
import { BankStatusPanel } from '@/features/bank/BankStatusPanel';
import { DemoDataActions } from '@/features/bank/DemoDataActions';
import { useBankLink } from '@/features/bank/useBankLink';
import { api } from '@/lib/api';
import { DEMO_ENABLED } from '@/lib/config';
import { ApiError } from '@/lib/http';
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
  const { colors } = useBrand();
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

      {showAccounts ? (
        <AnalyzedAccountsPanel
          accounts={accountList}
          loading={accounts.isLoading}
          error={accounts.error}
          pendingToggle={updateAccount.isPending ? updateAccount.variables : undefined}
          onToggle={(toggle) => updateAccount.mutate(toggle)}
          onManageSharing={linkedBank ? () => powensFlow.mutate('manage') : undefined}
          manageDisabled={powensFlow.isPending}
        />
      ) : null}

      <View style={styles.secondaryActions}>
        {DEMO_ENABLED ? <DemoDataActions /> : null}
        {linkedBank ? (
          <Button
            mode="text"
            icon="link-off"
            textColor={colors.destructive}
            onPress={() => setUnlinkOpen(true)}
            contentStyle={styles.target}
          >
            Déconnecter la banque
          </Button>
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
  secondaryActions: { gap: 8, marginTop: 8 },
  target: { minHeight: 44 },
});
