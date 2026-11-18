import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import type { BankLink } from '@subtracker/contracts';
import { AppButton } from '@/components/AppButton';
import { Muted, Panel } from '@/components/ui';
import { BANK_STATUS_LABELS, formatDateTime, needsBankReconnection } from '@/lib/format';
import { radii, tabularNums, useBrand } from '@/lib/theme';
import { useMinuteClock } from '@/lib/useMinuteClock';
import { bankNotice, formatConsentRemaining, formatSyncAge, isSyncing, type BankNotice } from './bank-display';

type PillTone = 'active' | 'attention' | 'neutral';

function statusPill(link: BankLink): { tone: PillTone; label: string } {
  if (isSyncing(link)) return { tone: 'neutral', label: 'Synchronisation…' };
  if (needsBankReconnection(link) || link.status === 'temporary_error') {
    return { tone: 'attention', label: link.consentExpiringSoon ? 'À renouveler' : BANK_STATUS_LABELS[link.status] };
  }
  if (link.status === 'connected') return { tone: 'active', label: 'Active' };
  return { tone: 'neutral', label: BANK_STATUS_LABELS[link.status] };
}

function StatusPill({ link }: { link: BankLink }) {
  const { colors } = useBrand();
  const { tone, label } = statusPill(link);
  const dotColor: Record<PillTone, string> = {
    active: colors.action,
    attention: colors.signal,
    neutral: colors.inkMuted,
  };
  return (
    <View style={styles.pill} accessible accessibilityLabel={`État : ${label}`}>
      <View style={[styles.dot, { backgroundColor: dotColor[tone] }]} />
      <Text variant="labelMedium" style={{ color: tone === 'attention' ? colors.signalText : colors.ink }}>
        {label}
      </Text>
    </View>
  );
}

function InfoTile({
  label,
  value,
  accessibilityLabel,
  highlighted,
}: {
  label: string;
  value: string;
  accessibilityLabel?: string;
  highlighted?: boolean;
}) {
  const { colors } = useBrand();
  return (
    <View
      style={[styles.tile, { backgroundColor: colors.background }]}
      accessible
      accessibilityLabel={accessibilityLabel ?? `${label} : ${value}`}
    >
      <Muted>{label}</Muted>
      <Text variant="titleMedium" style={[tabularNums, highlighted ? { color: colors.signalText } : null]}>
        {value}
      </Text>
    </View>
  );
}

function NoticeTile({ notice }: { notice: BankNotice }) {
  const { colors } = useBrand();
  const signal = notice.tone === 'signal';
  return (
    <View
      style={[
        styles.notice,
        signal
          ? { backgroundColor: colors.signalTint, borderColor: colors.signalBorder }
          : { backgroundColor: colors.background, borderColor: colors.border },
      ]}
    >
      <Icon
        source={signal ? 'alert-circle-outline' : 'information-outline'}
        size={20}
        color={signal ? colors.signalText : colors.inkMuted}
      />
      <Text variant="bodyMedium" style={[styles.noticeText, { color: signal ? colors.signalText : colors.ink }]}>
        {notice.message}
      </Text>
    </View>
  );
}

export function BankStatusPanel({
  link,
  onSync,
  syncPending,
  onReconnect,
  reconnectPending,
}: {
  link: BankLink;
  onSync: () => void;
  syncPending: boolean;
  onReconnect: () => void;
  reconnectPending: boolean;
}) {
  const { colors } = useBrand();
  const syncing = isSyncing(link);
  const reconnectionNeeded = needsBankReconnection(link);
  const notice = bankNotice(link);
  const now = useMinuteClock();
  const syncAge = syncing ? 'en cours…' : formatSyncAge(link.lastSyncAt, now);

  return (
    <Panel>
      <View style={styles.header}>
        <View style={[styles.bankIcon, { backgroundColor: colors.actionTint }]}>
          <Icon source="bank-outline" size={22} color={colors.action} />
        </View>
        <View style={styles.headerText}>
          <Text variant="titleMedium" accessibilityRole="header" numberOfLines={1}>
            {link.connectorName ?? 'Ma banque'}
          </Text>
          <Muted>via Powens · lecture seule</Muted>
        </View>
        <StatusPill link={link} />
      </View>

      {notice ? <NoticeTile notice={notice} /> : null}

      <View style={styles.tiles}>
        <InfoTile
          label="Dernière synchro"
          value={syncAge}
          accessibilityLabel={`Dernière synchronisation : ${syncing ? 'en cours' : formatDateTime(link.lastSyncAt)}`}
        />
        <InfoTile
          label="Autorisation"
          value={formatConsentRemaining(link.consentExpiresAt, now)}
          highlighted={link.consentExpiringSoon}
        />
      </View>

      {reconnectionNeeded ? (
        <AppButton icon="refresh" onPress={onReconnect} loading={reconnectPending}>
          Reconnecter ma banque
        </AppButton>
      ) : null}
      <AppButton
        variant={reconnectionNeeded ? 'secondary' : 'primary'}
        icon="sync"
        onPress={onSync}
        loading={syncPending}
        disabled={syncPending || syncing}
      >
        {syncing ? 'Synchronisation en cours' : 'Synchroniser maintenant'}
      </AppButton>
    </Panel>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, minWidth: 0 },
  bankIcon: { width: 44, height: 44, borderRadius: radii.control, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: radii.pill },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, minWidth: 0, borderRadius: radii.control, padding: 12, gap: 2 },
  notice: { flexDirection: 'row', gap: 10, borderRadius: radii.control, borderWidth: 1, padding: 12 },
  noticeText: { flex: 1 },
});
