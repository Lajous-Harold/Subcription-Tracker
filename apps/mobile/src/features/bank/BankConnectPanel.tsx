import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';
import { Muted, Panel } from '@/components/ui';
import { BANK_STATUS_HELP } from '@/lib/format';
import { radii, useBrand } from '@/lib/theme';

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
  return (
    <Panel>
      <View style={[styles.bankIcon, { backgroundColor: colors.actionTint }]}>
        <Icon source="bank-plus" size={24} color={colors.action} />
      </View>
      <View style={styles.text}>
        <Text variant="titleLarge" accessibilityRole="header">
          Aucune banque connectée
        </Text>
        {previouslyDisconnected ? <Text variant="bodyMedium">{BANK_STATUS_HELP.disconnected}</Text> : null}
        <Text variant="bodyMedium">
          Connectez votre banque pour détecter vos abonnements automatiquement. La connexion passe par Powens,
          prestataire agréé : vous vous authentifiez sur son parcours officiel et vous choisissez les comptes à
          partager. Vos identifiants bancaires ne transitent jamais par cette application.
        </Text>
        <Muted>
          Seuls les débits sont importés, et seulement en lecture : aucun paiement ni virement n’est possible. Vous
          pouvez aussi tout suivre à la main sans connecter de banque.
        </Muted>
      </View>
      <Button
        mode="contained"
        icon="bank-plus"
        onPress={onConnect}
        loading={pending}
        disabled={pending}
        contentStyle={styles.mainAction}
      >
        Connecter ma banque
      </Button>
    </Panel>
  );
}

const styles = StyleSheet.create({
  bankIcon: { width: 48, height: 48, borderRadius: radii.control, alignItems: 'center', justifyContent: 'center' },
  text: { gap: 8 },
  mainAction: { minHeight: 48 },
});
