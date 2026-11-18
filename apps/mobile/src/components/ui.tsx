import type { ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { ActivityIndicator, Button, HelperText, Text } from 'react-native-paper';
import type { ConfidenceLevel, Origin } from '@subtracker/contracts';
import { ORIGIN_HELP, ORIGIN_LABELS } from '@/lib/format';
import { errorMessage } from '@/lib/http';
import { radii, tabularNums, useBrand } from '@/lib/theme';

const MAX_WIDTH = 760;

export function Screen({
  children,
  refreshing,
  onRefresh,
  ...props
}: ScrollViewProps & { children: ReactNode; refreshing?: boolean; onRefresh?: () => void }) {
  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} /> : undefined}
      {...props}
    >
      <View style={styles.inner}>{children}</View>
    </ScrollView>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" />
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text variant="bodyLarge" style={styles.centerText}>
        {errorMessage(error)}
      </Text>
      {onRetry ? (
        <Button mode="contained-tonal" onPress={onRetry} style={styles.spaced}>
          Réessayer
        </Button>
      ) : null}
    </View>
  );
}

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Text variant="titleLarge" style={styles.centerText}>
        {title}
      </Text>
      {description ? <Muted style={[styles.centerText, styles.emptyDescription]}>{description}</Muted> : null}
      {children ? <View style={styles.emptyActions}>{children}</View> : null}
    </View>
  );
}

type PanelTone = 'surface' | 'hero' | 'signal';

/** `hero` est le seul fond sombre d'un écran (le montant du mois) ; `signal` signale ce qui est à vérifier. */
export function Panel({
  tone = 'surface',
  style,
  children,
}: {
  tone?: PanelTone;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { colors } = useBrand();
  const toneStyle: Record<PanelTone, ViewStyle> = {
    surface: { backgroundColor: colors.surface, borderColor: colors.border },
    hero: { backgroundColor: colors.hero.background, borderColor: colors.hero.background },
    signal: { backgroundColor: colors.signalTint, borderColor: colors.signalBorder },
  };
  return <View style={[styles.panel, toneStyle[tone], style]}>{children}</View>;
}

/** La provenance se lit à la forme, pas seulement à la couleur : plein, contour, pointillé. */
export function OriginChip({ origin, value, inverse }: { origin: Origin; value?: string; inverse?: boolean }) {
  const { colors } = useBrand();
  const strong = inverse ? colors.hero.text : colors.ink;
  const onStrong = inverse ? colors.hero.background : colors.surface;
  const muted = inverse ? colors.hero.muted : colors.inkMuted;
  const shape: Record<Origin, { box: ViewStyle; text: string }> = {
    observed: { box: { backgroundColor: strong, borderColor: strong }, text: onStrong },
    declared: { box: { borderColor: strong }, text: strong },
    estimated: { box: { borderColor: muted, borderStyle: 'dashed' }, text: muted },
  };
  const label = value ? `${ORIGIN_LABELS[origin]} ${value}` : ORIGIN_LABELS[origin];
  return (
    <View
      style={[styles.originChip, shape[origin].box]}
      accessible
      accessibilityLabel={`${label} : ${ORIGIN_HELP[origin]}`}
    >
      <Text variant="labelMedium" style={[tabularNums, { color: shape[origin].text }]}>
        {label}
      </Text>
    </View>
  );
}

const CONFIDENCE_SEGMENTS: Record<ConfidenceLevel, number> = { high: 3, medium: 2, low: 1 };
const CONFIDENCE_LEVEL_LABELS: Record<ConfidenceLevel, string> = { high: 'Élevée', medium: 'Moyenne', low: 'Faible' };

export function ConfidenceMeter({ level, confidence }: { level: ConfidenceLevel; confidence: number }) {
  const { colors } = useBrand();
  const filledSegments = CONFIDENCE_SEGMENTS[level];
  const percent = `${Math.round(confidence * 100)} %`;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`Confiance ${CONFIDENCE_LEVEL_LABELS[level].toLowerCase()} : ${percent}`}
    >
      <View style={styles.meterTrack}>
        {[1, 2, 3].map((segment) => (
          <View
            key={segment}
            style={[
              styles.meterSegment,
              { backgroundColor: segment <= filledSegments ? colors.action : colors.trackInactive },
            ]}
          />
        ))}
      </View>
      <Text variant="bodySmall" style={tabularNums}>{`${CONFIDENCE_LEVEL_LABELS[level]} · ${percent}`}</Text>
    </View>
  );
}

/** Services en monogramme neutre : jamais de logo redessiné d'une marque réelle. */
export function ServiceMonogram({ name, size = 36 }: { name: string; size?: number }) {
  const brand = useBrand();
  const initial = name.match(/[\p{L}\p{N}]/u)?.[0]?.toLocaleUpperCase('fr-FR') ?? '?';
  return (
    <View
      style={[
        styles.monogram,
        { width: size, height: size, borderRadius: Math.round(size * 0.28), backgroundColor: brand.colors.tile },
      ]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Text style={{ fontFamily: brand.fonts.bold, fontSize: Math.round(size * 0.42), color: brand.colors.ink }}>
        {initial}
      </Text>
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text variant="titleLarge" accessibilityRole="header" style={styles.section}>
      {children}
    </Text>
  );
}

export function ErrorText({ message }: { message?: string | null }) {
  return message ? (
    <HelperText type="error" visible>
      {message}
    </HelperText>
  ) : null;
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useBrand();
  return (
    <Text variant="bodySmall" style={[{ color: colors.inkMuted }, style]}>
      {children}
    </Text>
  );
}

export const styles = StyleSheet.create({
  screen: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 96, alignItems: 'center' },
  inner: { width: '100%', maxWidth: MAX_WIDTH, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerText: { textAlign: 'center' },
  spaced: { marginTop: 12 },
  empty: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16, gap: 4 },
  emptyDescription: { marginTop: 4 },
  emptyActions: { marginTop: 16, gap: 8, alignSelf: 'stretch', alignItems: 'center' },
  panel: { borderRadius: radii.panel, borderWidth: 1, padding: 20, gap: 12 },
  originChip: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    borderWidth: 1.5,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  meterTrack: { flexDirection: 'row', gap: 3 },
  meterSegment: { width: 18, height: 8, borderRadius: 4 },
  monogram: { alignItems: 'center', justifyContent: 'center' },
  dialog: { maxWidth: 480, alignSelf: 'center', width: '92%', borderRadius: radii.panel },
  section: { marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});
