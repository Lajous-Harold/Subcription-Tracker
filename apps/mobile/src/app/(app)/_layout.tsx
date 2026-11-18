import { Stack, type NativeStackHeaderProps } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Sidebar } from '@/components/navigation/Sidebar';
import { StackHeader } from '@/components/navigation/StackHeader';
import { useLayoutMode } from '@/lib/layout';
import { useBrand } from '@/lib/theme';

const renderStackHeader = (props: NativeStackHeaderProps) => <StackHeader {...props} />;

/**
 * Les écrans de pile posent leur titre et leurs actions par `<Stack.Screen options={{ title, headerRight }} />` ;
 * `headerTitle: ''` masque le titre quand l'écran affiche le sien dans son contenu.
 *
 * En mode large, la barre latérale entoure la pile pour rester visible sur les écrans de détail.
 * L'arbre garde la même forme dans les deux modes : franchir le seuil ne remonte pas la pile.
 */
export default function AppLayout() {
  const brand = useBrand();
  const isWide = useLayoutMode() === 'wide';
  return (
    <View style={styles.row}>
      {isWide ? <Sidebar /> : null}
      <View style={styles.content}>
        <Stack
          screenOptions={{
            header: renderStackHeader,
            contentStyle: { backgroundColor: brand.colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="subscriptions/new" options={{ title: 'Nouvel abonnement', presentation: 'modal' }} />
          <Stack.Screen name="subscriptions/[id]/index" options={{ title: 'Abonnement' }} />
          <Stack.Screen name="subscriptions/[id]/edit" options={{ title: 'Modifier', presentation: 'modal' }} />
          <Stack.Screen name="subscriptions/[id]/cancel" options={{ title: 'Résiliation' }} />
          <Stack.Screen name="subscriptions/[id]/link-payment" options={{ title: 'Rattacher une opération' }} />
          <Stack.Screen name="candidates/[id]" options={{ title: 'Vérifier la détection' }} />
          <Stack.Screen name="powens/callback" options={{ title: 'Connexion bancaire' }} />
        </Stack>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  content: { flex: 1 },
});
