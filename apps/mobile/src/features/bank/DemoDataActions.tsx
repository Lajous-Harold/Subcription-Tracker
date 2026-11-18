import { useMutation } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { useToast } from '@/components/toast';
import { Muted } from '@/components/ui';
import { api } from '@/lib/api';
import { invalidateBankData } from '@/lib/query';

export function DemoDataActions() {
  const toast = useToast();
  const loadDemo = useMutation({
    mutationFn: api.loadDemoData,
    onSuccess: (result) => {
      invalidateBankData();
      toast.show(
        `${result.imported} opérations fictives importées, ${result.detection.pending} détection(s) à vérifier`,
      );
    },
    onError: toast.showError,
  });
  const removeDemo = useMutation({
    mutationFn: api.removeDemoData,
    onSuccess: () => {
      invalidateBankData();
      toast.show('Données de démonstration retirées');
    },
    onError: toast.showError,
  });

  return (
    <View style={styles.container}>
      <Muted>
        Des opérations fictives (Spotify, Netflix, salle de sport…) permettent d’essayer la détection sans banque.
      </Muted>
      <AppButton
        variant="secondary"
        icon="database-import-outline"
        onPress={() => loadDemo.mutate()}
        loading={loadDemo.isPending}
      >
        Charger les données de démonstration
      </AppButton>
      <AppButton variant="ghost" onPress={() => removeDemo.mutate()} loading={removeDemo.isPending}>
        Retirer les données de démonstration
      </AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
});
