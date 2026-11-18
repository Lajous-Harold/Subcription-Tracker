import { useMutation, useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, IconButton, Text } from 'react-native-paper';
import Svg, { Path } from 'react-native-svg';
import type { Origin, Payment, ResettableField, SubscriptionDetail } from '@subtracker/contracts';
import { AppButton } from '@/components/AppButton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { HeaderIconButton } from '@/components/navigation/HeaderIconButton';
import { useToast } from '@/components/toast';
import { ErrorState, Loading, Muted, OriginChip, Panel, Screen, ServiceMonogram } from '@/components/ui';
import { AddPaymentDialog } from '@/features/subscriptions/AddPaymentDialog';
import {
  CancellationProcedure,
  CancellationTracker,
  useSubscriptionProvider,
} from '@/features/subscriptions/cancellation';
import { leaveTo } from '@/features/subscriptions/navigation';
import { PaymentHistory } from '@/features/subscriptions/PaymentHistory';
import { PROVIDER_CATEGORY_LABELS } from '@/features/subscriptions/presentation';
import { api } from '@/lib/api';
import { formatDateTime, formatMediumDate, formatMoney, formatShortDate } from '@/lib/format';
import { useLayoutMode } from '@/lib/layout';
import { invalidatePaymentData, invalidateSubscriptionData, queryKeys, storeUpdatedSubscription } from '@/lib/query';
import { radii, tabularNums, useBrand } from '@/lib/theme';

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

function ResetButton({ fieldLabel, onPress }: { fieldLabel: string; onPress: () => void }) {
  return (
    <IconButton
      icon="restore"
      size={20}
      style={detailStyles.iconTarget}
      onPress={onPress}
      accessibilityLabel={`Remettre ${fieldLabel} en automatique`}
    />
  );
}

function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <Text variant="titleLarge" accessibilityRole="header">
      {children}
    </Text>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  const { colors } = useBrand();
  return (
    <View style={[detailStyles.detailRow, { borderTopColor: colors.border }]}>
      <Text variant="bodyMedium" style={{ color: colors.inkMuted }}>
        {label}
      </Text>
      <View style={detailStyles.detailValue}>{children}</View>
    </View>
  );
}

function PaymentRow({ payment, subscriptionId }: { payment: Payment; subscriptionId: string }) {
  const brand = useBrand();
  const toast = useToast();
  const fromBank = payment.source === 'bank';
  const removePayment = useMutation({
    mutationFn: () => api.deletePayment(subscriptionId, payment.id),
    onSuccess: () => {
      invalidatePaymentData(subscriptionId);
      toast.show(fromBank ? 'Opération détachée' : 'Paiement supprimé');
    },
    onError: toast.showError,
  });
  const date = formatMediumDate(payment.date);
  const description = [date, fromBank ? 'Opération bancaire' : 'Saisi à la main', payment.note]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={[detailStyles.paymentRow, { borderTopColor: brand.colors.border }]}>
      <View style={[detailStyles.paymentIcon, { backgroundColor: brand.colors.tile }]}>
        <Icon source={fromBank ? 'bank-outline' : 'pencil-outline'} size={18} color={brand.colors.ink} />
      </View>
      <View style={detailStyles.paymentText}>
        <Text style={[detailStyles.paymentAmount, tabularNums, { fontFamily: brand.fonts.displayBold }]}>
          {formatMoney(payment.amount.cents, payment.amount.currency)}
        </Text>
        <Muted>{description}</Muted>
        {payment.possibleDuplicateOfId ? (
          <Text variant="bodySmall" style={{ color: brand.colors.signalText }}>
            Doublon possible d’un paiement saisi à la main
          </Text>
        ) : null}
      </View>
      <AppButton
        variant={fromBank ? 'ghost' : 'destructiveGhost'}
        onPress={() => removePayment.mutate()}
        loading={removePayment.isPending}
        accessibilityLabel={fromBank ? `Détacher l’opération du ${date}` : `Supprimer le paiement du ${date}`}
      >
        {fromBank ? 'Détacher' : 'Supprimer'}
      </AppButton>
    </View>
  );
}

