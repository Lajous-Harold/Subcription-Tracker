import { useImperativeHandle, useState, type ReactNode, type Ref } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { Text } from 'react-native-paper';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { Candidate } from '@subtracker/contracts';
import { ConfidenceMeter, ServiceMonogram } from '@/components/ui';
import { radii, useBrand } from '@/lib/theme';
import {
  describeOperationsLink,
  SWIPE_ACTIVATION_DISTANCE,
  SWIPE_COMMIT_WIDTH_RATIO,
  SWIPE_VERTICAL_TOLERANCE,
  swipeDecision,
  type ReviewDecision,
} from './review-session';
import { AmountText, MergeNotice, monthlyAmount, openCandidate, Reason, REASON_GAP, StalePill } from './ReviewParts';

const REASONS_ON_CARD = 3;
const MAX_ROTATION_DEG = 12;
const EXIT_DURATION_MS = 220;
const EXIT_DISTANCE_WIDTH_RATIO = 1.5;
const FALLBACK_CARD_WIDTH = 340;

/**
 * Seule partie de la carte qui cède quand l'écran manque de hauteur : les éléments qui ne tiennent pas
 * entiers sont masqués plutôt que coupés à mi-ligne, et le lien vers les opérations reste visible.
 */
function FittedDetails({ children }: { children: { key: string; node: ReactNode }[] }) {
  const [availableHeight, setAvailableHeight] = useState(Number.POSITIVE_INFINITY);
  const [itemBottoms, setItemBottoms] = useState<Record<string, number>>({});
  const measureItem = (key: string, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    setItemBottoms((bottoms) => ({ ...bottoms, [key]: y + height }));
  };
  return (
    <View style={styles.details} onLayout={(event) => setAvailableHeight(event.nativeEvent.layout.height)}>
      {children.map(({ key, node }) => (
        <View
          key={key}
          onLayout={(event) => measureItem(key, event)}
          style={(itemBottoms[key] ?? 0) > availableHeight ? styles.overflowing : null}
        >
          {node}
        </View>
      ))}
    </View>
  );
}

export interface SwipeCardHandle {
  /** Fait sortir la carte comme un glissement : les boutons et le geste aboutissent au même endroit. */
  dismiss: (decision: ReviewDecision) => void;
}

