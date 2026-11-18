import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { AppButton } from '@/components/AppButton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/toast';
import { controlStyles, Muted, Panel, Screen, SectionTitle } from '@/components/ui';
import { AccountAvatar } from '@/components/AccountAvatar';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { API_URL } from '@/lib/config';
import { applyAuthResponse } from '@/lib/http';
import { radii, useBrand } from '@/lib/theme';

const GOOD_TO_KNOW = [
  'La détection repère des paiements mensuels récurrents ; elle n’est pas exhaustive.',
  'Une opération bancaire ne prouve pas qu’un abonnement est actif, et une absence de prélèvement ne prouve pas une résiliation.',
  'Retirer un abonnement de l’application ne résilie pas votre contrat.',
  'Aucune résiliation n’est faite à votre place : l’application vous guide et vous aide à suivre la démarche.',
  'Les données bancaires sont obtenues via Powens avec votre consentement, en lecture seule.',
];

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const { colors } = useBrand();
  const toast = useToast();
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

  return (
    <Screen>
      <Panel>
        <View style={styles.profile}>
          <AccountAvatar email={user?.email} size={56} />
          <View style={styles.profileText}>
            <Muted>Votre compte</Muted>
            <Text variant="titleMedium" numberOfLines={1}>
              {user?.email ?? '—'}
            </Text>
          </View>
        </View>
        <AppButton variant="secondary" icon="logout" onPress={() => void signOut()}>
          Se déconnecter
        </AppButton>
      </Panel>

      <SectionTitle>Bon à savoir</SectionTitle>
      <Panel>
        {GOOD_TO_KNOW.map((fact) => (
          <View key={fact} style={styles.fact}>
            <View style={[styles.bullet, { backgroundColor: colors.inkMuted }]} />
            <Text variant="bodyMedium" style={[styles.factText, { color: colors.inkMuted }]}>
              {fact}
            </Text>
          </View>
        ))}
      </Panel>

      <SectionTitle>Données personnelles</SectionTitle>
      <Panel>
        <Text variant="bodyMedium">
          La suppression du compte efface vos abonnements, paiements et opérations importées, et supprime votre
          connexion chez Powens. Elle est définitive.
        </Text>
        <AppButton
          variant="destructive"
          icon="delete-forever"
          onPress={() => setDeleteDialogOpen(true)}
          style={styles.deleteButton}
        >
          Supprimer mon compte
        </AppButton>
      </Panel>
      <Muted style={styles.apiUrl}>{`API : ${API_URL}`}</Muted>

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
  deleteButton: { alignSelf: 'flex-start' },
  apiUrl: { textAlign: 'center' },
});
