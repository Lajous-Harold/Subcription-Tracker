import { useMutation } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { useToast } from '@/components/toast';
import { Muted } from '@/components/ui';
import { api } from '@/lib/api';
import { invalidateBankData } from '@/lib/query';

/**
 * Sans données de démonstration, on propose de les charger ; une fois chargées, de les recharger
 * (le chargement est idempotent et restaure les détections ignorées) ou de les retirer.
 */
export function DemoDataActions({ demoDataLoaded, wide }: { demoDataLoaded: boolean; wide: boolean }) {
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
  const busy = loadDemo.isPending || removeDemo.isPending;

  if (!demoDataLoaded) {
    return (
      <View style={styles.container}>
        <Muted>
          Des opérations fictives (Spotify, Netflix, salle de sport…) pour essayer la détection sans banque.
        </Muted>
        <AppButton
          variant="secondary"
          icon="database-import-outline"
          onPress={() => loadDemo.mutate()}
          loading={loadDemo.isPending}
          style={wide ? styles.wideButton : null}
        >
          Charger les données de démo
        </AppButton>
      </View>
    );
  }

  return (
    <View style={[styles.container, wide ? styles.wideRow : null]}>
      <AppButton
        variant="secondary"
        icon="refresh"
        onPress={() => loadDemo.mutate()}
        loading={loadDemo.isPending}
        disabled={busy}
      >
        Recharger les données de démo
      </AppButton>
      <AppButton
        variant="ghost"
        icon="database-remove-outline"
        onPress={() => removeDemo.mutate()}
        loading={removeDemo.isPending}
        disabled={busy}
      >
        Retirer les données de démo
      </AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  wideRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  wideButton: { alignSelf: 'flex-start' },
});
