import type { ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { ActivityIndicator, Button, Chip, HelperText, Text, useTheme } from 'react-native-paper';
import type { Origin } from '@subtracker/contracts';
import { ORIGIN_HELP, ORIGIN_LABELS } from '@/lib/format';
import { errorMessage } from '@/lib/http';
import { originColors } from '@/lib/theme';

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
      <Text variant="titleMedium" style={styles.centerText}>
        {title}
      </Text>
      {description ? (
        <Text variant="bodyMedium" style={[styles.centerText, styles.muted]}>
          {description}
        </Text>
      ) : null}
      {children ? <View style={styles.emptyActions}>{children}</View> : null}
    </View>
  );
}

export function OriginChip({ origin }: { origin: Origin }) {
  const theme = useTheme();
  const palette = originColors[origin][theme.dark ? 'dark' : 'light'];
  return (
    <Chip
      compact
      style={[styles.chip, { backgroundColor: palette }]}
      textStyle={styles.chipText}
      accessibilityLabel={`${ORIGIN_LABELS[origin]} : ${ORIGIN_HELP[origin]}`}
    >
      {ORIGIN_LABELS[origin]}
    </Chip>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text variant="titleSmall" style={styles.section}>
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
  const theme = useTheme();
  return (
    <Text variant="bodySmall" style={[{ color: theme.colors.onSurfaceVariant }, style]}>
      {children}
    </Text>
  );
}

export const styles = StyleSheet.create({
  screen: { padding: 16, paddingBottom: 96, alignItems: 'center' },
  inner: { width: '100%', maxWidth: MAX_WIDTH, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerText: { textAlign: 'center' },
  muted: { opacity: 0.7, marginTop: 4 },
  spaced: { marginTop: 12 },
  empty: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16, gap: 4 },
  emptyActions: { marginTop: 16, gap: 8, alignSelf: 'stretch', alignItems: 'center' },
  chip: { alignSelf: 'flex-start' },
  dialog: { maxWidth: 480, alignSelf: 'center', width: '92%' },
  chipText: { fontSize: 12, marginVertical: 0 },
  section: { marginTop: 8, opacity: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});
