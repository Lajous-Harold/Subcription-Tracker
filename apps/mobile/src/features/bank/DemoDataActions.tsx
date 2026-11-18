import { useMutation } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';
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
      <Button
        mode="outlined"
        icon="database-import-outline"
        onPress={() => loadDemo.mutate()}
        loading={loadDemo.isPending}
        disabled={loadDemo.isPending}
        contentStyle={styles.target}
      >
        Charger les données de démonstration
      </Button>
      <Button
        mode="text"
        onPress={() => removeDemo.mutate()}
        loading={removeDemo.isPending}
        disabled={removeDemo.isPending}
        contentStyle={styles.target}
      >
        Retirer les données de démonstration
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  target: { minHeight: 44 },
});