function EditButton({ onPress }: { onPress: () => void }) {
  const brand = useBrand();
  return (
    <HeaderIconButton accessibilityLabel="Modifier l’abonnement" onPress={onPress}>
      {/* Masqué par la `View` : sur le web, `Svg` transmet ses props telles quelles au DOM. */}
      <View aria-hidden>
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path
            d="M4 20h4L19 9l-4-4L4 16z"
            fill="none"
            stroke={brand.colors.ink}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </HeaderIconButton>
  );
}

/** Catégorie du catalogue, puis le fournisseur quand le libellé ne le nomme pas déjà. */
function identitySubtitle(subscription: SubscriptionDetail): string | null {
  const providerName = subscription.provider?.name ?? subscription.customProviderName;
  return (
    [
      subscription.provider ? PROVIDER_CATEGORY_LABELS[subscription.provider.category] : null,
      providerName && providerName !== subscription.label ? providerName : null,
    ]
      .filter(Boolean)
      .join(' · ') || null
  );
}

/** Monogramme, nom et provenance : en tête du contenu en compact, titre de la page en large. */
function SubscriptionIdentity({ subscription, wide }: { subscription: SubscriptionDetail; wide: boolean }) {
  const brand = useBrand();
  const subtitle = identitySubtitle(subscription);
  return (
    <View style={detailStyles.identity}>
      <ServiceMonogram
        name={subscription.provider?.name ?? subscription.customProviderName ?? subscription.label}
        size={wide ? 56 : 64}
      />
      <View style={detailStyles.identityText}>
        <Text
          accessibilityRole="header"
          style={[
            wide ? detailStyles.wideName : detailStyles.name,
            { fontFamily: brand.fonts.displayBold, color: brand.colors.ink },
          ]}
        >
          {subscription.label}
        </Text>
        <View style={detailStyles.identityMeta}>
          <OriginChip origin={subscription.amount.origin} />
          {subscription.status === 'archived' ? (
            <View style={[detailStyles.statusPill, { backgroundColor: brand.colors.tile }]}>
              <Text variant="labelMedium">Archivé</Text>
            </View>
          ) : null}
          {subtitle ? <Text style={[detailStyles.subtitle, { color: brand.colors.inkMuted }]}>{subtitle}</Text> : null}
        </View>
      </View>
    </View>
  );
}

function EventHistory({ events }: { events: SubscriptionDetail['events'] }) {
  const { colors } = useBrand();
  const [expanded, setExpanded] = useState(false);
  return (
    <Panel>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((open) => !open)}
        style={({ pressed }) => [detailStyles.historyToggle, pressed && { opacity: 0.7 }]}
      >
        <Text variant="titleMedium">Historique des modifications</Text>
        <Icon source={expanded ? 'chevron-up' : 'chevron-down'} size={24} color={colors.ink} />
      </Pressable>
      {expanded
        ? events.map((event, index) => (
            <View key={`${event.at}-${index}`} style={[detailStyles.eventRow, { borderTopColor: colors.border }]}>
              <Text variant="bodyMedium">
                {`${EVENT_LABELS[event.type] ?? event.type}${event.field ? ` (${FIELD_LABELS[event.field] ?? event.field})` : ''}`}
              </Text>
              <Muted>{`${formatDateTime(event.at)} · ${event.actor === 'user' ? 'vous' : 'automatique'}`}</Muted>
            </View>
          ))
        : null}
    </Panel>
  );
}