export function SwipeCard({
  candidate,
  accountName,
  onDecide,
  ref,
}: {
  candidate: Candidate;
  accountName: string | undefined;
  onDecide: (decision: ReviewDecision) => void;
  ref: Ref<SwipeCardHandle>;
}) {
  const { colors, fonts } = useBrand();
  const reduceMotion = useReducedMotion();
  const translateX = useSharedValue(0);
  const cardWidth = useSharedValue(FALLBACK_CARD_WIDTH);
  const leaving = useSharedValue(false);

  function leave(decision: ReviewDecision) {
    'worklet';
    if (leaving.get()) return;
    leaving.set(true);
    if (reduceMotion) {
      scheduleOnRN(onDecide, decision);
      return;
    }
    const direction = decision === 'follow' ? 1 : -1;
    translateX.set(
      withTiming(
        direction * cardWidth.get() * EXIT_DISTANCE_WIDTH_RATIO,
        { duration: EXIT_DURATION_MS },
        (finished) => {
          'worklet';
          if (finished) scheduleOnRN(onDecide, decision);
        },
      ),
    );
  }

  useImperativeHandle(ref, () => ({ dismiss: (decision) => leave(decision) }));

  const pan = usePanGesture({
    activeOffsetX: [-SWIPE_ACTIVATION_DISTANCE, SWIPE_ACTIVATION_DISTANCE],
    failOffsetY: [-SWIPE_VERTICAL_TOLERANCE, SWIPE_VERTICAL_TOLERANCE],
    onUpdate: (event) => {
      'worklet';
      if (!leaving.get()) translateX.set(event.translationX);
    },
    onDeactivate: (event) => {
      'worklet';
      const decision = event.canceled ? null : swipeDecision(event.translationX, event.velocityX, cardWidth.get());
      if (decision) leave(decision);
      else translateX.set(reduceMotion ? 0 : withSpring(0));
    },
  });

  const cardStyle = useAnimatedStyle(() => {
    const rotation = reduceMotion
      ? 0
      : interpolate(
          translateX.get(),
          [-cardWidth.get(), cardWidth.get()],
          [-MAX_ROTATION_DEG, MAX_ROTATION_DEG],
          Extrapolation.CLAMP,
        );
    return { transform: [{ translateX: translateX.get() }, { rotate: `${rotation}deg` }] };
  });
  const followStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.get(),
      [0, cardWidth.get() * SWIPE_COMMIT_WIDTH_RATIO],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));
  const ignoreStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.get(),
      [-cardWidth.get() * SWIPE_COMMIT_WIDTH_RATIO, 0],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const measureCard = (event: LayoutChangeEvent) => cardWidth.set(event.nativeEvent.layout.width);
  const operationsLink = describeOperationsLink(candidate.operations.length);

  /** La carte est lue comme un seul élément : ses actions remplacent le geste et le lien qu'elle contient. */
  const runAccessibilityAction = (actionName: string) => {
    if (actionName === 'follow' || actionName === 'ignore') leave(actionName);
    else if (actionName === 'details') openCandidate(candidate.id);
  };

  return (
    <GestureDetector gesture={pan} userSelect="none">
      <Animated.View
        onLayout={measureCard}
        accessible
        accessibilityLabel={`${candidate.label}, ${monthlyAmount(candidate)} par mois`}
        accessibilityHint="Glissez à droite pour suivre, à gauche pour ignorer"
        accessibilityActions={[
          { name: 'follow', label: 'Suivre cet abonnement' },
          { name: 'ignore', label: 'Ignorer' },
          { name: 'details', label: operationsLink },
        ]}
        onAccessibilityAction={(event) => runAccessibilityAction(event.nativeEvent.actionName)}
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border, boxShadow: CARD_SHADOW },
          cardStyle,
        ]}
      >
        <View style={styles.identity}>
          <ServiceMonogram name={candidate.label} size={56} />
          <View style={styles.identityText}>
            <Text numberOfLines={2} style={[styles.name, { fontFamily: fonts.displayBold, color: colors.ink }]}>
              {candidate.label}
            </Text>
            {accountName ? (
              <Text variant="bodySmall" style={{ color: colors.inkMuted }}>
                {accountName}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.amountRow}>
          <AmountText size={40}>{monthlyAmount(candidate)}</AmountText>
          <Text variant="bodyLarge" style={{ color: colors.inkMuted }}>
            {`/ mois · le ${candidate.dayOfMonth}`}
          </Text>
        </View>

        <View style={styles.signals}>
          <ConfidenceMeter level={candidate.level} confidence={candidate.confidence} />
          {candidate.stale ? <StalePill /> : null}
        </View>

        <FittedDetails>
          {[
            ...candidate.reasons
              .slice(0, REASONS_ON_CARD)
              .map((reason) => ({ key: reason, node: <Reason>{reason}</Reason> })),
            ...(candidate.suggestedSubscriptionId ? [{ key: 'merge-notice', node: <MergeNotice /> }] : []),
          ]}
        </FittedDetails>

        <Pressable
          accessibilityRole="link"
          onPress={() => openCandidate(candidate.id)}
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        >
          <Text style={{ fontFamily: fonts.semiBold, color: colors.action }}>{operationsLink}</Text>
        </Pressable>

        <Animated.View
          style={[styles.stamp, styles.followStamp, { borderColor: colors.action }, followStampStyle]}
          aria-hidden
        >
          <Text style={[styles.stampText, { fontFamily: fonts.displayBold, color: colors.action }]}>SUIVRE</Text>
        </Animated.View>
        <Animated.View
          style={[styles.stamp, styles.ignoreStamp, { borderColor: colors.inkMuted }, ignoreStampStyle]}
          aria-hidden
        >
          <Text style={[styles.stampText, { fontFamily: fonts.displayBold, color: colors.inkMuted }]}>IGNORER</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const CARD_SHADOW = '0px 14px 32px rgba(14, 17, 22, 0.12)';

const styles = StyleSheet.create({
  card: { flexGrow: 1, flexBasis: 0, borderRadius: radii.panel, borderWidth: 1, padding: 22, gap: 16 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  identityText: { flex: 1, gap: 2 },
  name: { fontSize: 22, lineHeight: 28 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 },
  signals: { gap: 8 },
  details: { flexShrink: 1, minHeight: 0, overflow: 'hidden', gap: REASON_GAP },
  overflowing: { opacity: 0 },
  link: { minHeight: 44, marginTop: 'auto', justifyContent: 'center', alignSelf: 'flex-start' },
  pressed: { opacity: 0.7 },
  stamp: {
    position: 'absolute',
    top: 22,
    borderWidth: 2.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  followStamp: { left: 20, transform: [{ rotate: '-8deg' }] },
  ignoreStamp: { right: 20, transform: [{ rotate: '8deg' }] },
  stampText: { fontSize: 15, letterSpacing: 1 },
});
