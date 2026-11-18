import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { BottomTabBar, Tabs, type BottomTabBarProps, type BottomTabHeaderProps } from 'expo-router/js-tabs';
import { StyleSheet, Text, useWindowDimensions, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountAvatarButton } from '@/components/AccountAvatar';
import { AppButton } from '@/components/AppButton';
import { TabHeader } from '@/components/navigation/TabHeader';
import { usePendingReviewCount } from '@/components/navigation/usePendingReviewCount';
import { Wordmark } from '@/components/Wordmark';
import { DashboardHeader, DashboardHeaderActions } from '@/features/dashboard/DashboardHeader';
import { ADD_SUBSCRIPTION_LABEL, openNewSubscription } from '@/features/subscriptions-list/add-subscription';
import { useLayoutMode } from '@/lib/layout';
import { fontFamilies, useBrand } from '@/lib/theme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Les 49 px par défaut rognent le libellé sous l'icône sur le web : la hauteur fixée exclut la zone de sécurité. */
const TAB_BAR_HEIGHT = 60;

function tabIcon(name: IconName) {
  function TabIcon({ color, size }: { color: unknown; size: number }) {
    return <MaterialCommunityIcons name={name} color={color as string} size={size} />;
  }
  return TabIcon;
}

/**
 * « Abonnements » en semi-gras mesure 81 px à 12 px : en dessous de 360 px de large, quatre onglets n'offrent
 * plus que 80 px chacun, le libellé passe donc à 11 px (75 px). Pas de `numberOfLines` : il tronquerait le libellé
 * à la largeur intérieure du bouton d'onglet, alors qu'il peut déborder dans les 5 px de marge que React Navigation
 * y impose.
 */
const FULL_TAB_LABEL_MIN_WIDTH = 360;

/** Seul l'onglet actif passe en semi-gras : la graisse double la couleur pour distinguer l'état. */
function TabLabel({ focused, color, children }: { focused: boolean; color: ColorValue; children: string }) {
  const { width } = useWindowDimensions();
  return (
    <Text
      style={[
        styles.tabLabel,
        width < FULL_TAB_LABEL_MIN_WIDTH && styles.narrowTabLabel,
        { color, fontFamily: focused ? fontFamilies.semiBold : fontFamilies.regular },
      ]}
    >
      {children}
    </Text>
  );
}

const renderTabLabel = (props: { focused: boolean; color: ColorValue; children: string }) => <TabLabel {...props} />;

const renderBottomTabBar = (props: BottomTabBarProps) => <BottomTabBar {...props} />;
/** En mode large, la barre latérale est rendue par la pile parente : les onglets n'ont plus de barre. */
const renderNoTabBar = () => null;
const renderTabHeader = (props: BottomTabHeaderProps) => <TabHeader {...props} />;
const renderWordmark = () => <Wordmark showsMark={false} />;
const renderAccountAvatar = () => <AccountAvatarButton />;
const renderDashboardHeader = (props: BottomTabHeaderProps) => <DashboardHeader {...props} />;
const renderDashboardActions = () => <DashboardHeaderActions />;
const renderAddSubscription = () => <AppButton onPress={openNewSubscription}>{ADD_SUBSCRIPTION_LABEL}</AppButton>;

/**
 * Seule source des options d'en-tête des onglets : posées par un écran, elles persisteraient d'un mode à l'autre
 * quand la fenêtre change de largeur. En compact, l'avatar mène au compte ; en large, la barre latérale le fait.
 *
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
        tabBarLabel: renderTabLabel,
        tabBarActiveTintColor: brand.colors.action,
        tabBarInactiveTintColor: brand.colors.inkMuted,
        tabBarStyle: {
          height: TAB_BAR_HEIGHT + insets.bottom,
          backgroundColor: brand.colors.surface,
          borderTopColor: brand.colors.border,
        },
        tabBarBadgeStyle: {
          backgroundColor: brand.colors.signal,
          color: brand.colors.onSignal,
          fontFamily: brand.fonts.bold,
          fontSize: 11,
        },
        sceneStyle: { backgroundColor: brand.colors.background },
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isWide ? 'Tableau de bord' : 'Accueil',
          header: isWide ? renderDashboardHeader : renderTabHeader,
          headerTitle: isWide ? undefined : renderWordmark,
          headerRight: isWide ? renderDashboardActions : renderAccountAvatar,
          tabBarIcon: tabIcon('home-outline'),
        }}
      />
      <Tabs.Screen
        name="subscriptions"
        options={{
          title: 'Abonnements',
          headerRight: isWide ? renderAddSubscription : renderAccountAvatar,
          tabBarIcon: tabIcon('repeat'),
        }}
      />
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

const styles = StyleSheet.create({
  tabLabel: { textAlign: 'center', fontSize: 12, lineHeight: 16 },
  narrowTabLabel: { fontSize: 11 },
});