export default function SubscriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const brand = useBrand();
  const isWide = useLayoutMode() === 'wide';
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const subscription = useQuery({ queryKey: queryKeys.subscription(id), queryFn: () => api.subscription(id) });
  const payments = useQuery({ queryKey: queryKeys.payments(id), queryFn: () => api.payments(id) });
  const provider = useSubscriptionProvider(subscription.data);

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
      leaveTo('/subscriptions');
    },
    onError: toast.showError,
  });

  if (subscription.isLoading) return <Loading />;
  if (subscription.error || !subscription.data) {
    return <ErrorState error={subscription.error} onRetry={subscription.refetch} />;
  }
  const sub = subscription.data;
  const paymentList = payments.data ?? [];
  const canReset = (origin: Origin | undefined) => origin === 'declared' && sub.bankLinked;
  const nextDueLabel = sub.nextDueDate
    ? formatShortDate(sub.nextDueDate.value)
    : sub.status === 'active'
      ? 'Inconnu'
      : 'Aucun';
  const openEditor = () => router.push(`/subscriptions/${id}/edit`);

  const missingPaymentNotice = sub.paymentMissing ? (
    <Panel tone="signal" style={detailStyles.notice}>
      <Icon source="calendar-alert" size={22} color={brand.colors.signalText} />
      <Text variant="bodyMedium" style={detailStyles.noticeText}>
        Aucun paiement bancaire observé après l’échéance attendue. Ce n’est pas une preuve de résiliation : vérifiez
        auprès du fournisseur.
      </Text>
    </Panel>
  ) : null;

  const amountPanel = (
    <Panel>
      <View style={detailStyles.amountRow}>
        <View style={detailStyles.amountBlock}>
          <Muted>Chaque mois</Muted>
          <View style={detailStyles.inline}>
            <Text style={[detailStyles.amount, tabularNums, { fontFamily: brand.fonts.displayBold }]}>
              {formatMoney(sub.amount.value.cents, sub.amount.value.currency)}
            </Text>
            {canReset(sub.amount.origin) ? (
              <ResetButton fieldLabel="le montant" onPress={() => reset.mutate('amount')} />
            ) : null}
          </View>
        </View>
        <View style={detailStyles.nextDue}>
          <Muted>Prochain</Muted>
          <View style={detailStyles.inline}>
            {sub.nextDueDate ? <OriginChip origin={sub.nextDueDate.origin} /> : null}
            <Text variant="titleMedium" style={tabularNums}>
              {nextDueLabel}
            </Text>
            {sub.nextDueDate?.origin === 'declared' ? (
              <ResetButton fieldLabel="l’échéance" onPress={() => reset.mutate('nextDueDate')} />
            ) : null}
          </View>
        </View>
      </View>
      {paymentList.length > 0 ? <PaymentHistory payments={paymentList} /> : null}
    </Panel>
  );

  const detailsPanel = (
    <Panel style={detailStyles.compactPanel}>
      <PanelTitle>Détails</PanelTitle>
      <DetailRow label="Jour de prélèvement">
        <Text variant="bodyMedium" style={tabularNums}>
          {sub.billingDay ? `Le ${sub.billingDay.value} du mois` : 'Non renseigné'}
        </Text>
        {sub.billingDay ? <OriginChip origin={sub.billingDay.origin} /> : null}
        {canReset(sub.billingDay?.origin) ? (
          <ResetButton fieldLabel="le jour de prélèvement" onPress={() => reset.mutate('billingDay')} />
        ) : null}
      </DetailRow>
      <DetailRow label="Suivi">
        <Text variant="bodyMedium">{sub.bankLinked ? 'Lié à la banque' : 'Manuel'}</Text>
      </DetailRow>
      {sub.notes ? (
        <DetailRow label="Notes">
          <Text variant="bodyMedium" style={detailStyles.notes}>
            {sub.notes}
          </Text>
        </DetailRow>
      ) : null}
    </Panel>
  );

  const paymentsPanel = (
    <Panel style={detailStyles.compactPanel}>
      <PanelTitle>Paiements</PanelTitle>
      {payments.isLoading ? (
        <Muted>Chargement…</Muted>
      ) : payments.error ? (
        <Muted>Paiements indisponibles. Tirez vers le bas pour réessayer.</Muted>
      ) : paymentList.length === 0 ? (
        <Muted>Aucun paiement enregistré.</Muted>
      ) : (
        <View>
          {paymentList.map((payment) => (
            <PaymentRow key={payment.id} payment={payment} subscriptionId={id} />
          ))}
        </View>
      )}
      <View style={detailStyles.actions}>
        <AppButton
          variant="secondary"
          icon="plus"
          style={detailStyles.action}
          onPress={() => setPaymentDialogOpen(true)}
        >
          Ajouter un paiement
        </AppButton>
        <AppButton
          variant="secondary"
          icon="link-variant"
          style={detailStyles.action}
          onPress={() => router.push(`/subscriptions/${id}/link-payment`)}
        >
          Rattacher une opération
        </AppButton>
      </View>
    </Panel>
  );

  const cancellationPanel = (
    <Panel>
      {provider.isLoading ? (
        <Muted>Chargement de la procédure…</Muted>
      ) : (
        <CancellationProcedure provider={provider.data ?? null} title="Résilier" />
      )}
    </Panel>
  );

  const trackingActions = (
    <View style={detailStyles.actions}>
      {sub.status === 'archived' ? (
        <AppButton
          variant="secondary"
          icon="restore"
          style={detailStyles.action}
          onPress={() => changeStatus.mutate('active')}
        >
          Réactiver le suivi
        </AppButton>
      ) : (
        <AppButton
          variant="secondary"
          icon="archive-outline"
          style={detailStyles.action}
          onPress={() => changeStatus.mutate('archived')}
        >
          Archiver l’abonnement
        </AppButton>
      )}
      <AppButton
        variant="destructiveGhost"
        icon="delete-outline"
        style={detailStyles.action}
        onPress={() => setDeleteDialogOpen(true)}
      >
        Ne plus suivre l’abonnement
      </AppButton>
    </View>
  );

  const dialogs = (
    <>
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
        confirmLabel="Retirer l’abonnement"
        destructive
        loading={stopTracking.isPending}
        onConfirm={() => stopTracking.mutate()}
        onDismiss={() => setDeleteDialogOpen(false)}
      />
    </>
  );

  const refresh = () => {
    void subscription.refetch();
    void payments.refetch();
  };
  const screenOptions = (
    <Stack.Screen
      options={{
        title: sub.label,
        headerTitle: isWide ? () => <SubscriptionIdentity subscription={sub} wide /> : '',
        headerRight: () => <EditButton onPress={openEditor} />,
      }}
    />
  );

  return (
    <Screen refreshing={subscription.isRefetching} onRefresh={refresh}>
      {screenOptions}
      {isWide ? (
        <View style={detailStyles.columns}>
          <View style={detailStyles.mainColumn}>
            {missingPaymentNotice}
            {amountPanel}
            {paymentsPanel}
            {detailsPanel}
            <EventHistory events={sub.events} />
            {trackingActions}
          </View>
          <View style={detailStyles.sideColumn}>
            {cancellationPanel}
            <CancellationTracker subscription={sub} />
          </View>
        </View>
      ) : (
        <>
          <SubscriptionIdentity subscription={sub} wide={false} />
          {missingPaymentNotice}
          {amountPanel}
          {cancellationPanel}
          <CancellationTracker subscription={sub} />
          {paymentsPanel}
          {detailsPanel}
          <EventHistory events={sub.events} />
          {trackingActions}
        </>
      )}
      {dialogs}
    </Screen>
  );
}

