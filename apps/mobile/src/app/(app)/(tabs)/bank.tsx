import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Banner, Button, Card, Chip, List, Switch, Text } from 'react-native-paper';
import type { BankLink } from '@subtracker/contracts';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/toast';
import { ErrorState, Loading, Muted, Screen, SectionTitle, styles } from '@/components/ui';
import { api } from '@/lib/api';
import { DEMO_ENABLED } from '@/lib/config';
import { BANK_STATUS_HELP, BANK_STATUS_LABELS, formatDateTime, formatMoney, needsBankReconnection } from '@/lib/format';
import { ApiError } from '@/lib/http';
import { openPowensFlow } from '@/lib/powens-connect';
import { invalidateBankData, queryClient, queryKeys } from '@/lib/query';
import { DESTRUCTIVE_COLOR } from '@/lib/theme';

const isSyncing = (link: BankLink | null | undefined) =>
  Boolean(link && (link.status === 'pending' || link.syncInProgress));

function DemoDataCard() {
  const toast = useToast();
  const loadDemo = useMutation({
    mutationFn: api.loadDemoData,
    onSuccess: (result) => {
      invalidateBankData();
      toast.show(
        `${result.imported} opérations fictives importées, ${result.detection.pending} détection(s) à vérifier`,
      );
    },
    onError: toast.showError,
  });
  const removeDemo = useMutation({
    mutationFn: api.removeDemoData,
    onSuccess: () => {
      invalidateBankData();
      toast.show('Données de démonstration retirées');
    },
    onError: toast.showError,
  });
  return (
    <Card mode="outlined">
      <Card.Title title="Données de démonstration" subtitle="Nécessite ENABLE_DEMO_DATA côté API" />
      <Card.Content>
        <Muted>
          Importe des opérations fictives (Spotify, Netflix, salle de sport…) pour tester la détection sans banque.
        </Muted>
      </Card.Content>
      <Card.Actions>
        <Button onPress={() => removeDemo.mutate()} loading={removeDemo.isPending}>
          Retirer
        </Button>
        <Button mode="contained-tonal" onPress={() => loadDemo.mutate()} loading={loadDemo.isPending}>
          Charger
        </Button>
      </Card.Actions>
    </Card>
  );
}

