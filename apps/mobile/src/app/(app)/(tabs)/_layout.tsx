import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router/js-tabs';
import { useTheme } from 'react-native-paper';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function tabIcon(name: IconName) {
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
        options={{ title: 'Tableau de bord', tabBarLabel: 'Accueil', tabBarIcon: tabIcon('view-dashboard-outline') }}
      />
      <Tabs.Screen name="subscriptions" options={{ title: 'Abonnements', tabBarIcon: tabIcon('repeat') }} />
      <Tabs.Screen name="bank" options={{ title: 'Banque', tabBarIcon: tabIcon('bank-outline') }} />
      <Tabs.Screen name="account" options={{ title: 'Compte', tabBarIcon: tabIcon('account-circle-outline') }} />
    </Tabs>
  );
}
