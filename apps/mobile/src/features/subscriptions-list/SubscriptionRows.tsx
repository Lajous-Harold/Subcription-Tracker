import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import type { Subscription } from '@subtracker/contracts';
import { Muted, OriginChip, ServiceMonogram } from '@/components/ui';
import { formatMoney, ORIGIN_LABELS } from '@/lib/format';
import { tabularNums, useBrand } from '@/lib/theme';
import { DataTable, type TableColumn } from '@/components/DataTable';
import { formatNextDueDate, providerHint, summarizeCancellation } from './filters';

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

function MonthlyAmount({ sub }: { sub: Subscription }) {
  const { colors, fonts } = useBrand();
  return (
    <Text style={[tabularNums, styles.amount, { fontFamily: fonts.displayBold, color: colors.ink }]}>
      {formatMonthlyAmount(sub)}
    </Text>
  );
}

function SignalText({ children }: { children: string }) {
  const { colors } = useBrand();
  return (
    <Text variant="bodySmall" style={{ color: colors.signalText }}>
      {children}
    </Text>
  );
}

function CancellationText({ sub, emptyText }: { sub: Subscription; emptyText?: string }) {
  const summary = summarizeCancellation(sub);
  if (!summary) return emptyText ? <Muted>{emptyText}</Muted> : null;
  return summary.needsFollowUp ? <SignalText>{summary.text}</SignalText> : <Muted>{summary.text}</Muted>;
}

export function SubscriptionList({ subscriptions }: { subscriptions: Subscription[] }) {
  const { colors } = useBrand();
  return (
    <View>
      {subscriptions.map((sub, index) => {
        const details = [providerHint(sub), sub.nextDueDate ? `Prochaine échéance ${formatNextDueDate(sub)}` : null]
          .filter(Boolean)
          .join(' · ');
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
            <ServiceMonogram name={sub.label} size={40} />
            <View style={styles.listBody}>
              <Text variant="titleMedium" numberOfLines={1}>
                {sub.label}
              </Text>
              {details ? <Muted>{details}</Muted> : null}
              <CancellationText sub={sub} />
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
    flex: 3,
    render: (sub) => {
      const hint = providerHint(sub);
      return (
        <View style={styles.serviceCell}>
          <ServiceMonogram name={sub.label} size={32} />
          <View style={styles.listBody}>
            <Text variant="titleSmall" numberOfLines={1}>
              {sub.label}
            </Text>
            {hint ? <Muted>{hint}</Muted> : null}
          </View>
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
          {formatNextDueDate(sub)}
        </Text>
        {sub.paymentMissing ? <SignalText>{PAYMENT_MISSING_TEXT}</SignalText> : null}
      </View>
    ),
  },
  {
    title: 'Résiliation',
    flex: 2.4,
    render: (sub) => <CancellationText sub={sub} emptyText="—" />,
  },
  { title: 'Par mois', flex: 1.3, align: 'right', render: (sub) => <MonthlyAmount sub={sub} /> },
];

export function SubscriptionTable({ subscriptions }: { subscriptions: Subscription[] }) {
  return (
    <DataTable
      columns={TABLE_COLUMNS}
      rows={subscriptions}
      rowKey={(sub) => sub.id}
      rowLabel={describeForScreenReader}
      onPressRow={openSubscription}
      minWidth={720}
    />
  );
}

const styles = StyleSheet.create({
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 64 },
  listBody: { flex: 1, gap: 2 },
  listAmount: { alignItems: 'flex-end', gap: 6 },
  serviceCell: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  amount: { fontSize: 16 },
  pressed: { opacity: 0.6 },
});
