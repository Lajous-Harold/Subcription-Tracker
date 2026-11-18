import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DashboardSummary } from '@subtracker/contracts';
import { Muted, Panel, ServiceMonogram } from '@/components/ui';
import { formatCalendarDay, formatDate, formatMoney } from '@/lib/format';
import { tabularNums, useBrand } from '@/lib/theme';

type UpcomingPayment = DashboardSummary['upcoming'][number];

const openSubscription = (payment: UpcomingPayment) => router.push(`/subscriptions/${payment.subscriptionId}`);

const isDateEstimated = (payment: UpcomingPayment) => payment.dateOrigin === 'estimated';

function describeForScreenReader(payment: UpcomingPayment): string {
  const when = `${isDateEstimated(payment) ? 'date estimée au' : 'le'} ${formatDate(payment.date)}`;
  return `${payment.label}, ${formatMoney(payment.amountCents, payment.currency)}, ${when}`;
}

/** Jour sur deux chiffres, comme un calendrier : les colonnes de dates restent alignées. */
function CalendarDay({ date }: { date: string }) {
  const { colors, fonts } = useBrand();
  const { day, month } = formatCalendarDay(date);
  return (
    <View style={styles.dateColumn}>
      <Text style={[tabularNums, styles.day, { fontFamily: fonts.displayBold, color: colors.ink }]}>
        {day.padStart(2, '0')}
      </Text>
      <Text style={[styles.month, { fontFamily: fonts.regular, color: colors.inkMuted }]}>{month}</Text>
    </View>
  );
}

function UpcomingRow({ payment }: { payment: UpcomingPayment }) {
  const { colors, fonts } = useBrand();
  return (
    <Pressable
      onPress={() => openSubscription(payment)}
      accessibilityRole="link"
      accessibilityLabel={describeForScreenReader(payment)}
      style={({ pressed }) => [styles.row, { borderTopColor: colors.tile }, pressed && styles.pressed]}
    >
      <CalendarDay date={payment.date} />
      <ServiceMonogram name={payment.label} />
      <View style={styles.grow}>
        <Text numberOfLines={2} style={[styles.label, { fontFamily: fonts.semiBold, color: colors.ink }]}>
          {payment.label}
        </Text>
        {isDateEstimated(payment) ? <Muted>date estimée</Muted> : null}
      </View>
      <Text style={[tabularNums, styles.amount, { fontFamily: fonts.bold, color: colors.ink }]}>
        {formatMoney(payment.amountCents, payment.currency)}
      </Text>
    </Pressable>
  );
}

/** Échéances de l'accueil compact ; en mode large, la colonne « Prochaine échéance » du tableau en tient lieu. */
export function UpcomingPayments({ upcoming }: { upcoming: UpcomingPayment[] }) {
  const { colors, fonts } = useBrand();
  return (
    <Panel style={styles.panel}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { fontFamily: fonts.displayBold, color: colors.ink }]}>
          Prochains prélèvements
        </Text>
        <Text style={[styles.period, { fontFamily: fonts.regular, color: colors.inkMuted }]}>30 jours</Text>
      </View>
      {upcoming.length === 0 ? (
        <Muted style={styles.empty}>Aucune échéance connue dans les 30 prochains jours.</Muted>
      ) : (
        <View>
          {upcoming.map((payment) => (
            <UpcomingRow key={`${payment.subscriptionId}-${payment.date}`} payment={payment} />
          ))}
        </View>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  title: { flexShrink: 1, fontSize: 18, lineHeight: 24 },
  period: { flexShrink: 0, fontSize: 13, lineHeight: 18 },
  empty: { paddingBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 56, borderTopWidth: 1 },
  dateColumn: { width: 44, alignItems: 'center' },
  day: { fontSize: 18, lineHeight: 20 },
  month: { fontSize: 12, lineHeight: 13 },
  grow: { flex: 1, gap: 2 },
  label: { fontSize: 15, lineHeight: 20 },
  amount: { fontSize: 15 },
  pressed: { opacity: 0.6 },
});
