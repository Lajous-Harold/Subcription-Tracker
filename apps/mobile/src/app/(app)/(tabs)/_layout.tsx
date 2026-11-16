import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router/js-tabs';
import { useTheme } from 'react-native-paper';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function icon(name: IconName) {
  function TabIcon({ color, size }: { color: unknown; size: number }) {
    return <MaterialCommunityIcons name={name} color={color as string} size={size} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: theme.colors.primary }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Tableau de bord', tabBarLabel: 'Accueil', tabBarIcon: icon('view-dashboard-outline') }}
      />
      <Tabs.Screen name="subscriptions" options={{ title: 'Abonnements', tabBarIcon: icon('repeat') }} />
      <Tabs.Screen name="bank" options={{ title: 'Banque', tabBarIcon: icon('bank-outline') }} />
      <Tabs.Screen name="account" options={{ title: 'Compte', tabBarIcon: icon('account-circle-outline') }} />
    </Tabs>
  );
}
