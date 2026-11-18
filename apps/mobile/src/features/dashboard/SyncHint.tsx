import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import type { BankLink } from '@subtracker/contracts';
import { formatTimeAgo } from '@/lib/format';
import { useBrand } from '@/lib/theme';

/** Le navigateur n'a pas de geste « tirer pour rafraîchir » : la ligne y devient le bouton. */
const CAN_PULL_TO_REFRESH = Platform.OS !== 'web';

function describeLastBankRead(bank: Pick<BankLink, 'lastSyncAt'>): string {
  return bank.lastSyncAt ? `lue ${formatTimeAgo(bank.lastSyncAt)}` : 'pas encore lue';
}

/** Ligne discrète sous l'en-tête, alignée sur le logo ; elle reste touchable, comme équivalent du geste. */
export function SyncHint({ bank, syncing, onSync }: { bank: BankLink; syncing: boolean; onSync: () => void }) {
  const { colors, fonts } = useBrand();
  const lastRead = `banque ${describeLastBankRead(bank)}`;
  const showsPullGesture = CAN_PULL_TO_REFRESH && !syncing;
  const showsSyncLink = !CAN_PULL_TO_REFRESH && !syncing;
  return (
    <Pressable
      onPress={onSync}
      disabled={syncing}
      accessibilityRole="button"
      accessibilityLabel={`Synchroniser la banque, ${lastRead}`}
      accessibilityState={{ busy: syncing, disabled: syncing }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <MaterialCommunityIcons
        name={showsPullGesture ? 'arrow-down' : 'sync'}
        size={14}
        color={showsSyncLink ? colors.action : colors.inkMuted}
      />
      {syncing ? (
        <Text variant="bodySmall" style={{ color: colors.inkMuted }}>
          Synchronisation en cours…
        </Text>
      ) : (
        <Text variant="bodySmall" style={{ color: colors.inkMuted }}>
          {showsSyncLink ? (
            <Text variant="bodySmall" style={{ color: colors.action, fontFamily: fonts.semiBold }}>
              Synchroniser
            </Text>
          ) : (
            'Tirez pour synchroniser'
          )}
          {` · ${lastRead}`}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /** Remontée dans la marge haute de l'écran, comme la ligne de la maquette, sans réduire la cible de 44 px. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    alignSelf: 'flex-start',
    marginTop: -16,
    marginBottom: -18,
    paddingHorizontal: 4,
  },
  pressed: { opacity: 0.6 },
});
