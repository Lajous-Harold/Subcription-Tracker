import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Icon, Text } from 'react-native-paper';
import { AppButton } from '@/components/AppButton';
import { Panel } from '@/components/ui';
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

  return <CallbackStatus state={state} />;
}

function CallbackStatus({ state }: { state: CallbackState }) {
  const { colors } = useBrand();
  const failed = state.kind === 'failed';

  let badge: ReactNode;
  let title: string;
  let message: string;
  if (state.kind === 'pending') {
    badge = <ActivityIndicator color={colors.action} />;
    title = 'Finalisation de la connexion bancaire…';
    message = 'Quelques secondes, le temps de confirmer l’accès auprès de Powens.';
  } else if (state.kind === 'completed') {
    badge = <Icon source="check" size={24} color={colors.action} />;
    title = 'Banque connectée';
    message = 'Retour à l’écran Banque…';
  } else {
    badge = <Icon source="alert-circle-outline" size={24} color={colors.signalText} />;
    title = 'Connexion bancaire non finalisée';
    message = state.message;
  }

  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <Panel tone={failed ? 'signal' : 'surface'} style={styles.panel}>
        <View accessibilityLiveRegion="polite" style={styles.content}>
          <View style={[styles.badge, { backgroundColor: failed ? colors.surface : colors.actionTint }]}>{badge}</View>
          <Text variant="titleLarge" accessibilityRole="header" style={styles.centerText}>
            {title}
          </Text>
          <Text variant="bodyMedium" style={[styles.centerText, { color: failed ? colors.ink : colors.inkMuted }]}>
            {message}
          </Text>
        </View>
        {failed ? (
          <AppButton icon="arrow-left" onPress={() => router.replace('/bank')}>
            Revenir à la banque
          </AppButton>
        ) : null}
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: { width: '100%', maxWidth: 440, padding: 24, gap: 16 },
  content: { alignItems: 'center', gap: 8 },
  centerText: { textAlign: 'center' },
  badge: { width: 48, height: 48, borderRadius: radii.control, alignItems: 'center', justifyContent: 'center' },
});
