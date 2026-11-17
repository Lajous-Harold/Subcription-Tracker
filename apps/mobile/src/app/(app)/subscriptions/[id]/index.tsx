import { useMutation, useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Banner, Button, Card, Chip, Divider, IconButton, List, Text } from 'react-native-paper';
import type { Origin, Payment, ResettableField, SubscriptionDetail } from '@subtracker/contracts';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/toast';
import { ErrorState, Loading, Muted, OriginChip, Screen, SectionTitle, styles } from '@/components/ui';
import { AddPaymentDialog } from '@/features/subscriptions/AddPaymentDialog';
import { api } from '@/lib/api';
import {
  CANCELLATION_STATUS_LABELS,
  ORIGIN_HELP,
  STATUS_LABELS,
  formatDate,
  formatDateTime,
  formatMoney,
  formatProviderName,
} from '@/lib/format';
import { invalidatePaymentData, invalidateSubscriptionData, queryKeys, storeUpdatedSubscription } from '@/lib/query';
import { DESTRUCTIVE_COLOR } from '@/lib/theme';

const EVENT_LABELS: Record<string, string> = {
  created: 'Abonnement déclaré',
  created_from_detection: 'Créé depuis une détection bancaire',
  updated: 'Modification',
  field_reset: 'Remis en automatique',
  payment_added: 'Paiement ajouté',
  payment_removed: 'Paiement supprimé',
  payment_linked: 'Opération bancaire rattachée',
  payment_unlinked: 'Opération bancaire détachée',
  bank_payments_attached: 'Paiements bancaires rattachés automatiquement',
  bank_detection_merged: 'Fusionné avec une détection bancaire',
  cancellation_updated: 'Suivi de résiliation mis à jour',
  cancellation_cleared: 'Suivi de résiliation effacé',
};

const FIELD_LABELS: Record<string, string> = {
  amount: 'montant',
  label: 'libellé',
  billingDay: 'jour de prélèvement',
  nextDueDate: 'échéance',
  status: 'statut',
  provider: 'fournisseur',
  customProviderName: 'fournisseur',
  notes: 'notes',
  cancellation: 'résiliation',
};

function SourcedRow({
  title,
  value,
  origin,
  onReset,
}: {
  title: string;
  value: string;
  origin?: Origin;
  onReset?: () => void;
}) {
  return (
    <List.Item
      title={value}
      description={origin ? `${title} · ${ORIGIN_HELP[origin]}` : title}
      descriptionNumberOfLines={2}
      right={() => (
        <View style={[styles.row, { justifyContent: 'flex-end' }]}>
          {origin ? <OriginChip origin={origin} /> : null}
          {onReset ? (
            <IconButton
              icon="restore"
              size={20}
              onPress={onReset}
              accessibilityLabel={`Remettre ${title.toLowerCase()} en automatique`}
            />
          ) : null}
        </View>
      )}
    />
  );
}

