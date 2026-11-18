import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import type { DashboardSummary } from '@subtracker/contracts';
import { Muted, OriginChip, Panel } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { radii, tabularNums, useBrand } from '@/lib/theme';

const openReview = () => router.push('/review');

function describeDetections(count: number): string {
  return count === 1 ? '1 abonnement détecté' : `${count} abonnements détectés`;
}

function describeExcludedCurrencies(summary: DashboardSummary): string | null {
  if (summary.excludedOtherCurrencies.length === 0) return null;
  const parts = summary.excludedOtherCurrencies.map((excluded) => `${excluded.count} en ${excluded.currency}`);
  return `Hors total : ${parts.join(', ')}.`;
}

function BigAmount({ children, size, color }: { children: string; size: number; color: string }) {
  const { fonts } = useBrand();
  return (
    <Text
      style={[
        tabularNums,
        { fontFamily: fonts.displayBold, fontSize: size, lineHeight: Math.round(size * 1.1), color },
        { letterSpacing: -size / 24 },
      ]}
    >
      {children}
    </Text>
  );
}

function MonthlySplit({ summary }: { summary: DashboardSummary }) {
  return (
    <View style={styles.row}>
      <OriginChip origin="observed" value={formatMoney(summary.monthly.observedCents, summary.currency)} inverse />
      <OriginChip origin="declared" value={formatMoney(summary.monthly.declaredCents, summary.currency)} inverse />
    </View>
  );
}

function ExcludedCurrencies({ summary }: { summary: DashboardSummary }) {
  const { colors } = useBrand();
  const text = describeExcludedCurrencies(summary);
  return text ? (
    <Text variant="bodySmall" style={{ color: colors.hero.muted }}>
      {text}
    </Text>
  ) : null;
}

/** Carte du mois en mode compact : le seul fond sombre de l'écran. */
export function MonthHero({ summary }: { summary: DashboardSummary }) {
  const { colors } = useBrand();
  return (
    <Panel tone="hero" style={styles.hero}>
      <Text variant="bodyMedium" style={{ color: colors.hero.muted }}>
        Ce mois-ci
      </Text>
      <BigAmount size={48} color={colors.hero.text}>
        {formatMoney(summary.monthly.totalCents, summary.currency)}
      </BigAmount>
      <MonthlySplit summary={summary} />
      <View style={[styles.divider, { backgroundColor: colors.hero.divider }]} />
      <View style={styles.between}>
        <View style={styles.row}>
          <Text variant="bodyMedium" style={{ color: colors.hero.muted }}>
            Sur 12 mois
          </Text>
          <OriginChip origin="estimated" inverse />
        </View>
        <BigAmount size={16} color={colors.hero.text}>
          {`≈ ${formatMoney(summary.annualProjectionCents, summary.currency)}`}
        </BigAmount>
      </View>
      <ExcludedCurrencies summary={summary} />
    </Panel>
  );
}

export function ReviewPrompt({ pendingCount }: { pendingCount: number }) {
  const { colors, fonts } = useBrand();
  return (
    <Pressable
      onPress={openReview}
      accessibilityRole="link"
      accessibilityLabel={`${describeDetections(pendingCount)} : à confirmer ou ignorer`}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Panel tone="signal" style={styles.reviewPrompt}>
        <View style={[styles.countTile, { backgroundColor: colors.signal }]}>
          <Text style={[tabularNums, { fontFamily: fonts.displayBold, fontSize: 18, color: colors.onSignal }]}>
            {pendingCount}
          </Text>
        </View>
        <View style={styles.grow}>
          <Text variant="titleMedium">{describeDetections(pendingCount)}</Text>
          <Text variant="bodySmall" style={{ color: colors.signalText }}>
            À confirmer ou ignorer en un geste
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={colors.ink} />
      </Panel>
    </Pressable>
  );
}

function IndicatorTile({ tone, children }: { tone?: 'surface' | 'hero' | 'signal'; children: ReactNode }) {
  return (
    <Panel tone={tone} style={styles.indicator}>
      {children}
    </Panel>
  );
}

/** Rangée d'indicateurs du mode large ; chaque chiffre n'y figure qu'une fois. */
export function DashboardIndicators({ summary }: { summary: DashboardSummary }) {
  const { colors } = useBrand();
  const hasPendingDetections = summary.pendingCandidates > 0;
  return (
    <View style={styles.indicators}>
      <IndicatorTile tone="hero">
        <Text variant="bodyMedium" style={{ color: colors.hero.muted }}>
          Coût mensuel
        </Text>
        <BigAmount size={36} color={colors.hero.text}>
          {formatMoney(summary.monthly.totalCents, summary.currency)}
        </BigAmount>
        <MonthlySplit summary={summary} />
        <ExcludedCurrencies summary={summary} />
      </IndicatorTile>
      <IndicatorTile>
        <View style={styles.row}>
          <Muted style={styles.indicatorLabel}>Sur 12 mois</Muted>
          <OriginChip origin="estimated" />
        </View>
        <BigAmount size={36} color={colors.ink}>
          {formatMoney(summary.annualProjectionCents, summary.currency)}
        </BigAmount>
      </IndicatorTile>
      <IndicatorTile>
        <Muted style={styles.indicatorLabel}>Abonnements suivis</Muted>
        <BigAmount size={36} color={colors.ink}>
          {String(summary.trackedCount)}
        </BigAmount>
      </IndicatorTile>
      <Pressable
        onPress={openReview}
        accessibilityRole="link"
        accessibilityLabel={`À vérifier : ${describeDetections(summary.pendingCandidates)}. Ouvrir la file`}
        style={({ pressed }) => [styles.indicatorLink, pressed && styles.pressed]}
      >
        <IndicatorTile tone={hasPendingDetections ? 'signal' : 'surface'}>
          <Text variant="titleSmall" style={{ color: hasPendingDetections ? colors.signalText : colors.inkMuted }}>
            À vérifier
          </Text>
          <BigAmount size={36} color={colors.ink}>
            {String(summary.pendingCandidates)}
          </BigAmount>
          <Text variant="bodySmall" style={{ color: hasPendingDetections ? colors.signalText : colors.action }}>
            Ouvrir la file →
          </Text>
        </IndicatorTile>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  divider: { height: 1 },
  grow: { flex: 1, gap: 2 },
  reviewPrompt: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  countTile: { width: 40, height: 40, borderRadius: radii.control, alignItems: 'center', justifyContent: 'center' },
  indicators: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'stretch' },
  indicator: { flexGrow: 1, flexBasis: 160, gap: 8 },
  indicatorLabel: { fontSize: 14 },
  indicatorLink: { flexGrow: 1, flexBasis: 160, flexDirection: 'row' },
  pressed: { opacity: 0.7 },
});
