import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import type { BankAccount } from '@subtracker/contracts';
import { AppButton } from '@/components/AppButton';
import { Muted, Panel } from '@/components/ui';
import { errorMessage } from '@/lib/http';
import { tabularNums, useBrand } from '@/lib/theme';
import { accountDescription } from './bank-display';

export type AccountToggle = { id: string; analyzed: boolean };

/** Toute la ligne est la case à cocher : la cible dépasse ainsi largement 44 px. */
function AccountRow({
  account,
  checked,
  pending,
  onToggle,
}: {
  account: BankAccount;
  checked: boolean;
  pending: boolean;
  onToggle: (toggle: AccountToggle) => void;
}) {
  const { colors } = useBrand();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: pending }}
      accessibilityLabel={`Analyser le compte ${account.name}`}
      onPress={() => onToggle({ id: account.id, analyzed: !checked })}
      disabled={pending}
      style={({ pressed }) => [
        styles.row,
        { borderTopColor: colors.border },
        pressed ? { backgroundColor: colors.tile } : null,
      ]}
    >
      <View style={styles.rowText}>
        <Text variant="titleSmall">{account.name}</Text>
        <Muted style={tabularNums}>{accountDescription({ ...account, analyzed: checked })}</Muted>
      </View>
      <Icon
        source={checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
        size={26}
        color={checked ? colors.action : colors.inkMuted}
      />
    </Pressable>
  );
}

export function AnalyzedAccountsPanel({
  accounts,
  loading,
  error,
  pendingToggle,
  onToggle,
  onManageSharing,
  manageDisabled,
}: {
  accounts: BankAccount[];
  loading: boolean;
  error: unknown;
  pendingToggle: AccountToggle | undefined;
  onToggle: (toggle: AccountToggle) => void;
  /** Absent sans banque connectée : le partage des comptes se règle dans le parcours Powens. */
  onManageSharing?: () => void;
  manageDisabled: boolean;
}) {
  return (
    <Panel style={styles.panel}>
      <View style={styles.intro}>
        <Text variant="titleLarge" accessibilityRole="header">
          Comptes analysés
        </Text>
        <Muted>Seuls les débits des comptes cochés sont lus.</Muted>
      </View>

      {error ? <Muted>{errorMessage(error)}</Muted> : null}
      {!error && accounts.length === 0 ? (
        <Muted>
          {loading ? 'Chargement des comptes…' : 'Les comptes apparaîtront après la première synchronisation.'}
        </Muted>
      ) : null}

      <View>
        {accounts.map((account) => {
          const pending = pendingToggle?.id === account.id;
          return (
            <AccountRow
              key={account.id}
              account={account}
              checked={pending ? pendingToggle.analyzed : account.analyzed}
              pending={pending}
              onToggle={onToggle}
            />
          );
        })}
      </View>

      {onManageSharing ? (
        <View style={styles.footer}>
          <Muted>
            Cocher un compte est un choix local. Les comptes partagés avec l’application se règlent chez Powens.
          </Muted>
          <AppButton
            variant="ghost"
            icon="account-cog-outline"
            onPress={onManageSharing}
            disabled={manageDisabled}
            style={styles.manageButton}
          >
            Gérer les comptes partagés
          </AppButton>
        </View>
      ) : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { paddingBottom: 12 },
  intro: { gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderTopWidth: 1,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  footer: { gap: 4 },
  manageButton: { alignSelf: 'flex-start', marginLeft: -16 },
});
