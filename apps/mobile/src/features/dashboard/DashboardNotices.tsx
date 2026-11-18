import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import type { DashboardSummary } from '@subtracker/contracts';
import { AppButton } from '@/components/AppButton';
import { Panel } from '@/components/ui';
import { BANK_STATUS_LABELS, needsBankReconnection } from '@/lib/format';
import { useBrand } from '@/lib/theme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function Notice({
  icon,
  iconColor,
  text,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  iconColor: string;
  text: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <Panel style={styles.notice}>
      <View style={styles.message}>
        <MaterialCommunityIcons name={icon} size={22} color={iconColor} />
        <Text variant="bodyMedium" style={styles.text}>
          {text}
        </Text>
      </View>
      <AppButton variant="ghost" onPress={onAction} style={styles.action}>
        {actionLabel}
      </AppButton>
    </Panel>
  );
}

function describeBankProblem(bank: NonNullable<DashboardSummary['bank']>): string {
  return bank.consentExpiringSoon
    ? 'Votre autorisation bancaire expire bientôt : renouvelez-la pour continuer la détection.'
    : `Connexion bancaire : ${BANK_STATUS_LABELS[bank.status].toLowerCase()}.`;
}

function describeMissingPayments(count: number): string {
  const subject = count === 1 ? '1 abonnement' : `${count} abonnements`;
  return `${subject} sans paiement observé à l’échéance attendue. Ce n’est pas une preuve de résiliation.`;
}

export function DashboardNotices({ summary }: { summary: DashboardSummary }) {
  const { colors } = useBrand();
  const { bank } = summary;
  return (
    <>
      {bank && needsBankReconnection(bank) ? (
        <Notice
          icon="bank-remove"
          iconColor={colors.signalText}
          text={describeBankProblem(bank)}
          actionLabel="Voir la banque"
          onAction={() => router.push('/bank')}
        />
      ) : null}
      {summary.missingPayments > 0 ? (
        <Notice
          icon="calendar-alert"
          iconColor={colors.inkMuted}
          text={describeMissingPayments(summary.missingPayments)}
          actionLabel="Voir les abonnements"
          onAction={() => router.push('/subscriptions')}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  notice: { padding: 16, gap: 4 },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  text: { flex: 1 },
  action: { alignSelf: 'flex-end' },
});
