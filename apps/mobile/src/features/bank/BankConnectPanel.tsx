import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { AppButton } from '@/components/AppButton';
import { Muted, Panel } from '@/components/ui';
import { BANK_STATUS_HELP } from '@/lib/format';
import { useLayoutMode } from '@/lib/layout';
import { radii, useBrand } from '@/lib/theme';

const CONNECTION_DETAILS = [
  'Vos débits servent à repérer vos abonnements automatiquement.',
  'La connexion passe par Powens, prestataire agréé : vous vous authentifiez sur son parcours officiel et choisissez les comptes à partager.',
  'Vos identifiants bancaires ne transitent jamais par l’application.',
  'Seuls les débits sont importés, en lecture seule : aucun paiement ni virement n’est possible.',
  'Vous pouvez aussi tout suivre à la main, sans connecter de banque.',
];

export function BankConnectPanel({
  previouslyDisconnected,
  onConnect,
  pending,
}: {
  previouslyDisconnected: boolean;
  onConnect: () => void;
  pending: boolean;
}) {
  const { colors } = useBrand();
  const isWide = useLayoutMode() === 'wide';
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    <Panel>
      <View style={styles.header}>
        <View style={[styles.bankIcon, { backgroundColor: colors.actionTint }]}>
          <Icon source="bank-plus" size={22} color={colors.action} />
        </View>
        <Text variant="titleMedium" accessibilityRole="header" style={styles.title}>
          Aucune banque connectée
        </Text>
      </View>
      {previouslyDisconnected ? <Muted>{BANK_STATUS_HELP.disconnected}</Muted> : null}
      <Text variant="bodyMedium">Lecture seule, débits uniquement : vos identifiants restent chez Powens.</Text>

      <AppButton
        variant="ghost"
        icon={detailsOpen ? 'chevron-up' : 'chevron-down'}
        iconPosition="end"
        onPress={() => setDetailsOpen((open) => !open)}
        accessibilityState={{ expanded: detailsOpen }}
        style={styles.detailsToggle}
      >
        En savoir plus
      </AppButton>
      {detailsOpen ? (
        <View style={styles.details}>
          {CONNECTION_DETAILS.map((detail) => (
            <Text key={detail} variant="bodyMedium" style={{ color: colors.inkMuted }}>
              {detail}
            </Text>
          ))}
        </View>
      ) : null}

      <AppButton icon="bank-plus" onPress={onConnect} loading={pending} style={isWide ? styles.wideButton : null}>
        Connecter ma banque
      </AppButton>
    </Panel>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bankIcon: { width: 44, height: 44, borderRadius: radii.control, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1 },
  detailsToggle: { alignSelf: 'flex-start', marginLeft: -16, marginVertical: -8 },
  details: { gap: 8 },
  wideButton: { alignSelf: 'flex-start' },
});
