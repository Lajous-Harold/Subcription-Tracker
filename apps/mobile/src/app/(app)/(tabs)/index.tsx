import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Banner, Button, Card, List, Text } from 'react-native-paper';
import { EmptyState, ErrorState, Loading, Muted, OriginChip, Screen, SectionTitle, styles } from '@/components/ui';
import { api } from '@/lib/api';
import { BANK_STATUS_LABELS, formatMoney, formatShortDate } from '@/lib/format';
import { keys } from '@/lib/query';

export default function DashboardScreen() {
  const { data, error, isLoading, refetch, isRefetching } = useQuery({
    queryKey: keys.dashboard,
    queryFn: api.dashboard,
  });

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  const bankNeedsAction =
    data.bank &&
    (data.bank.status === 'action_required' || data.bank.status === 'error' || data.bank.consentExpiringSoon);

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      {data.pendingCandidates > 0 ? (
        <Banner
          visible
          icon="magnify-scan"
          actions={[{ label: 'Vérifier', onPress: () => router.push('/candidates') }]}
        >
          {data.pendingCandidates === 1
            ? '1 abonnement détecté attend votre confirmation.'
            : `${data.pendingCandidates} abonnements détectés attendent votre confirmation.`}
        </Banner>
      ) : null}
      {bankNeedsAction ? (
        <Banner visible icon="bank-remove" actions={[{ label: 'Voir', onPress: () => router.push('/bank') }]}>
          {data.bank?.consentExpiringSoon
            ? 'Votre autorisation bancaire expire bientôt : renouvelez-la pour continuer la détection.'
            : `Connexion bancaire : ${BANK_STATUS_LABELS[data.bank!.status].toLowerCase()}.`}
        </Banner>
      ) : null}
      {data.missingPayments > 0 ? (
        <Banner
          visible
          icon="calendar-alert"
          actions={[{ label: 'Voir', onPress: () => router.push('/subscriptions') }]}
        >
          {`${data.missingPayments} abonnement(s) sans paiement observé à l’échéance attendue. Ce n’est pas une preuve de résiliation.`}
        </Banner>
      ) : null}

      {data.trackedCount === 0 ? (
        <Card>
          <EmptyState
            title="Aucun abonnement suivi"
            description="Déclarez vos abonnements à la main, ou connectez votre banque pour qu’ils soient détectés."
          >
            <Button mode="contained" icon="plus" onPress={() => router.push('/subscriptions/new')}>
              Ajouter un abonnement
            </Button>
            <Button mode="outlined" icon="bank-plus" onPress={() => router.push('/bank')}>
              Connecter ma banque
            </Button>
          </EmptyState>
        </Card>
      ) : (
        <>
          <Card>
            <Card.Content style={{ gap: 6 }}>
              <Muted>Coût mensuel estimé</Muted>
              <Text variant="displaySmall">{formatMoney(data.monthly.totalCents, data.currency)}</Text>
              <View style={styles.row}>
                <OriginChip origin="observed" />
                <Text variant="bodyMedium">{formatMoney(data.monthly.observedCents, data.currency)}</Text>
                <OriginChip origin="declared" />
                <Text variant="bodyMedium">{formatMoney(data.monthly.declaredCents, data.currency)}</Text>
              </View>
              {data.excludedOtherCurrencies.length > 0 ? (
                <Muted>
                  {`Hors total : ${data.excludedOtherCurrencies.map((c) => `${c.count} en ${c.currency}`).join(', ')}.`}
                </Muted>
              ) : null}
            </Card.Content>
          </Card>
          <View style={[styles.row, { alignItems: 'stretch' }]}>
            <Card style={{ flex: 1, minWidth: 150 }}>
              <Card.Content>
                <Muted>Abonnements suivis</Muted>
                <Text variant="headlineMedium">{data.trackedCount}</Text>
              </Card.Content>
            </Card>
            <Card style={{ flex: 1, minWidth: 150 }}>
              <Card.Content style={{ gap: 4 }}>
                <View style={styles.between}>
                  <Muted>Projection annuelle</Muted>
                  <OriginChip origin="estimated" />
                </View>
                <Text variant="headlineMedium">{formatMoney(data.annualProjectionCents, data.currency)}</Text>
              </Card.Content>
            </Card>
          </View>

          <SectionTitle>Prochaines échéances (30 jours)</SectionTitle>
          <Card>
            {data.upcoming.length === 0 ? (
              <Card.Content>
                <Muted>Aucune échéance connue dans les 30 prochains jours.</Muted>
              </Card.Content>
            ) : (
              data.upcoming.map((item) => (
                <List.Item
                  key={item.subscriptionId}
                  title={item.label}
                  description={`${formatShortDate(item.date)}${item.dateOrigin === 'estimated' ? ' (estimée)' : ''}`}
                  left={(props) => <List.Icon {...props} icon="calendar" />}
                  right={() => <Text variant="titleMedium">{formatMoney(item.amountCents, item.currency)}</Text>}
                  onPress={() => router.push(`/subscriptions/${item.subscriptionId}`)}
                />
              ))
            )}
          </Card>
        </>
      )}
      <Muted style={{ textAlign: 'center', marginTop: 8 }}>
        Les montants observés proviennent de vos opérations bancaires ; une opération ne prouve pas qu’un abonnement est
        actif.
      </Muted>
    </Screen>
  );
}
