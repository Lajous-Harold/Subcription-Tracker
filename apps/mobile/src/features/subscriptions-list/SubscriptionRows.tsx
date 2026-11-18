import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import type { Subscription } from '@subtracker/contracts';
import { Muted, OriginChip, ServiceMonogram } from '@/components/ui';
import { formatMoney, ORIGIN_LABELS } from '@/lib/format';
import { tabularNums, useBrand } from '@/lib/theme';
import { DataTable, type TableColumn } from '@/components/DataTable';
import {
  formatDueDay,
  formatNextDueDate,
  isNextDueDateEstimated,
  providerHint,
  summarizeCancellation,
} from './filters';

const PAYMENT_MISSING_TEXT = 'Paiement non observé à l’échéance';

const openSubscription = (sub: Subscription) => router.push(`/subscriptions/${sub.id}`);

function formatMonthlyAmount(sub: Subscription): string {
  return formatMoney(sub.amount.value.cents, sub.amount.value.currency);
}

function describeForScreenReader(sub: Subscription): string {
  return [
    sub.label,
    providerHint(sub),
    `${formatMonthlyAmount(sub)} par mois, ${ORIGIN_LABELS[sub.amount.origin].toLowerCase()}`,
    sub.nextDueDate ? `prochaine échéance ${formatNextDueDate(sub)}` : null,
    summarizeCancellation(sub)?.text,
    sub.paymentMissing ? PAYMENT_MISSING_TEXT : null,
  ]
    .filter(Boolean)
    .join(', ');
}

/** Les montants suivent le texte courant (Inter) : gras en liste, demi-gras dans le tableau, comme les maquettes. */
function MonthlyAmount({ sub, inTable = false }: { sub: Subscription; inTable?: boolean }) {
  const { colors, fonts } = useBrand();
  const fontStyle = inTable ? { fontFamily: fonts.semiBold, fontSize: 14 } : { fontFamily: fonts.bold, fontSize: 15 };
  return <Text style={[tabularNums, fontStyle, { color: colors.ink }]}>{formatMonthlyAmount(sub)}</Text>;
}

function SignalText({ children }: { children: string }) {
  const { colors } = useBrand();
  return (
    <Text variant="bodySmall" style={{ color: colors.signalText }}>
      {children}
    </Text>
  );
}

/** Une démarche en cours se suit en orange ; sans démarche, un abonnement actif se dit simplement « Active ». */
function CancellationCell({ sub }: { sub: Subscription }) {
  const { colors, fonts } = useBrand();
  const summary = summarizeCancellation(sub);
  if (!summary) return <Muted style={styles.cellText}>{sub.status === 'active' ? 'Active' : '—'}</Muted>;
  return summary.needsFollowUp ? (
    <Text style={[styles.cellText, { color: colors.signalText, fontFamily: fonts.semiBold }]}>{summary.text}</Text>
  ) : (
    <Muted style={styles.cellText}>{summary.text}</Muted>
  );
}

function describeCompactDetails(sub: Subscription): string {
  const dueDate = sub.nextDueDate
    ? `Échéance ${formatDueDay(sub.nextDueDate.value)}${isNextDueDateEstimated(sub) ? ' (estimée)' : ''}`
    : null;
  return [providerHint(sub), dueDate].filter(Boolean).join(' · ');
}

export function SubscriptionList({ subscriptions }: { subscriptions: Subscription[] }) {
  const { colors, fonts } = useBrand();
  return (
    <View>
      {subscriptions.map((sub, index) => {
        const details = describeCompactDetails(sub);
        const cancellation = summarizeCancellation(sub);
        return (
          <Pressable
            key={sub.id}
            onPress={() => openSubscription(sub)}
            accessibilityRole="link"
            accessibilityLabel={describeForScreenReader(sub)}
            style={({ pressed }) => [
              styles.listRow,
              index > 0 && { borderTopWidth: 1, borderTopColor: colors.tile },
              pressed && styles.pressed,
            ]}
          >
            <ServiceMonogram name={sub.label} />
            <View style={styles.listBody}>
              <Text numberOfLines={2} style={[styles.listLabel, { fontFamily: fonts.semiBold, color: colors.ink }]}>
                {sub.label}
              </Text>
              {details ? <Muted>{details}</Muted> : null}
              {cancellation ? (
                cancellation.needsFollowUp ? (
                  <SignalText>{cancellation.text}</SignalText>
                ) : (
                  <Muted>{cancellation.text}</Muted>
                )
              ) : null}
              {sub.paymentMissing ? <SignalText>{PAYMENT_MISSING_TEXT}</SignalText> : null}
            </View>
            <View style={styles.listAmount}>
              <MonthlyAmount sub={sub} />
              <OriginChip origin={sub.amount.origin} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const TABLE_COLUMNS: TableColumn<Subscription>[] = [
  {
    title: 'Service',
    flex: 2.4,
    render: (sub) => {
      const hint = providerHint(sub);
      return (
        <View style={styles.serviceCell}>
          <Text variant="titleSmall" numberOfLines={1}>
            {sub.label}
          </Text>
          {hint ? <Muted>{hint}</Muted> : null}
        </View>
      );
    },
  },
  { title: 'Origine', flex: 1.3, render: (sub) => <OriginChip origin={sub.amount.origin} /> },
  {
    title: 'Prochaine échéance',
    flex: 2,
    render: (sub) => (
      <View>
        <Text variant="bodyMedium" style={tabularNums}>
          {sub.nextDueDate ? formatDueDay(sub.nextDueDate.value) : '—'}
          {isNextDueDateEstimated(sub) ? <Muted style={styles.cellText}> (estimée)</Muted> : null}
        </Text>
        {sub.paymentMissing ? <SignalText>{PAYMENT_MISSING_TEXT}</SignalText> : null}
      </View>
    ),
  },
  { title: 'Résiliation', flex: 2.8, render: (sub) => <CancellationCell sub={sub} /> },
  { title: 'Par mois', flex: 1.3, align: 'right', render: (sub) => <MonthlyAmount sub={sub} inTable /> },
];

export function SubscriptionTable({ subscriptions }: { subscriptions: Subscription[] }) {
  return (
    <DataTable
      columns={TABLE_COLUMNS}
      rows={subscriptions}
      rowKey={(sub) => sub.id}
      rowLabel={describeForScreenReader}
      onPressRow={openSubscription}
      minWidth={640}
    />
  );
}

const styles = StyleSheet.create({
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 64 },
  listBody: { flex: 1, gap: 2 },
  listLabel: { fontSize: 15, lineHeight: 20 },
  listAmount: { alignItems: 'flex-end', gap: 6 },
  serviceCell: { alignSelf: 'stretch', gap: 2 },
  cellText: { fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.6 },
});
