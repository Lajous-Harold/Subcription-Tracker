import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Retour' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="subscriptions/new" options={{ title: 'Nouvel abonnement', presentation: 'modal' }} />
      <Stack.Screen name="subscriptions/[id]/index" options={{ title: 'Abonnement' }} />
      <Stack.Screen name="subscriptions/[id]/edit" options={{ title: 'Modifier', presentation: 'modal' }} />
      <Stack.Screen name="subscriptions/[id]/cancel" options={{ title: 'Résiliation' }} />
      <Stack.Screen name="subscriptions/[id]/link-payment" options={{ title: 'Rattacher une opération' }} />
      <Stack.Screen name="candidates/index" options={{ title: 'Abonnements détectés' }} />
      <Stack.Screen name="candidates/[id]" options={{ title: 'Vérifier la détection' }} />
      <Stack.Screen name="powens/callback" options={{ title: 'Connexion bancaire' }} />
    </Stack>
  );
}
