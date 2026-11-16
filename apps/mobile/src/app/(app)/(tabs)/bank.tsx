import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { Banner, Button, Card, Chip, List, Switch, Text } from 'react-native-paper';
import type { BankLink, ConnectFlow } from '@subtracker/contracts';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/toast';
import { ErrorState, Loading, Muted, Screen, SectionTitle, styles } from '@/components/ui';
import { api } from '@/lib/api';
import { IS_DEV } from '@/lib/config';
import { BANK_STATUS_HELP, BANK_STATUS_LABELS, formatDateTime, formatMoney } from '@/lib/format';
import { ApiError, errorMessage } from '@/lib/http';
import { openPowensFlow } from '@/lib/powens-connect';
import { invalidateDetectionData, keys, queryClient } from '@/lib/query';

const isBusy = (link: BankLink | null | undefined) =>
  Boolean(link && (link.status === 'pending' || link.syncInProgress));

function refreshBankData() {
  void queryClient.invalidateQueries({ queryKey: ['bank'] });
  invalidateDetectionData();
}

function DemoDataCard() {
  const toast = useToast();
  const load = useMutation({
    mutationFn: api.loadDemoData,
    onSuccess: (result) => {
      refreshBankData();
      toast.show(
        `${result.imported} opérations fictives importées, ${result.detection.pending} détection(s) à vérifier`,
      );
    },
    onError: (error) => toast.show(errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: api.removeDemoData,
    onSuccess: () => {
      refreshBankData();
      toast.show('Données de démonstration retirées');
    },
    onError: (error) => toast.show(errorMessage(error)),
  });
  return (
    <Card mode="outlined">
      <Card.Title title="Données de démonstration" subtitle="Développement uniquement" />
      <Card.Content>
        <Muted>
          Importe des opérations fictives (Spotify, Netflix, salle de sport…) pour tester la détection sans banque.
        </Muted>
      </Card.Content>
      <Card.Actions>
        <Button onPress={() => remove.mutate()} loading={remove.isPending}>
          Retirer
        </Button>
        <Button mode="contained-tonal" onPress={() => load.mutate()} loading={load.isPending}>
          Charger
        </Button>
      </Card.Actions>
    </Card>
  );
}

export default function BankScreen() {
  const toast = useToast();
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const link = useQuery({
    queryKey: keys.bankLink,
    queryFn: api.bankLink,
    refetchInterval: (query) => (isBusy(query.state.data) ? 3000 : false),
  });
  const accounts = useQuery({ queryKey: keys.bankAccounts, queryFn: api.bankAccounts });

  const flow = useMutation({
    mutationFn: openPowensFlow,
    onSuccess: (outcome) => {
      if (outcome.kind === 'completed') {
        refreshBankData();
        toast.show('Connexion bancaire enregistrée : synchronisation en cours');
      } else if (outcome.kind === 'cancelled') {
        toast.show('Parcours bancaire fermé');
      }
    },
    onError: (error) => toast.show(errorMessage(error)),
  });
  const sync = useMutation({
    mutationFn: api.syncBank,
    onSuccess: (updated) => {
      queryClient.setQueryData(keys.bankLink, updated);
      toast.show('Actualisation demandée');
    },
    onError: (error) => toast.show(errorMessage(error)),
  });
  const toggle = useMutation({
    mutationFn: ({ id, analyzed }: { id: string; analyzed: boolean }) => api.updateBankAccount(id, analyzed),
    onSuccess: () => refreshBankData(),
    onError: (error) => toast.show(errorMessage(error)),
  });
  const unlink = useMutation({
    mutationFn: api.unlinkBank,
    onSuccess: () => {
      setUnlinkOpen(false);
      refreshBankData();
      toast.show('Banque déconnectée');
    },
    onError: (error) => toast.show(errorMessage(error)),
  });

  if (link.isLoading) return <Loading />;
  if (link.error) return <ErrorState error={link.error} onRetry={link.refetch} />;

  const current = link.data ?? null;
  const connected = current && current.status !== 'disconnected';
  const start = (value: ConnectFlow) => flow.mutate(value);
  const notConfigured = flow.error instanceof ApiError && flow.error.code === 'powens_not_configured';

  return (
    <Screen refreshing={link.isRefetching} onRefresh={() => void link.refetch().then(() => accounts.refetch())}>
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
              onPress={() => start('connect')}
              loading={flow.isPending}
              disabled={flow.isPending}
            >
              Connecter ma banque
            </Button>
          </Card.Actions>
        </Card>
      ) : (
        <Card>
          <Card.Title
            title={current.connectorName ?? 'Ma banque'}
            subtitle={`Dernière synchronisation : ${formatDateTime(current.lastSyncAt)}`}
          />
          <Card.Content style={{ gap: 8 }}>
            <View style={styles.row}>
              <Chip compact icon={current.status === 'connected' ? 'check-circle-outline' : 'alert-circle-outline'}>
                {BANK_STATUS_LABELS[current.status]}
              </Chip>
              {current.syncInProgress ? (
                <Chip compact icon="sync">
                  Synchronisation…
                </Chip>
              ) : null}
            </View>
            <Muted>{BANK_STATUS_HELP[current.status]}</Muted>
            {current.consentExpiringSoon ? (
              <Banner visible icon="clock-alert-outline">
                {`Votre autorisation expire le ${formatDateTime(current.consentExpiresAt)}. Renouvelez-la pour continuer la détection.`}
              </Banner>
            ) : null}
          </Card.Content>
          <Card.Actions style={{ flexWrap: 'wrap' }}>
            {current.status === 'action_required' || current.status === 'error' || current.consentExpiringSoon ? (
              <Button mode="contained" icon="refresh" onPress={() => start('reconnect')} loading={flow.isPending}>
                Reconnecter
              </Button>
            ) : null}
            <Button
              icon="sync"
              onPress={() => sync.mutate()}
              loading={sync.isPending}
              disabled={sync.isPending || isBusy(current)}
            >
              Actualiser
            </Button>
          </Card.Actions>
        </Card>
      )}

      <SectionTitle>Comptes</SectionTitle>
      <Card>
        {(accounts.data ?? []).length === 0 ? (
          <Card.Content>
            <Muted>{connected ? 'Les comptes apparaîtront après la première synchronisation.' : 'Aucun compte.'}</Muted>
          </Card.Content>
        ) : (
          (accounts.data ?? []).map((account) => (
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
                    onValueChange={(analyzed) => toggle.mutate({ id: account.id, analyzed })}
                    accessibilityLabel={`Analyser le compte ${account.name}`}
                  />
                </View>
              )}
            />
          ))
        )}
        {connected ? (
          <Card.Actions>
            <Button icon="account-cog-outline" onPress={() => start('manage')} disabled={flow.isPending}>
              Gérer les comptes partagés
            </Button>
          </Card.Actions>
        ) : null}
      </Card>
      <Muted>« Analyser » est un choix local. Les comptes partagés se gèrent dans le parcours Powens.</Muted>

      {connected ? (
        <Button
          icon="link-off"
          textColor="#C62828"
          onPress={() => setUnlinkOpen(true)}
          style={{ alignSelf: 'flex-start' }}
        >
          Déconnecter la banque
        </Button>
      ) : null}

      {IS_DEV ? <DemoDataCard /> : null}

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
