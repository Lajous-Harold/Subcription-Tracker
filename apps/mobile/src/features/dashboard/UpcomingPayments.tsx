import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import type { DashboardSummary } from '@subtracker/contracts';
import { Muted, Panel, ServiceMonogram } from '@/components/ui';
import { DataTable, type TableColumn } from '@/components/DataTable';
import { formatCalendarDay, formatDate, formatMoney, formatShortDate } from '@/lib/format';
import type { LayoutMode } from '@/lib/layout';
import { tabularNums, useBrand } from '@/lib/theme';

type UpcomingPayment = DashboardSummary['upcoming'][number];

const openSubscription = (payment: UpcomingPayment) => router.push(`/subscriptions/${payment.subscriptionId}`);

const isDateEstimated = (payment: UpcomingPayment) => payment.dateOrigin === 'estimated';

function describeForScreenReader(payment: UpcomingPayment): string {
  const when = `${isDateEstimated(payment) ? 'date estimée au' : 'le'} ${formatDate(payment.date)}`;
  return `${payment.label}, ${formatMoney(payment.amountCents, payment.currency)}, ${when}`;
}

function Amount({ payment }: { payment: UpcomingPayment }) {
  const { colors, fonts } = useBrand();
  return (
    <Text style={[tabularNums, styles.amount, { fontFamily: fonts.displayBold, color: colors.ink }]}>
      {formatMoney(payment.amountCents, payment.currency)}
    </Text>
  );
}

function UpcomingList({ upcoming }: { upcoming: UpcomingPayment[] }) {
  const { colors, fonts } = useBrand();
  return (
    <View>
      {upcoming.map((payment) => {
        const { day, month } = formatCalendarDay(payment.date);
        return (
          <Pressable
            key={`${payment.subscriptionId}-${payment.date}`}
            onPress={() => openSubscription(payment)}
            accessibilityRole="link"
            accessibilityLabel={describeForScreenReader(payment)}
            style={({ pressed }) => [styles.listRow, { borderTopColor: colors.tile }, pressed && styles.pressed]}
          >
            <View style={styles.dateColumn}>
              <Text style={[tabularNums, styles.day, { fontFamily: fonts.displayBold, color: colors.ink }]}>{day}</Text>
              <Muted>{month}</Muted>
            </View>
            <ServiceMonogram name={payment.label} />
            <View style={styles.grow}>
              <Text variant="titleMedium" numberOfLines={1}>
                {payment.label}
              </Text>
              {isDateEstimated(payment) ? <Muted>date estimée</Muted> : null}
            </View>
            <Amount payment={payment} />
          </Pressable>
        );
      })}
    </View>
  );
}

const TABLE_COLUMNS: TableColumn<UpcomingPayment>[] = [
  {
    title: 'Date',
    flex: 1.4,
    render: (payment) => (
      <Text variant="bodyMedium" style={tabularNums}>
        {formatShortDate(payment.date)}
        {isDateEstimated(payment) ? <Muted> (estimée)</Muted> : null}
      </Text>
    ),
  },
  {
    title: 'Service',
    flex: 3,
    render: (payment) => (
      <View style={styles.serviceCell}>
        <ServiceMonogram name={payment.label} size={32} />
        <Text variant="titleSmall" numberOfLines={1} style={styles.grow}>
          {payment.label}
        </Text>
      </View>
    ),
  },
  { title: 'Montant', flex: 1.2, align: 'right', render: (payment) => <Amount payment={payment} /> },
];

export function UpcomingPayments({ upcoming, layoutMode }: { upcoming: UpcomingPayment[]; layoutMode: LayoutMode }) {
  return (
    <Panel style={styles.panel}>
      <View style={styles.header}>
        <Text variant="titleLarge" accessibilityRole="header">
          Prochains prélèvements
        </Text>
        <Muted>30 jours</Muted>
      </View>
      {upcoming.length === 0 ? (
        <Muted style={styles.empty}>Aucune échéance connue dans les 30 prochains jours.</Muted>
      ) : layoutMode === 'wide' ? (
        <DataTable
          columns={TABLE_COLUMNS}
          rows={upcoming}
          rowKey={(payment) => `${payment.subscriptionId}-${payment.date}`}
          rowLabel={describeForScreenReader}
          onPressRow={openSubscription}
          minWidth={420}
        />
      ) : (
        <UpcomingList upcoming={upcoming} />
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  empty: { paddingBottom: 12 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    minHeight: 56,
    borderTopWidth: 1,
  },
  dateColumn: { width: 44, alignItems: 'center' },
  day: { fontSize: 18, lineHeight: 20 },
  grow: { flex: 1, gap: 2 },
  serviceCell: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  amount: { fontSize: 16 },
  pressed: { opacity: 0.6 },
});
