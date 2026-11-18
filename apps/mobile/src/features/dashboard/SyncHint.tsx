import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import type { BankLink } from '@subtracker/contracts';
import { formatTimeAgo } from '@/lib/format';
import { useBrand } from '@/lib/theme';

/** Le navigateur n'a pas de geste « tirer pour rafraîchir » : la ligne y devient le bouton. */
const CAN_PULL_TO_REFRESH = Platform.OS !== 'web';

export function describeLastBankRead(bank: Pick<BankLink, 'lastSyncAt'>): string {
  return bank.lastSyncAt ? `lue ${formatTimeAgo(bank.lastSyncAt)}` : 'pas encore lue';
}

/** Ligne discrète sous l'en-tête ; elle reste touchable, comme équivalent du geste. */
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
        size={16}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start', marginBottom: -8 },
  pressed: { opacity: 0.6 },
});
