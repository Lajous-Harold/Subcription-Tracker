import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRef } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppRoundButton } from '@/components/AppButton';
import { radii, useBrand } from '@/lib/theme';
import type { ReviewProgress } from './review-session';
import { ReviewEmpty, UndoBanner } from './ReviewParts';
import { SwipeCard, type SwipeCardHandle } from './SwipeCard';
import type { ReviewQueue } from './useReviewQueue';

const MAX_PROGRESS_SEGMENTS = 12;
const BACK_CARDS = 2;
const BACK_CARD_OFFSET = 12;
/**
 * La carte prend la hauteur de son contenu, bornée par la place libre (au moins `DECK_MIN_HEIGHT` : en dessous,
 * l'écran défile). `flexBasis: 0` explicite : le `flex: 1` de react-native-web donne `0%`, résolu sur le contenu
 * dans un `ScrollView` du web.
 */
const DECK_MIN_HEIGHT = 320;
const CARD_MAX_HEIGHT = 600;

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
      <Text style={[styles.subtitle, { color: colors.inkMuted }]}>
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

/**
 * Cartes suivantes devinées derrière la carte du dessus, plus étroites et plus pâles : décor seul, la carte
 * suivante n'est pas lisible. Elles s'arrêtent avant le bas de la carte pour ne dépasser que par le haut.
 */
function BackCards({ count }: { count: number }) {
  const { colors } = useBrand();
  const layers = [
    { inset: 20, top: 0, bottom: BACK_CARD_OFFSET * 3, color: colors.border },
    { inset: 10, top: BACK_CARD_OFFSET, bottom: BACK_CARD_OFFSET * 2, color: colors.tile },
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
          bottom: layer.bottom,
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
        <Text style={[styles.hintText, { color: colors.inkMuted }]}>Ignorer</Text>
      </View>
      <Text style={[styles.hintText, { color: colors.inkMuted }]}>Glissez la carte</Text>
      <View style={styles.hintSide}>
        <Text style={[styles.hintText, { color: colors.inkMuted }]}>Suivre</Text>
        <MaterialCommunityIcons name="arrow-right" size={16} color={colors.inkMuted} />
      </View>
    </View>
  );
}

function DecisionButtons({ onIgnore, onFollow }: { onIgnore: () => void; onFollow: () => void }) {
  return (
    <View style={styles.buttons}>
      <AppRoundButton icon="close" accessibilityLabel="Ignorer" onPress={onIgnore} />
      <AppRoundButton icon="check" variant="primary" accessibilityLabel="Suivre cet abonnement" onPress={onFollow} />
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
              <View style={styles.stack}>
                <BackCards count={Math.min(BACK_CARDS, candidates.length - 1)} />
                <SwipeCard
                  key={current.id}
                  ref={cardRef}
                  candidate={current}
                  accountName={current.accountId ? accountNames.get(current.accountId) : undefined}
                  onDecide={(decision) => queue.decide(current, decision)}
                />
              </View>
            </View>
          </>
        ) : (
          <ReviewEmpty />
        )}
      </ScrollView>
      <View style={styles.controls}>
        <UndoBanner undoable={queue.undoable} onUndo={queue.undo} />
        {current ? (
          <>
            <SwipeHint />
            <DecisionButtons
              onIgnore={() => cardRef.current?.dismiss('ignore')}
              onFollow={() => cardRef.current?.dismiss('follow')}
            />
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  /** Haut serré : le sous-titre se lit comme la suite du titre de l'en-tête. Bas aéré : l'ombre de la carte. */
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 20,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  progress: { gap: 8 },
  subtitle: { fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
  segments: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
  deck: { flexGrow: 1, flexBasis: 0, minHeight: DECK_MIN_HEIGHT },
  stack: { flexShrink: 1, minHeight: 0, maxHeight: CARD_MAX_HEIGHT, paddingTop: BACK_CARD_OFFSET * 2 },
  backCard: { position: 'absolute', borderRadius: radii.panel, borderWidth: 1 },
  controls: { paddingHorizontal: 16, paddingBottom: 20, gap: 12, width: '100%', maxWidth: 560, alignSelf: 'center' },
  hint: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12 },
  hintSide: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hintText: { fontSize: 13, lineHeight: 18 },
  buttons: { flexDirection: 'row', justifyContent: 'center', gap: 48 },
});
