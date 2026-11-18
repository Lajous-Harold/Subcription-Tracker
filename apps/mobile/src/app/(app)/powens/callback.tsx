import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Icon, Text } from 'react-native-paper';
import { Muted, Panel, Screen } from '@/components/ui';
import { errorMessage } from '@/lib/http';
import { completeConnectCallback, type CallbackParams } from '@/lib/powens-connect';
import { invalidateBankData } from '@/lib/query';
import { radii, useBrand } from '@/lib/theme';

type CallbackState = { kind: 'pending' } | { kind: 'completed' } | { kind: 'failed'; message: string };

/**
 * Retour de la Webview Powens : `?connection_id=…&state=…` ou `?error=…&error_description=…`.
 * Web : redirection pleine page. Natif : lien profond subtracker://powens/callback.
 */
export default function PowensCallbackScreen() {
  const params = useLocalSearchParams<Record<keyof CallbackParams, string>>();
  const [state, setState] = useState<CallbackState>({ kind: 'pending' });
  const callbackHandled = useRef(false);

  useEffect(() => {
    if (callbackHandled.current) return;
    callbackHandled.current = true;
    completeConnectCallback(params)
      .then(() => {
        setState({ kind: 'completed' });
        invalidateBankData();
        router.replace('/bank');
      })
      .catch((caught) => setState({ kind: 'failed', message: errorMessage(caught) }));
  }, [params]);

  if (state.kind === 'failed') return <CallbackFailed message={state.message} />;
  return <CallbackProgress completed={state.kind === 'completed'} />;
}

function CallbackProgress({ completed }: { completed: boolean }) {
  const { colors } = useBrand();
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]} accessibilityLiveRegion="polite">
      {completed ? (
        <Icon source="check-circle-outline" size={40} color={colors.action} />
      ) : (
        <ActivityIndicator size="large" />
      )}
      <Text variant="titleMedium" style={styles.centerText}>
        {completed ? 'Banque connectée' : 'Finalisation de la connexion bancaire…'}
      </Text>
      <Muted style={styles.centerText}>
        {completed ? 'Retour à l’écran Banque.' : 'Quelques secondes, le temps de confirmer l’accès auprès de Powens.'}
      </Muted>
    </View>
  );
}

function CallbackFailed({ message }: { message: string }) {
  const { colors } = useBrand();
  return (
    <Screen>
      <Panel tone="signal">
        <View style={[styles.statusIcon, { backgroundColor: colors.surface }]}>
          <Icon source="alert-circle-outline" size={24} color={colors.signalText} />
        </View>
        <Text variant="titleLarge" accessibilityRole="header">
          Connexion bancaire non finalisée
        </Text>
        <Text variant="bodyMedium">{message}</Text>
        <Button
          mode="contained"
          icon="arrow-left"
          onPress={() => router.replace('/bank')}
          contentStyle={styles.mainAction}
        >
          Revenir à la banque
        </Button>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  centerText: { textAlign: 'center', maxWidth: 420 },
  statusIcon: { width: 48, height: 48, borderRadius: radii.control, alignItems: 'center', justifyContent: 'center' },
  mainAction: { minHeight: 48 },
});
