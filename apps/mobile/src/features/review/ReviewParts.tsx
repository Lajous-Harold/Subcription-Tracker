import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import type { Candidate, CandidateOperation } from '@subtracker/contracts';
import { AppButton } from '@/components/AppButton';
import { EmptyState, Muted, Panel } from '@/components/ui';
import { formatMediumDate, formatMoney, formatSignedMoney } from '@/lib/format';
import { radii, tabularNums, useAppTheme, useBrand } from '@/lib/theme';
import { decisionMessage, describeHiddenOperations, type DecidedCandidate } from './review-session';

export const openCandidate = (candidateId: string) => router.push(`/candidates/${candidateId}`);

export function monthlyAmount(candidate: Candidate): string {
  return formatMoney(candidate.amount.lastCents, candidate.currency);
}

export function StalePill() {
  const { colors, fonts } = useBrand();
  return (
    <View style={[styles.pill, { backgroundColor: colors.signalTint, borderColor: colors.signalBorder }]}>
      <Text style={[styles.pillText, { fontFamily: fonts.semiBold, color: colors.signalText }]}>Peut-être terminé</Text>
    </View>
  );
}

export function Reason({ children }: { children: string }) {
  const { colors } = useBrand();
  return (
    <View style={styles.reason}>
      <MaterialCommunityIcons name="check" size={18} color={colors.action} style={styles.reasonIcon} />
      <Text variant="bodyMedium" style={styles.reasonText}>
        {children}
      </Text>
    </View>
  );
}

export function ReasonList({ reasons }: { reasons: readonly string[] }) {
  return (
    <View style={styles.reasons}>
      {reasons.map((reason) => (
        <Reason key={reason}>{reason}</Reason>
      ))}
    </View>
  );
}

export function MergeNotice() {
  const { colors } = useBrand();
  return (
    <Text variant="bodySmall" style={{ color: colors.inkMuted }}>
      Vous suivez déjà un abonnement chez ce fournisseur : le suivre y rattachera ces paiements.
    </Text>
  );
}

export function SectionLabel({ children }: { children: string }) {
  const { colors, fonts } = useBrand();
  return (
    <Text
      accessibilityRole="header"
      style={[styles.sectionLabel, { fontFamily: fonts.semiBold, color: colors.inkMuted }]}
    >
      {children}
    </Text>
  );
}

/** De la plus récente à la plus ancienne ; au-delà de `collapsedCount`, les plus anciennes se replient. */
export function OperationList({
  operations,
  currency,
  collapsedCount,
}: {
  operations: readonly CandidateOperation[];
  currency: string;
  collapsedCount?: number;
}) {
  const { colors, fonts } = useBrand();
  const [expanded, setExpanded] = useState(false);
  if (operations.length === 0) return <Muted>Ces opérations ne sont plus présentes à la banque.</Muted>;

  const overflow = collapsedCount === undefined ? 0 : Math.max(0, operations.length - collapsedCount);
  // Replier pour une seule ligne coûterait plus qu'elle : on l'affiche directement.
  const hiddenCount = overflow > 1 ? overflow : 0;
  const shown = hiddenCount > 0 && !expanded ? operations.slice(0, collapsedCount) : operations;
  return (
    <View>
      <View role="list">
        {shown.map((operation, index) => {
          const date = formatMediumDate(operation.date);
          const amount = formatSignedMoney(operation.amountCents, currency);
          return (
            <View
              key={operation.id}
              role="listitem"
              accessible
              accessibilityLabel={`${date}, ${amount}`}
              style={[styles.operation, index > 0 ? { borderTopWidth: 1, borderTopColor: colors.tile } : null]}
            >
              <Text variant="bodyMedium" style={tabularNums}>
                {date}
              </Text>
              <Text variant="bodyMedium" style={tabularNums}>
                {amount}
              </Text>
            </View>
          );
        })}
      </View>
      {hiddenCount > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((current) => !current)}
          style={({ pressed }) => [styles.operationsToggle, pressed && styles.pressed]}
        >
          <Text style={{ fontFamily: fonts.semiBold, color: colors.action }}>
            {expanded ? 'Réduire la liste' : describeHiddenOperations(hiddenCount)}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const UNDO_BANNER_MIN_HEIGHT = 48;
export const REASON_GAP = 10;

/** Reste affiché tant que la décision n'est pas partie : « Annuler » la reprend alors à coup sûr. */
export function UndoBanner({
  undoable,
  onUndo,
  style,
}: {
  undoable: DecidedCandidate | null;
  onUndo: (candidateId: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const { fonts } = theme.brand;
  if (!undoable) return null;
  return (
    <View
      role="status"
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: theme.colors.inverseSurface, borderRadius: radii.control }, style]}
    >
      <Text
        variant="bodyMedium"
        numberOfLines={2}
        style={[styles.bannerText, { color: theme.colors.inverseOnSurface }]}
      >
        {decisionMessage(undoable)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Annuler : ${decisionMessage(undoable)}`}
        onPress={() => onUndo(undoable.candidateId)}
        style={({ pressed }) => [styles.bannerAction, pressed && styles.pressed]}
      >
        <Text style={{ fontFamily: fonts.semiBold, color: theme.colors.inversePrimary }}>Annuler</Text>
      </Pressable>
    </View>
  );
}

export function ReviewEmpty() {
  return (
    <Panel>
      <EmptyState
        title="Rien à vérifier"
        description="Les abonnements repérés dans vos opérations apparaissent ici après chaque synchronisation bancaire. Rien n’est suivi sans votre accord."
      >
        <AppButton variant="secondary" icon="bank-outline" onPress={() => router.navigate('/bank')}>
          Ouvrir la banque
        </AppButton>
      </EmptyState>
    </Panel>
  );
}

export function AmountText({ children, size }: { children: string; size: number }) {
  const { colors, fonts } = useBrand();
  return (
    <Text
      style={[
        tabularNums,
        {
          fontFamily: fonts.displayBold,
          fontSize: size,
          lineHeight: Math.round(size * 1.15),
          letterSpacing: -size / 28,
          color: colors.ink,
        },
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  pillText: { fontSize: 12, lineHeight: 18 },
  reasons: { gap: REASON_GAP },
  reason: { flexDirection: 'row', gap: 10 },
  reasonIcon: { marginTop: 1 },
  reasonText: { flex: 1 },
  sectionLabel: { fontSize: 14, lineHeight: 20, letterSpacing: 1, textTransform: 'uppercase' },
  operation: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6 },
  operationsToggle: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  banner: {
    minHeight: UNDO_BANNER_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingLeft: 16,
    paddingRight: 4,
  },
  bannerText: { flex: 1 },
  bannerAction: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
