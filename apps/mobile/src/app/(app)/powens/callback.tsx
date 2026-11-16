import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Button } from 'react-native-paper';
import { EmptyState, Loading, Screen } from '@/components/ui';
import { errorMessage } from '@/lib/http';
import { completeConnectCallback, type CallbackParams } from '@/lib/powens-connect';
import { invalidateDetectionData, queryClient } from '@/lib/query';

/**
 * Retour de la Webview Powens : `?connection_id=…&state=…` ou `?error=…&error_description=…`.
 * Web : redirection pleine page. Natif : lien profond subtracker://powens/callback.
 */
export default function PowensCallbackScreen() {
  const params = useLocalSearchParams<Record<keyof CallbackParams, string>>();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    completeConnectCallback(params)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ['bank'] });
        invalidateDetectionData();
        router.replace('/bank');
      })
      .catch((caught) => setError(errorMessage(caught)));
  }, [params]);

  if (!error) return <Loading />;
  return (
    <Screen>
      <EmptyState title="Connexion bancaire non finalisée" description={error}>
        <Button mode="contained" onPress={() => router.replace('/bank')}>
          Retour à la banque
        </Button>
      </EmptyState>
    </Screen>
  );
}
