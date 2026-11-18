import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRef } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { radii, useBrand } from '@/lib/theme';
import type { ReviewProgress } from './review-session';
import { ReviewEmpty, UNDO_BANNER_MIN_HEIGHT, UndoBanner } from './ReviewParts';
import { SwipeCard, type SwipeCardHandle } from './SwipeCard';
import type { ReviewQueue } from './useReviewQueue';

const MAX_PROGRESS_SEGMENTS = 12;
const BACK_CARDS = 2;
const BACK_CARD_OFFSET = 12;
/**
 * La carte occupe la hauteur libre entre ces bornes ; en dessous, l'écran défile. `flexBasis: 0` explicite :
 * le `flex: 1` de react-native-web donne `0%`, résolu sur le contenu dans un `ScrollView` du web.
 */
const DECK_MIN_HEIGHT = 320;
const DECK_MAX_HEIGHT = 560;
const DECISION_BUTTON_SIZE = 64;

function ProgressSegments({ progress }: { progress: ReviewProgress }) {
  const { colors } = useBrand();
  const { position, total } = progress;
  const segmentColor = (index: number) =>
    index < position - 1 ? colors.ink : index === position - 1 ? colors.action : colors.trackInactive;
  return (
    <View
      style={styles.progress}
      role="progressbar"
      accessibilityLabel={`Détection ${position} sur ${total}`}
      accessibilityValue={{ min: 1, max: total, now: position }}
    >
      <Text variant="bodySmall" style={{ color: colors.inkMuted }}>
        {`${position} sur ${total} · rien n’est suivi sans votre accord`}
      </Text>
      {total <= MAX_PROGRESS_SEGMENTS ? (
        <View style={styles.segments}>
          {Array.from({ length: total }, (_, index) => (
            <View key={index} style={[styles.segment, { backgroundColor: segmentColor(index) }]} />
          ))}
        </View>
      ) : (
        <View style={[styles.segment, { backgroundColor: colors.trackInactive }]}>
          <View style={[styles.fill, { width: `${(position / total) * 100}%`, backgroundColor: colors.action }]} />
        </View>
      )}
    </View>
  );
}

/** Cartes suivantes devinées derrière la carte du dessus : décor seul, la carte suivante n'est pas lisible. */
function BackCards({ count }: { count: number }) {
  const { colors } = useBrand();
  const layers = [
    { inset: 20, top: 0, color: colors.border },
    { inset: 10, top: BACK_CARD_OFFSET, color: colors.tile },
  ].slice(BACK_CARDS - count);
  return layers.map((layer) => (
    <View
      key={layer.inset}
      aria-hidden
      style={[
        styles.backCard,
        {
          left: layer.inset,
          right: layer.inset,
          top: layer.top,
          backgroundColor: layer.color,
          borderColor: colors.border,
        },
      ]}
    />
  ));
}

function SwipeHint() {
  const { colors } = useBrand();
  return (
    <View style={styles.hint} aria-hidden>
      <View style={styles.hintSide}>
        <MaterialCommunityIcons name="arrow-left" size={16} color={colors.inkMuted} />
        <Text variant="bodySmall" style={{ color: colors.inkMuted }}>
          Ignorer
        </Text>
      </View>
      <Text variant="bodySmall" style={{ color: colors.inkMuted }}>
        Glissez la carte
      </Text>
      <View style={styles.hintSide}>
        <Text variant="bodySmall" style={{ color: colors.inkMuted }}>
          Suivre
        </Text>
        <MaterialCommunityIcons name="arrow-right" size={16} color={colors.inkMuted} />
      </View>
    </View>
  );
}

function DecisionButtons({ onIgnore, onFollow }: { onIgnore: () => void; onFollow: () => void }) {
  const { colors } = useBrand();
  return (
    <View style={styles.buttons}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ignorer"
        onPress={onIgnore}
        style={({ pressed }) => [
          styles.roundButton,
          { backgroundColor: pressed ? colors.tile : colors.surface, borderColor: colors.trackInactive },
        ]}
      >
        <MaterialCommunityIcons name="close" size={28} color={colors.ink} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Suivre cet abonnement"
        onPress={onFollow}
        style={({ pressed }) => [
          styles.roundButton,
          { backgroundColor: pressed ? colors.actionPressed : colors.action, borderColor: 'transparent' },
        ]}
      >
        <MaterialCommunityIcons name="check" size={30} color={colors.onAction} />
      </Pressable>
    </View>
  );
}

/** Mode compact : une carte à la fois, décidée d'un glissement ou par les boutons équivalents. */
export function CompactReview({
  queue,
  accountNames,
}: {
  queue: ReviewQueue;
  accountNames: ReadonlyMap<string, string>;
}) {
  const cardRef = useRef<SwipeCardHandle>(null);
  const { candidates, candidatesQuery } = queue;
  const current = candidates[0];

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={candidatesQuery.isRefetching} onRefresh={() => void candidatesQuery.refetch()} />
        }
      >
        {current ? (
          <>
            <ProgressSegments progress={queue.progress} />
            <View style={styles.deck}>
              <BackCards count={Math.min(BACK_CARDS, candidates.length - 1)} />
              <SwipeCard
                key={current.id}
                ref={cardRef}
                candidate={current}
                accountName={current.accountId ? accountNames.get(current.accountId) : undefined}
                onDecide={(decision) => queue.decide(current, decision)}
              />
            </View>
          </>
        ) : (
          <ReviewEmpty />
        )}
      </ScrollView>
      <View style={styles.controls}>
        {current ? (
          <>
            {/* Le bandeau prend la place de l'indication, à hauteur réservée : la carte ne bouge pas à son apparition. */}
            <View style={styles.hintSlot}>
              {queue.undoable ? <UndoBanner undoable={queue.undoable} onUndo={queue.undo} /> : <SwipeHint />}
            </View>
            <DecisionButtons
              onIgnore={() => cardRef.current?.dismiss('ignore')}
              onFollow={() => cardRef.current?.dismiss('follow')}
            />
          </>
        ) : (
          <UndoBanner undoable={queue.undoable} onUndo={queue.undo} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, padding: 16, gap: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
  progress: { gap: 8 },
  segments: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
  deck: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: DECK_MIN_HEIGHT,
    maxHeight: DECK_MAX_HEIGHT,
    paddingTop: BACK_CARD_OFFSET * 2,
  },
  backCard: { position: 'absolute', bottom: 0, borderRadius: radii.panel, borderWidth: 1 },
  controls: { paddingHorizontal: 16, paddingBottom: 16, gap: 12, width: '100%', maxWidth: 560, alignSelf: 'center' },
  hintSlot: { minHeight: UNDO_BANNER_MIN_HEIGHT, justifyContent: 'center' },
  hint: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12 },
  hintSide: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  buttons: { flexDirection: 'row', justifyContent: 'center', gap: 48 },
  roundButton: {
    width: DECISION_BUTTON_SIZE,
    height: DECISION_BUTTON_SIZE,
    borderRadius: DECISION_BUTTON_SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