function PaymentRow({ payment, subscriptionId }: { payment: Payment; subscriptionId: string }) {
  const toast = useToast();
  const removePayment = useMutation({
    mutationFn: () => api.deletePayment(subscriptionId, payment.id),
    onSuccess: () => {
      invalidatePaymentData(subscriptionId);
      toast.show(payment.source === 'bank' ? 'Opération détachée' : 'Paiement supprimé');
    },
    onError: toast.showError,
  });
  return (
    <List.Item
      title={formatMoney(payment.amount.cents, payment.amount.currency)}
      description={[
        formatDate(payment.date),
        payment.source === 'bank' ? 'Opération bancaire' : 'Saisi à la main',
        payment.note,
        payment.possibleDuplicateOfId ? 'Doublon possible d’un paiement saisi à la main' : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      descriptionNumberOfLines={3}
      left={(props) => <List.Icon {...props} icon={payment.source === 'bank' ? 'bank' : 'pencil'} />}
      right={() => (
        <IconButton
          icon={payment.source === 'bank' ? 'link-off' : 'delete-outline'}
          onPress={() => removePayment.mutate()}
          disabled={removePayment.isPending}
          accessibilityLabel={payment.source === 'bank' ? 'Détacher l’opération' : 'Supprimer le paiement'}
        />
      )}
    />
  );
}

export default function SubscriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const subscription = useQuery({ queryKey: queryKeys.subscription(id), queryFn: () => api.subscription(id) });
  const payments = useQuery({ queryKey: queryKeys.payments(id), queryFn: () => api.payments(id) });

  const onUpdated = (message: string) => (updated: SubscriptionDetail) => {
    storeUpdatedSubscription(updated);
    toast.show(message);
  };
  const reset = useMutation({
    mutationFn: (field: ResettableField) => api.resetField(id, field),
    onSuccess: onUpdated('Remis en automatique'),
    onError: toast.showError,
  });
  const changeStatus = useMutation({
    mutationFn: (status: 'active' | 'archived') => api.updateSubscription(id, { status }),
    onSuccess: onUpdated('Statut mis à jour'),
    onError: toast.showError,
  });
  const stopTracking = useMutation({
    mutationFn: () => api.deleteSubscription(id),
    onSuccess: () => {
      invalidateSubscriptionData(id);
      toast.show('Abonnement retiré de l’application');
      router.back();
    },
    onError: toast.showError,
  });

  if (subscription.isLoading) return <Loading />;
  if (subscription.error || !subscription.data) {
    return <ErrorState error={subscription.error} onRetry={subscription.refetch} />;
  }
  const sub = subscription.data;
  const canReset = (origin: Origin | undefined) => origin === 'declared' && sub.bankLinked;

  return (
    <Screen
      refreshing={subscription.isRefetching}
      onRefresh={() => {
        void subscription.refetch();
        void payments.refetch();
      }}
    >
      <Stack.Screen options={{ title: sub.label }} />
      {sub.paymentMissing ? (
        <Banner visible icon="calendar-alert">
          Aucun paiement bancaire observé après l’échéance attendue. Ce n’est pas une preuve de résiliation : vérifiez
          auprès du fournisseur.
        </Banner>
      ) : null}

      <Card>
        <Card.Content style={{ gap: 4 }}>
          <View style={styles.between}>
            <Text variant="headlineSmall" style={{ flex: 1 }}>
              {sub.label}
            </Text>
            <Chip compact>{STATUS_LABELS[sub.status]}</Chip>
          </View>
          <Muted>{[formatProviderName(sub), sub.bankLinked ? 'Lié à la banque' : 'Suivi manuel'].join(' · ')}</Muted>
        </Card.Content>
        <SourcedRow
          title="Montant mensuel"
          value={formatMoney(sub.amount.value.cents, sub.amount.value.currency)}
          origin={sub.amount.origin}
          onReset={canReset(sub.amount.origin) ? () => reset.mutate('amount') : undefined}
        />
        <SourcedRow
          title="Jour de prélèvement"
          value={sub.billingDay ? `Le ${sub.billingDay.value} du mois` : 'Non renseigné'}
          origin={sub.billingDay?.origin}
          onReset={canReset(sub.billingDay?.origin) ? () => reset.mutate('billingDay') : undefined}
        />
        <SourcedRow
          title="Prochaine échéance"
          value={sub.nextDueDate ? formatDate(sub.nextDueDate.value) : sub.status === 'active' ? 'Inconnue' : 'Aucune'}
          origin={sub.nextDueDate?.origin}
          onReset={sub.nextDueDate?.origin === 'declared' ? () => reset.mutate('nextDueDate') : undefined}
        />
        <SourcedRow title="Dernier paiement" value={formatDate(sub.lastPaymentDate)} />
        {sub.notes ? (
          <Card.Content>
            <Muted>{sub.notes}</Muted>
          </Card.Content>
        ) : null}
        <Card.Actions>
          <Button icon="pencil" onPress={() => router.push(`/subscriptions/${id}/edit`)}>
            Modifier
          </Button>
        </Card.Actions>
      </Card>

      <SectionTitle>Résiliation</SectionTitle>
      <Card>
        <Card.Content style={{ gap: 4 }}>
          {sub.cancellation ? (
            <>
              <Text variant="titleMedium">{CANCELLATION_STATUS_LABELS[sub.cancellation.status]}</Text>
              <Muted>
                {[
                  sub.cancellation.requestedAt ? `Demandée le ${formatDate(sub.cancellation.requestedAt)}` : null,
                  sub.cancellation.effectiveDate ? `Effective le ${formatDate(sub.cancellation.effectiveDate)}` : null,
                  sub.cancellation.reference ? `Réf. ${sub.cancellation.reference}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Démarche en cours'}
              </Muted>
            </>
          ) : (
            <Muted>
              Consultez la procédure du fournisseur et suivez votre démarche. Rien n’est envoyé au fournisseur.
            </Muted>
          )}
        </Card.Content>
        <Card.Actions>
          <Button icon="file-document-edit-outline" onPress={() => router.push(`/subscriptions/${id}/cancel`)}>
            {sub.cancellation ? 'Mettre à jour' : 'Résilier : voir la procédure'}
          </Button>
        </Card.Actions>
      </Card>

      <SectionTitle>Paiements</SectionTitle>
      <Card>
        {payments.isLoading ? (
          <Card.Content>
            <Muted>Chargement…</Muted>
          </Card.Content>
        ) : (payments.data ?? []).length === 0 ? (
          <Card.Content>
            <Muted>Aucun paiement enregistré.</Muted>
          </Card.Content>
        ) : (
          (payments.data ?? []).map((payment) => <PaymentRow key={payment.id} payment={payment} subscriptionId={id} />)
        )}
        <Card.Actions>
          <Button icon="plus" onPress={() => setPaymentDialogOpen(true)}>
            Paiement manuel
          </Button>
          <Button icon="link-variant" onPress={() => router.push(`/subscriptions/${id}/link-payment`)}>
            Rattacher une opération
          </Button>
        </Card.Actions>
      </Card>

      <List.Accordion
        title="Historique des modifications"
        expanded={historyOpen}
        onPress={() => setHistoryOpen((open) => !open)}
      >
        {sub.events.map((event, index) => (
          <List.Item
            key={`${event.at}-${index}`}
            title={`${EVENT_LABELS[event.type] ?? event.type}${event.field ? ` (${FIELD_LABELS[event.field] ?? event.field})` : ''}`}
            description={`${formatDateTime(event.at)} · ${event.actor === 'user' ? 'vous' : 'automatique'}`}
          />
        ))}
      </List.Accordion>

      <Divider />
      <View style={styles.row}>
        {sub.status === 'archived' ? (
          <Button icon="restore" onPress={() => changeStatus.mutate('active')}>
            Réactiver le suivi
          </Button>
        ) : (
          <Button icon="archive-outline" onPress={() => changeStatus.mutate('archived')}>
            Archiver
          </Button>
        )}
        <Button icon="delete-outline" textColor={DESTRUCTIVE_COLOR} onPress={() => setDeleteDialogOpen(true)}>
          Ne plus suivre
        </Button>
      </View>

      <AddPaymentDialog
        subscriptionId={id}
        defaultCents={sub.amount.value.cents}
        currency={sub.amount.value.currency}
        visible={paymentDialogOpen}
        onDismiss={() => setPaymentDialogOpen(false)}
      />
      <ConfirmDialog
        visible={deleteDialogOpen}
        title="Ne plus suivre cet abonnement ?"
        message="L’abonnement et ses paiements seront retirés de l’application. Cela ne résilie PAS votre contrat auprès du fournisseur."
        confirmLabel="Retirer"
        destructive
        loading={stopTracking.isPending}
        onConfirm={() => stopTracking.mutate()}
        onDismiss={() => setDeleteDialogOpen(false)}
      />
    </Screen>
  );
}
