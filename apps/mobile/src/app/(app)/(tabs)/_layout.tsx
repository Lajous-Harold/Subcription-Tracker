import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { BottomTabBar, Tabs, type BottomTabBarProps, type BottomTabHeaderProps } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountAvatarButton } from '@/components/AccountAvatar';
import { TabHeader } from '@/components/navigation/TabHeader';
import { usePendingReviewCount } from '@/components/navigation/usePendingReviewCount';
import { Wordmark } from '@/components/Wordmark';
import { useLayoutMode } from '@/lib/layout';
import { useBrand } from '@/lib/theme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Les 49 px par défaut rognent le libellé sous l'icône sur le web : la hauteur fixée exclut la zone de sécurité. */
const TAB_BAR_HEIGHT = 60;

function tabIcon(name: IconName) {
  function TabIcon({ color, size }: { color: unknown; size: number }) {
    return <MaterialCommunityIcons name={name} color={color as string} size={size} />;
  }
  return TabIcon;
}

const renderBottomTabBar = (props: BottomTabBarProps) => <BottomTabBar {...props} />;
/** En mode large, la barre latérale est rendue par la pile parente : les onglets n'ont plus de barre. */
const renderNoTabBar = () => null;
const renderTabHeader = (props: BottomTabHeaderProps) => <TabHeader {...props} />;
const renderWordmark = () => <Wordmark />;
const renderAccountAvatar = () => <AccountAvatarButton />;

/**
 * Le compte sort de la barre du bas par `tabBarItemStyle`, pas par `href: null` : expo-router
 * redirigerait alors tout accès à la route vers le premier onglet, et l'avatar ne mènerait nulle part.
 * Le badge `tabBarBadge` ne sert qu'à la barre du bas ; la barre latérale lit le même compteur.
 */
export default function TabsLayout() {
  const brand = useBrand();
  const isWide = useLayoutMode() === 'wide';
  const pendingReviewCount = usePendingReviewCount();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      tabBar={isWide ? renderNoTabBar : renderBottomTabBar}
      screenOptions={({ route }) => ({
        header: renderTabHeader,
        headerRight: isWide || route.name === 'account' ? undefined : renderAccountAvatar,
        tabBarLabelPosition: 'below-icon',
        tabBarActiveTintColor: brand.colors.action,
        tabBarInactiveTintColor: brand.colors.inkMuted,
        tabBarLabelStyle: { fontFamily: brand.fonts.semiBold, fontSize: 12, lineHeight: 16 },
        tabBarStyle: {
          height: TAB_BAR_HEIGHT + insets.bottom,
          backgroundColor: brand.colors.surface,
          borderTopColor: brand.colors.border,
        },
        tabBarBadgeStyle: {
          backgroundColor: brand.colors.signal,
          color: brand.colors.onSignal,
          fontFamily: brand.fonts.bold,
        },
        sceneStyle: { backgroundColor: brand.colors.background },
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isWide ? 'Tableau de bord' : 'Accueil',
          headerTitle: isWide ? undefined : renderWordmark,
          tabBarIcon: tabIcon('home-outline'),
        }}
      />
      <Tabs.Screen name="subscriptions" options={{ title: 'Abonnements', tabBarIcon: tabIcon('repeat') }} />
      <Tabs.Screen
        name="review"
        options={{
          title: 'À vérifier',
          tabBarIcon: tabIcon('magnify'),
          tabBarBadge: pendingReviewCount > 0 ? pendingReviewCount : undefined,
        }}
      />
      <Tabs.Screen name="bank" options={{ title: 'Banque', tabBarIcon: tabIcon('bank-outline') }} />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Compte',
          tabBarIcon: tabIcon('account-circle-outline'),
          tabBarItemStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}
