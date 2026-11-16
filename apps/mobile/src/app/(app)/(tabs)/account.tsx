import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Card, List, TextInput } from 'react-native-paper';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/toast';
import { Muted, Screen, SectionTitle } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { API_URL } from '@/lib/config';
import { applyAuthResponse, errorMessage } from '@/lib/http';

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const toast = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState('');

  const remove = useMutation({
    mutationFn: () => api.deleteAccount(password),
    onSuccess: async () => {
      setDeleteOpen(false);
      await applyAuthResponse(null);
    },
    onError: (error) => toast.show(errorMessage(error)),
  });

  return (
    <Screen>
      <Card>
        <List.Item
          title={user?.email ?? '—'}
          description="Compte"
          left={(props) => <List.Icon {...props} icon="account" />}
        />
        <Card.Actions>
          <Button icon="logout" onPress={() => void signOut()}>
            Se déconnecter
          </Button>
        </Card.Actions>
      </Card>

      <SectionTitle>Bon à savoir</SectionTitle>
      <Card>
        <Card.Content style={{ gap: 6 }}>
          <Muted>• La détection repère des paiements mensuels récurrents ; elle n’est pas exhaustive.</Muted>
          <Muted>
            • Une opération bancaire ne prouve pas qu’un abonnement est actif, et une absence de prélèvement ne prouve
            pas une résiliation.
          </Muted>
          <Muted>• Retirer un abonnement de l’application ne résilie pas votre contrat.</Muted>
          <Muted>
            • Aucune résiliation n’est faite à votre place : l’application vous guide et vous aide à suivre la démarche.
          </Muted>
          <Muted>• Les données bancaires sont obtenues via Powens avec votre consentement, en lecture seule.</Muted>
        </Card.Content>
      </Card>

      <SectionTitle>Données personnelles</SectionTitle>
      <Card>
        <Card.Content>
          <Muted>
            La suppression du compte efface vos abonnements, paiements et opérations importées, et supprime votre
            connexion chez Powens. Elle est définitive.
          </Muted>
        </Card.Content>
        <Card.Actions>
          <Button icon="delete-forever" textColor="#C62828" onPress={() => setDeleteOpen(true)}>
            Supprimer mon compte
          </Button>
        </Card.Actions>
      </Card>
      <Muted style={{ textAlign: 'center' }}>{`API : ${API_URL}`}</Muted>

      <ConfirmDialog
        visible={deleteOpen}
        title="Supprimer définitivement le compte ?"
        message="Toutes vos données seront effacées. Vos contrats chez les fournisseurs ne seront pas résiliés."
        confirmLabel="Supprimer"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onDismiss={() => setDeleteOpen(false)}
      >
        <TextInput label="Mot de passe" mode="outlined" secureTextEntry value={password} onChangeText={setPassword} />
      </ConfirmDialog>
    </Screen>
  );
}
