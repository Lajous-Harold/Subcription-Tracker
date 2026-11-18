import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import type { DashboardSummary } from '@subtracker/contracts';
import { EstimateTag, OriginChip, Panel } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { radii, tabularNums, useBrand } from '@/lib/theme';

const openReview = () => router.push('/review');

function describeDetections(count: number): string {
  return count === 1 ? '1 abonnement détecté' : `${count} abonnements détectés`;
}

/** Le nombre est déjà dans la tuile orange : le titre ne le répète pas. */
function detectionsTitle(count: number): string {
  return count === 1 ? 'Abonnement détecté' : 'Abonnements détectés';
}

/** Une provenance sans montant n'apprend rien : elle est omise plutôt qu'affichée à 0,00 €. */
function describeMonthlySplit(summary: DashboardSummary): string | null {
  const { observedCents, declaredCents } = summary.monthly;
  const parts = [
    observedCents > 0 ? `${formatMoney(observedCents, summary.currency)} observés` : null,
    declaredCents > 0 ? `${formatMoney(declaredCents, summary.currency)} déclarés` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function describeExcludedCurrencies(summary: DashboardSummary): string | null {
  if (summary.excludedOtherCurrencies.length === 0) return null;
  const parts = summary.excludedOtherCurrencies.map((excluded) => `${excluded.count} en ${excluded.currency}`);
  return `Hors total : ${parts.join(', ')}.`;
}

const BIG_AMOUNT_STYLES = {
  hero: { fontSize: 48, lineHeight: 50, letterSpacing: -2 },
  tile: { fontSize: 36, lineHeight: 42, letterSpacing: -1 },
} satisfies Record<string, TextStyle>;

function BigAmount({
  children,
  scale,
  color,
}: {
  children: string;
  scale: keyof typeof BIG_AMOUNT_STYLES;
  color: string;
}) {
  const { fonts } = useBrand();
  return (
    <Text style={[tabularNums, BIG_AMOUNT_STYLES[scale], { fontFamily: fonts.displayBold, color }]}>{children}</Text>
  );
}

function SmallText({ children, color, style }: { children: ReactNode; color: string; style?: TextStyle }) {
  const { fonts } = useBrand();
  return <Text style={[styles.smallText, { fontFamily: fonts.regular, color }, style]}>{children}</Text>;
}

function MonthlySplitChips({ summary }: { summary: DashboardSummary }) {
  const { observedCents, declaredCents } = summary.monthly;
  if (observedCents <= 0 && declaredCents <= 0) return null;
  return (
    <View style={styles.row}>
      {observedCents > 0 ? (
        <OriginChip origin="observed" value={formatMoney(observedCents, summary.currency)} inverse />
      ) : null}
      {declaredCents > 0 ? (
        <OriginChip origin="declared" value={formatMoney(declaredCents, summary.currency)} inverse />
      ) : null}
    </View>
  );
}

function ExcludedCurrencies({ summary }: { summary: DashboardSummary }) {
  const { colors } = useBrand();
  const text = describeExcludedCurrencies(summary);
  return text ? <SmallText color={colors.hero.muted}>{text}</SmallText> : null;
}

/** Carte du mois en mode compact : le seul fond contrasté de l'écran (sombre en clair, inversé en sombre). */
export function MonthHero({ summary }: { summary: DashboardSummary }) {
  const { colors, fonts } = useBrand();
  return (
    <Panel tone="hero" style={styles.hero}>
      <Text style={[styles.label, { fontFamily: fonts.regular, color: colors.hero.muted }]}>Ce mois-ci</Text>
      <BigAmount scale="hero" color={colors.hero.text}>
        {formatMoney(summary.monthly.totalCents, summary.currency)}
      </BigAmount>
      <MonthlySplitChips summary={summary} />
      <View style={[styles.divider, { backgroundColor: colors.hero.divider }]} />
      <View style={styles.between}>
        <View style={styles.row}>
          <Text style={[styles.label, { fontFamily: fonts.regular, color: colors.hero.muted }]}>Sur 12 mois</Text>
          <EstimateTag inverse />
        </View>
        <Text style={[tabularNums, styles.label, { fontFamily: fonts.bold, color: colors.hero.text }]}>
          {`≈ ${formatMoney(summary.annualProjectionCents, summary.currency)}`}
        </Text>
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
          <Text style={[styles.promptTitle, { fontFamily: fonts.bold, color: colors.ink }]}>
            {detectionsTitle(pendingCount)}
          </Text>
          <SmallText color={colors.signalText}>À confirmer ou ignorer en un geste</SmallText>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={colors.ink} />
      </Panel>
    </Pressable>
  );
}

/** Ligne de libellé à hauteur fixe : les chiffres des quatre tuiles restent alignés, pilule ou non. */
function TileLabel({ children }: { children: ReactNode }) {
  return <View style={styles.tileLabel}>{children}</View>;
}

/** Rangée d'indicateurs du mode large ; chaque chiffre n'y figure qu'une fois. */
export function DashboardIndicators({ summary }: { summary: DashboardSummary }) {
  const { colors, fonts } = useBrand();
  const hasPendingDetections = summary.pendingCandidates > 0;
  const monthlySplit = describeMonthlySplit(summary);
  const labelStyle = [styles.label, { fontFamily: fonts.regular, color: colors.inkMuted }];
  return (
    <View style={styles.indicators}>
      <Panel tone="hero" style={styles.indicator}>
        <TileLabel>
          <Text style={[styles.label, { fontFamily: fonts.regular, color: colors.hero.muted }]}>Coût mensuel</Text>
        </TileLabel>
        <BigAmount scale="tile" color={colors.hero.text}>
          {formatMoney(summary.monthly.totalCents, summary.currency)}
        </BigAmount>
        {monthlySplit ? <SmallText color={colors.hero.muted}>{monthlySplit}</SmallText> : null}
        <ExcludedCurrencies summary={summary} />
      </Panel>
      <Panel style={styles.indicator}>
        <TileLabel>
          <Text style={labelStyle}>Sur 12 mois</Text>
          <EstimateTag />
        </TileLabel>
        <BigAmount scale="tile" color={colors.ink}>
          {formatMoney(summary.annualProjectionCents, summary.currency)}
        </BigAmount>
      </Panel>
      <Panel style={styles.indicator}>
        <TileLabel>
          <Text style={labelStyle}>Abonnements suivis</Text>
        </TileLabel>
        <BigAmount scale="tile" color={colors.ink}>
          {String(summary.trackedCount)}
        </BigAmount>
      </Panel>
      <Pressable
        onPress={openReview}
        accessibilityRole="link"
        accessibilityLabel={`À vérifier : ${describeDetections(summary.pendingCandidates)}. Ouvrir la file`}
        style={({ pressed }) => [styles.indicatorLink, pressed && styles.pressed]}
      >
        <Panel tone={hasPendingDetections ? 'signal' : 'surface'} style={styles.indicator}>
          <TileLabel>
            <Text
              style={[
                styles.label,
                { fontFamily: fonts.semiBold, color: hasPendingDetections ? colors.signalText : colors.inkMuted },
              ]}
            >
              À vérifier
            </Text>
          </TileLabel>
          <BigAmount scale="tile" color={colors.ink}>
            {String(summary.pendingCandidates)}
          </BigAmount>
          <SmallText color={hasPendingDetections ? colors.signalText : colors.action}>Ouvrir la file →</SmallText>
        </Panel>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 14, padding: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  divider: { height: 1 },
  label: { fontSize: 14, lineHeight: 20 },
  smallText: { fontSize: 13, lineHeight: 18 },
  grow: { flex: 1, gap: 2 },
  reviewPrompt: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  promptTitle: { fontSize: 15, lineHeight: 20 },
  countTile: { width: 40, height: 40, borderRadius: radii.control, alignItems: 'center', justifyContent: 'center' },
  indicators: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'stretch' },
  indicator: { flexGrow: 1, flexBasis: 200, gap: 8 },
  tileLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 24 },
  indicatorLink: { flexGrow: 1, flexBasis: 200, flexDirection: 'row' },
  pressed: { opacity: 0.7 },
});
