import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { AppButton } from '@/components/AppButton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/toast';
import { controlStyles, Muted, Panel, Screen } from '@/components/ui';
import { AccountAvatar } from '@/components/AccountAvatar';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { applyAuthResponse } from '@/lib/http';
import { useLayoutMode } from '@/lib/layout';
import { radii, useBrand } from '@/lib/theme';

const GOOD_TO_KNOW = [
  'La détection repère des paiements mensuels récurrents ; elle n’est pas exhaustive.',
  'Une opération bancaire ne prouve pas qu’un abonnement est actif, et une absence de prélèvement ne prouve pas une résiliation.',
  'Retirer un abonnement de l’application ne résilie pas votre contrat.',
  'Aucune résiliation n’est faite à votre place : l’application vous guide et vous aide à suivre la démarche.',
  'Les données bancaires sont obtenues via Powens avec votre consentement, en lecture seule.',
];

/** Une adresse n'a pas d'espace : on autorise la coupure avant « @ » pour qu'elle passe à la ligne en entier. */
const breakableEmail = (email: string) => email.replace('@', '​@');

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const { colors } = useBrand();
  const toast = useToast();
  const isWide = useLayoutMode() === 'wide';
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [password, setPassword] = useState('');

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setPassword('');
  };
  const deleteAccount = useMutation({
    mutationFn: () => api.deleteAccount(password),
    onSuccess: async () => {
      closeDeleteDialog();
      await applyAuthResponse(null);
    },
    onError: toast.showError,
  });
  const buttonStyle = isWide ? styles.wideButton : null;

  const profile = (
    <Panel>
      <View style={styles.profile}>
        <AccountAvatar email={user?.email} size={56} />
        <View style={styles.profileText}>
          <Muted>Connecté avec</Muted>
          <Text variant="titleMedium" accessibilityLabel={user?.email}>
            {user ? breakableEmail(user.email) : '—'}
          </Text>
        </View>
      </View>
      <AppButton variant="secondary" icon="logout" onPress={() => void signOut()} style={buttonStyle}>
        Se déconnecter
      </AppButton>
    </Panel>
  );

  const goodToKnow = (
    <Panel>
      <Text variant="titleLarge" accessibilityRole="header">
        Bon à savoir
      </Text>
      {GOOD_TO_KNOW.map((fact) => (
        <View key={fact} style={styles.fact}>
          <View style={[styles.bullet, { backgroundColor: colors.inkMuted }]} />
          <Text variant="bodyMedium" style={[styles.factText, { color: colors.inkMuted }]}>
            {fact}
          </Text>
        </View>
      ))}
    </Panel>
  );

  const accountDeletion = (
    <Panel>
      <Text variant="titleLarge" accessibilityRole="header">
        Supprimer le compte
      </Text>
      <Text variant="bodyMedium" style={{ color: colors.inkMuted }}>
        Efface vos abonnements, paiements et opérations importées, et supprime votre connexion chez Powens. Cette action
        est définitive.
      </Text>
      <AppButton
        variant="destructive"
        icon="delete-forever"
        onPress={() => setDeleteDialogOpen(true)}
        style={buttonStyle}
      >
        Supprimer mon compte
      </AppButton>
    </Panel>
  );

  return (
    <Screen>
      {isWide ? (
        <View style={styles.wideColumns}>
          <View style={styles.wideColumn}>
            {profile}
            {accountDeletion}
          </View>
          <View style={styles.wideColumn}>{goodToKnow}</View>
        </View>
      ) : (
        <>
          {profile}
          {goodToKnow}
          {accountDeletion}
        </>
      )}

      <ConfirmDialog
        visible={deleteDialogOpen}
        title="Supprimer définitivement le compte ?"
        message="Toutes vos données seront effacées. Vos contrats chez les fournisseurs ne seront pas résiliés."
        confirmLabel="Supprimer mon compte"
        destructive
        loading={deleteAccount.isPending}
        onConfirm={() => deleteAccount.mutate()}
        onDismiss={closeDeleteDialog}
      >
        <TextInput
          label="Mot de passe"
          mode="outlined"
          outlineStyle={controlStyles.fieldOutline}
          secureTextEntry
          autoComplete="current-password"
          value={password}
          onChangeText={setPassword}
        />
      </ConfirmDialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileText: { flex: 1, minWidth: 0 },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: { width: 5, height: 5, borderRadius: radii.pill, marginTop: 9 },
  factText: { flex: 1 },
  wideButton: { alignSelf: 'flex-start' },
  wideColumns: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  wideColumn: { flex: 1, minWidth: 0, gap: 16 },
});