const detailStyles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, flexShrink: 1 },
  identityText: { flexShrink: 1, gap: 4 },
  name: { fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  wideName: { fontSize: 32, lineHeight: 38, letterSpacing: -1 },
  identityMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  subtitle: { fontSize: 13, lineHeight: 18 },
  statusPill: { borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 2 },
  iconTarget: { width: 44, height: 44, margin: 0 },
  notice: { flexDirection: 'row', alignItems: 'flex-start' },
  noticeText: { flex: 1 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  amountBlock: { flexShrink: 1 },
  amount: { fontSize: 34, lineHeight: 40, letterSpacing: -1 },
  nextDue: { alignItems: 'flex-end', gap: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  compactPanel: { gap: 4 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // Sans `alignContent`, les lignes repliées se tassent en haut et la hauteur minimale reste vide en bas.
    alignContent: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    minHeight: 48,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  detailValue: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    flexShrink: 1,
  },
  notes: { textAlign: 'right' },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  paymentIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  paymentText: { flex: 1, gap: 2 },
  paymentAmount: { fontSize: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  action: { flexGrow: 1 },
  historyToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  eventRow: { paddingVertical: 8, gap: 2, borderTopWidth: StyleSheet.hairlineWidth },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  mainColumn: { flex: 3, gap: 16 },
  sideColumn: { flex: 2, gap: 16 },
});
