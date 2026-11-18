import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import type { Payment } from '@subtracker/contracts';
import { useBrand } from '@/lib/theme';
import { describePaymentHistory, latestPayments, paymentBars } from './presentation';

const CHART_HEIGHT = 56;
const PAST_BAR_OPACITY = 0.3;

/** Le plus récent en cobalt plein, les précédents en cobalt atténué. */
export function PaymentHistory({ payments }: { payments: Payment[] }) {
  const { colors } = useBrand();
  const latest = latestPayments(payments);
  const bars = paymentBars(latest);
  return (
    <View
      style={historyStyles.container}
      accessible
      accessibilityRole="image"
      accessibilityLabel={describePaymentHistory(latest)}
    >
      <View style={historyStyles.chart}>
        {bars.map((bar, index) => (
          <View
            key={bar.id}
            style={[
              historyStyles.bar,
              {
                height: CHART_HEIGHT * bar.heightRatio,
                backgroundColor: colors.action,
                opacity: index === bars.length - 1 ? 1 : PAST_BAR_OPACITY,
              },
            ]}
          />
        ))}
      </View>
      <View style={historyStyles.labels}>
        {bars.map((bar) => (
          <Text key={bar.id} variant="bodySmall" style={[historyStyles.label, { color: colors.inkMuted }]}>
            {bar.monthLabel}
          </Text>
        ))}
      </View>
    </View>
  );
}

const historyStyles = StyleSheet.create({
  container: { gap: 6 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: CHART_HEIGHT },
  bar: { flex: 1, borderRadius: 6 },
  labels: { flexDirection: 'row', gap: 8 },
  label: { flex: 1, textAlign: 'center', fontSize: 11 },
});
