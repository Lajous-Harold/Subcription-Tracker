import { Link, usePathname, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Wordmark } from '@/components/Wordmark';
import { bankLinkSummary } from '@/features/bank/bank-display';
import { useBankLink } from '@/features/bank/useBankLink';
import { tabularNums, useBrand } from '@/lib/theme';
import { useMinuteClock } from '@/lib/useMinuteClock';
import { usePendingReviewCount } from './usePendingReviewCount';

interface SidebarEntry {
  href: Href;
  label: string;
  /** Chemins de la section, écrans de pile compris : la fiche d'un abonnement reste sous Abonnements. */
  sectionPaths: string[];
  showsPendingReviewCount?: boolean;
}

const SIDEBAR_ENTRIES: SidebarEntry[] = [
  { href: '/', label: 'Tableau de bord', sectionPaths: ['/'] },
  { href: '/subscriptions', label: 'Abonnements', sectionPaths: ['/subscriptions'] },
  { href: '/review', label: 'À vérifier', sectionPaths: ['/review', '/candidates'], showsPendingReviewCount: true },
  { href: '/bank', label: 'Banque', sectionPaths: ['/bank', '/powens'] },
  { href: '/account', label: 'Compte', sectionPaths: ['/account'] },
];

function isInSection(pathname: string, entry: SidebarEntry): boolean {
  return entry.sectionPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** Navigation du mode large, rendue autour de la pile pour rester visible sur les écrans de détail. */
export function Sidebar() {
  const brand = useBrand();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const pendingReviewCount = usePendingReviewCount();

  return (
    <View
      style={[
        styles.sidebar,
        {
          backgroundColor: brand.colors.surface,
          borderRightColor: brand.colors.border,
          paddingTop: insets.top + SIDEBAR_VERTICAL_PADDING - HOME_LINK_EXTRA_HEIGHT / 2,
          paddingBottom: insets.bottom + SIDEBAR_VERTICAL_PADDING,
          paddingLeft: insets.left + 16,
        },
      ]}
    >
      <HomeLink />
      <View role="navigation" accessibilityLabel="Navigation principale" style={styles.items}>
        {SIDEBAR_ENTRIES.map((entry) => (
          <SidebarItem
            key={entry.label}
            entry={entry}
            active={isInSection(pathname, entry)}
            badge={entry.showsPendingReviewCount && pendingReviewCount > 0 ? pendingReviewCount : undefined}
          />
        ))}
      </View>
      <BankSummary />
    </View>
  );
}

/** Le logo mène au tableau de bord, comme sur la plupart des applications web. */
function HomeLink() {
  const brand = useBrand();
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const idleBackground = hovered ? brand.colors.background : 'transparent';
  return (
    <Link
      href="/"
      asChild
      style={[
        styles.homeLink,
        { borderRadius: brand.radii.control, backgroundColor: pressed ? brand.colors.tile : idleBackground },
      ]}
    >
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="abo, tableau de bord"
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
      >
        <Wordmark size={26} decorative />
      </Pressable>
    </Link>
  );
}

const lowerFirst = (text: string) => text.charAt(0).toLocaleLowerCase('fr-FR') + text.slice(1);

/**
 * L'encart entier est un seul lien vers l'écran Banque, sans lien imbriqué, nommé d'après l'état qu'il affiche.
 * Partage la requête de l'écran Banque : rien n'est rechargé si le lien bancaire est déjà en cache.
 */
function BankSummary() {
  const brand = useBrand();
  const { bankLinkQuery, linkedBank } = useBankLink();
  const now = useMinuteClock();
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  if (!bankLinkQuery.isSuccess) return null;

  const summary = linkedBank ? bankLinkSummary(linkedBank, now) : null;
  const accessibleName = summary
    ? `${summary.title}, ${lowerFirst(summary.detail)}, ouvrir la banque`
    : 'Aucune banque connectée, connecter ma banque';
  const titleStyle = [styles.bankText, { fontFamily: brand.fonts.semiBold }];
  return (
    <Link
      href="/bank"
      asChild
      style={[
        styles.bank,
        {
          borderRadius: brand.radii.control,
          backgroundColor: hovered || pressed ? brand.colors.tile : brand.colors.background,
        },
      ]}
    >
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={accessibleName}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
      >
        {summary ? (
          <>
            <Text style={[titleStyle, { color: summary.needsAttention ? brand.colors.signalText : brand.colors.ink }]}>
              {summary.title}
            </Text>
            <Text
              style={[
                styles.bankText,
                styles.bankDetail,
                { fontFamily: brand.fonts.regular, color: brand.colors.inkMuted },
              ]}
            >
              {summary.detail}
            </Text>
          </>
        ) : (
          <>
            <Text style={[titleStyle, { color: brand.colors.ink }]}>Aucune banque connectée</Text>
            <Text
              style={[
                titleStyle,
                styles.bankDetail,
                { color: brand.colors.action, textDecorationLine: hovered ? 'underline' : 'none' },
              ]}
            >
              Connecter ma banque
            </Text>
          </>
        )}
      </Pressable>
    </Link>
  );
}

/**
 * Le style est porté par `Link`, pas par le `Pressable` : en `asChild`, le `Slot` d'expo-router n'aplatit que
 * son propre style, et perd sur le web un style en fonction ou en tableau posé sur l'enfant.
 */
function SidebarItem({ entry, active, badge }: { entry: SidebarEntry; active: boolean; badge: number | undefined }) {
  const brand = useBrand();
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const idleBackground = hovered ? brand.colors.background : 'transparent';

  return (
    <Link
      href={entry.href}
      asChild
      style={[
        styles.item,
        {
          borderRadius: brand.radii.control,
          backgroundColor: active || pressed ? brand.colors.tile : idleBackground,
        },
      ]}
    >
      <Pressable
        aria-current={active ? 'page' : undefined}
        accessibilityLabel={badge === undefined ? entry.label : `${entry.label}, ${badge} en attente`}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.itemLabel,
            {
              fontFamily: active ? brand.fonts.semiBold : brand.fonts.regular,
              color: active ? brand.colors.ink : brand.colors.inkMuted,
            },
          ]}
        >
          {entry.label}
        </Text>
        {badge === undefined ? null : (
          <View style={[styles.badge, { backgroundColor: brand.colors.signal, borderRadius: brand.radii.pill }]}>
            <Text
              style={[styles.badgeText, tabularNums, { fontFamily: brand.fonts.bold, color: brand.colors.onSignal }]}
            >
              {badge}
            </Text>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

const SIDEBAR_WIDTH = 220;
const SIDEBAR_VERTICAL_PADDING = 28;
const HOME_LINK_HEIGHT = 44;
/** Hauteur rendue par `Wordmark` en taille 26 : le lien grandit pour la cible tactile sans décaler le logo. */
const WORDMARK_HEIGHT = 30;
const HOME_LINK_EXTRA_HEIGHT = HOME_LINK_HEIGHT - WORDMARK_HEIGHT;

const styles = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_WIDTH,
    borderRightWidth: 1,
    paddingRight: 16,
    gap: SIDEBAR_VERTICAL_PADDING - HOME_LINK_EXTRA_HEIGHT / 2,
  },
  homeLink: {
    minHeight: HOME_LINK_HEIGHT,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  items: { gap: 4 },
  item: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  itemLabel: { flexShrink: 1, fontSize: 15 },
  badge: { minWidth: 24, height: 22, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 12 },
  bank: { marginTop: 'auto', padding: 14 },
  bankText: { fontSize: 13, lineHeight: 20 },
  bankDetail: { marginTop: 4 },
});