export default function BankScreen() {
  const toast = useToast();
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const bankLinkQuery = useQuery({
    queryKey: queryKeys.bankLink,
    queryFn: api.bankLink,
    refetchInterval: (query) => (isSyncing(query.state.data) ? 3000 : false),
  });
  const accounts = useQuery({ queryKey: queryKeys.bankAccounts, queryFn: api.bankAccounts });
  const syncing = isSyncing(bankLinkQuery.data);
  const wasSyncing = useRef(syncing);
  useEffect(() => {
    if (wasSyncing.current && !syncing) invalidateBankData();
    wasSyncing.current = syncing;
  }, [syncing]);

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
      toast.show('Actualisation demandée');
    },
    onError: toast.showError,
  });
  const updateAccount = useMutation({
    mutationFn: ({ id, analyzed }: { id: string; analyzed: boolean }) => api.updateBankAccount(id, analyzed),
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

  const bankLink = bankLinkQuery.data ?? null;
  const connected = bankLink && bankLink.status !== 'disconnected';
  const accountList = accounts.data ?? [];
  const notConfigured = powensFlow.error instanceof ApiError && powensFlow.error.code === 'POWENS_NOT_CONFIGURED';

  return (
    <Screen
      refreshing={bankLinkQuery.isRefetching}
      onRefresh={() => void bankLinkQuery.refetch().then(() => accounts.refetch())}
    >
      {notConfigured ? (
        <Banner visible icon="information-outline">
          La connexion bancaire n’est pas encore configurée sur le serveur. Vous pouvez suivre vos abonnements à la
          main.
        </Banner>
      ) : null}

      {!connected ? (
        <Card>
          <Card.Title title="Connecter ma banque" subtitle="Détection automatique de vos abonnements" />
          <Card.Content style={{ gap: 8 }}>
            <Text variant="bodyMedium">
              La connexion passe par Powens, prestataire agréé : vous vous authentifiez sur son parcours officiel, et
              vous choisissez les comptes à partager. Vos identifiants bancaires ne transitent jamais par cette
              application.
            </Text>
            <Muted>
              Seuls les débits sont importés, et seulement en lecture : aucun paiement ni virement n’est possible. Vous
              pouvez tout suivre à la main sans connecter de banque.
            </Muted>
          </Card.Content>
          <Card.Actions>
            <Button
              mode="contained"
              icon="bank-plus"
              onPress={() => powensFlow.mutate('connect')}
              loading={powensFlow.isPending}
              disabled={powensFlow.isPending}
            >
              Connecter ma banque
            </Button>
          </Card.Actions>
        </Card>
      ) : (
        <Card>
          <Card.Title
            title={bankLink.connectorName ?? 'Ma banque'}
            subtitle={`Dernière synchronisation : ${formatDateTime(bankLink.lastSyncAt)}`}
          />
          <Card.Content style={{ gap: 8 }}>
            <View style={styles.row}>
              <Chip compact icon={bankLink.status === 'connected' ? 'check-circle-outline' : 'alert-circle-outline'}>
                {BANK_STATUS_LABELS[bankLink.status]}
              </Chip>
              {bankLink.syncInProgress ? (
                <Chip compact icon="sync">
                  Synchronisation…
                </Chip>
              ) : null}
            </View>
            <Muted>{BANK_STATUS_HELP[bankLink.status]}</Muted>
            {bankLink.consentExpiringSoon ? (
              <Banner visible icon="clock-alert-outline">
                {`Votre autorisation expire le ${formatDateTime(bankLink.consentExpiresAt)}. Renouvelez-la pour continuer la détection.`}
              </Banner>
            ) : null}
          </Card.Content>
          <Card.Actions style={{ flexWrap: 'wrap' }}>
            {needsBankReconnection(bankLink) ? (
              <Button
                mode="contained"
                icon="refresh"
                onPress={() => powensFlow.mutate('reconnect')}
                loading={powensFlow.isPending}
              >
                Reconnecter
              </Button>
            ) : null}
            <Button
              icon="sync"
              onPress={() => sync.mutate()}
              loading={sync.isPending}
              disabled={sync.isPending || syncing}
            >
              Actualiser
            </Button>
          </Card.Actions>
        </Card>
      )}

      <SectionTitle>Comptes</SectionTitle>
      <Card>
        {accountList.length === 0 ? (
          <Card.Content>
            <Muted>{connected ? 'Les comptes apparaîtront après la première synchronisation.' : 'Aucun compte.'}</Muted>
          </Card.Content>
        ) : (
          accountList.map((account) => (
            <List.Item
              key={account.id}
              title={account.name}
              description={[
                account.type,
                account.balanceCents !== null ? formatMoney(account.balanceCents, account.currency) : null,
                account.sharedWithApp ? null : 'non partagé',
              ]
                .filter(Boolean)
                .join(' · ')}
              left={(props) => <List.Icon {...props} icon="credit-card-outline" />}
              right={() => (
                <View style={styles.row}>
                  <Muted>Analyser</Muted>
                  <Switch
                    value={account.analyzed}
                    onValueChange={(analyzed) => updateAccount.mutate({ id: account.id, analyzed })}
                    accessibilityLabel={`Analyser le compte ${account.name}`}
                  />
                </View>
              )}
            />
          ))
        )}
        {connected ? (
          <Card.Actions>
            <Button
              icon="account-cog-outline"
              onPress={() => powensFlow.mutate('manage')}
              disabled={powensFlow.isPending}
            >
              Gérer les comptes partagés
            </Button>
          </Card.Actions>
        ) : null}
      </Card>
      <Muted>« Analyser » est un choix local. Les comptes partagés se gèrent dans le parcours Powens.</Muted>

      {connected ? (
        <Button
          icon="link-off"
          textColor={DESTRUCTIVE_COLOR}
          onPress={() => setUnlinkOpen(true)}
          style={{ alignSelf: 'flex-start' }}
        >
          Déconnecter la banque
        </Button>
      ) : null}

      {DEMO_ENABLED ? <DemoDataCard /> : null}

      <ConfirmDialog
        visible={unlinkOpen}
        title="Déconnecter la banque ?"
        message="La connexion sera supprimée chez Powens et les opérations importées seront effacées. Vos abonnements suivis sont conservés."
        confirmLabel="Déconnecter"
        destructive
        loading={unlink.isPending}
        onConfirm={() => unlink.mutate()}
        onDismiss={() => setUnlinkOpen(false)}
      />
    </Screen>
  );
}
