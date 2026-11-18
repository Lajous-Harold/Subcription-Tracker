import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import type { Candidate } from '@subtracker/contracts';
import { AppButton } from '@/components/AppButton';
import { ConfidenceMeter, Panel, ServiceMonogram } from '@/components/ui';
import { formatMediumDate } from '@/lib/format';
import { useWidePageGutter } from '@/lib/layout';
import { tabularNums, useBrand } from '@/lib/theme';
import { candidateAfter, describeCandidateSource, type ReviewDecision } from './review-session';
import {
  AmountText,
  MergeNotice,
  monthlyAmount,
  openCandidate,
  OperationList,
  ReasonList,
  ReviewEmpty,
  SectionLabel,
  StalePill,
  UndoBanner,
} from './ReviewParts';
import type { ReviewQueue } from './useReviewQueue';
import { shortcutsAvailable, undoShortcutLabel, useReviewShortcuts } from './useReviewShortcuts';

function describeDetections(count: number): string {
  return count === 1 ? '1 série régulière trouvée' : `${count} séries régulières trouvées`;
}

function describeSchedule(candidate: Candidate): string {
  return candidate.stale
    ? `par mois · dernier le ${formatMediumDate(candidate.lastDate)}`
    : `par mois · prochain vers le ${formatMediumDate(candidate.nextDueDate)}`;
}

/** Plus serré que celui des panneaux : un élément de liste n'est pas un panneau. */
const LIST_ITEM_RADIUS = 16;

/** Au-delà, les plus anciennes se replient : les boutons de décision restent visibles sans défiler. */
const OPERATIONS_SHOWN_FIRST = 6;

function Kbd({ children }: { children: string }) {
  const { colors, fonts } = useBrand();
  return (
    <View style={[styles.kbd, { borderColor: colors.trackInactive, backgroundColor: colors.surface }]}>
      <Text style={[styles.kbdText, { fontFamily: fonts.semiBold, color: colors.ink }]}>{children}</Text>
    </View>
  );
}

function ShortcutHint({ keys, action }: { keys: string; action: string }) {
  const { colors } = useBrand();
  return (
    <View style={styles.shortcut}>
      <Kbd>{keys}</Kbd>
      <Text style={[styles.shortcutText, { color: colors.inkMuted }]}>{action}</Text>
    </View>
  );
}

function ShortcutHints() {
  return (
    <View
      style={styles.shortcuts}
      accessibilityLabel={`Raccourcis : C suivre, I ignorer, ${undoShortcutLabel} annuler`}
    >
      <ShortcutHint keys="C" action="suivre" />
      <ShortcutHint keys="I" action="ignorer" />
      <ShortcutHint keys={undoShortcutLabel} action="annuler" />
    </View>
  );
}

function CandidateListItem({
  candidate,
  selected,
  onSelect,
}: {
  candidate: Candidate;
  selected: boolean;
  onSelect: () => void;
}) {
  const { colors, fonts } = useBrand();
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${candidate.label}, ${monthlyAmount(candidate)} par mois${candidate.stale ? ', peut-être terminé' : ''}`}
      onPress={onSelect}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.listItem,
        {
          backgroundColor: pressed || hovered ? colors.tile : colors.surface,
          borderColor: selected ? colors.action : colors.border,
        },
        selected ? styles.listItemSelected : null,
      ]}
    >
      <View style={styles.between}>
        <Text numberOfLines={1} style={[styles.grow, { fontFamily: fonts.semiBold, color: colors.ink }]}>
          {candidate.label}
        </Text>
        <Text style={[tabularNums, { fontFamily: fonts.semiBold, color: colors.ink }]}>{monthlyAmount(candidate)}</Text>
      </View>
      <ConfidenceMeter level={candidate.level} confidence={candidate.confidence} />
      {candidate.stale ? <StalePill /> : null}
    </Pressable>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.detailSection}>
      <SectionLabel>{title}</SectionLabel>
      {children}
    </View>
  );
}

function CandidateDetail({
  candidate,
  accountName,
  onDecide,
}: {
  candidate: Candidate;
  accountName: string | undefined;
  onDecide: (decision: ReviewDecision) => void;
}) {
  const { colors, fonts } = useBrand();
  return (
    <Panel style={styles.detail}>
      <View style={styles.detailHeader}>
        <View style={styles.identity}>
          <ServiceMonogram name={candidate.label} size={56} />
          <View style={styles.grow}>
            <Text
              accessibilityRole="header"
              style={[styles.detailTitle, { fontFamily: fonts.displayBold, color: colors.ink }]}
            >
              {candidate.label}
            </Text>
            <Text variant="bodyMedium" style={{ color: colors.inkMuted }}>
              {describeCandidateSource(candidate, accountName)}
            </Text>
          </View>
        </View>
        <View style={styles.detailAmount}>
          <AmountText size={34}>{monthlyAmount(candidate)}</AmountText>
          <Text variant="bodyMedium" style={[styles.alignRight, { color: colors.inkMuted }]}>
            {describeSchedule(candidate)}
          </Text>
        </View>
      </View>

      {candidate.stale ? <StalePill /> : null}

      <View style={styles.columns}>
        <DetailSection title="Pourquoi">
          <ReasonList reasons={candidate.reasons} />
        </DetailSection>
        <DetailSection title="Opérations">
          <OperationList
            key={candidate.id}
            operations={candidate.operations}
            currency={candidate.currency}
            collapsedCount={OPERATIONS_SHOWN_FIRST}
          />
        </DetailSection>
      </View>

      {candidate.suggestedSubscriptionId ? <MergeNotice /> : null}

      <View style={[styles.actions, { borderTopColor: colors.tile }]}>
        <AppButton onPress={() => onDecide('follow')}>Suivre cet abonnement</AppButton>
        <AppButton variant="secondary" onPress={() => onDecide('ignore')}>
          Ignorer
        </AppButton>
        <AppButton variant="ghost" onPress={() => openCandidate(candidate.id)}>
          Modifier avant de suivre
        </AppButton>
      </View>
    </Panel>
  );
}

/** Mode large : liste des détections et détail côte à côte, décision au clavier sur le web. */
export function WideReview({ queue, accountNames }: { queue: ReviewQueue; accountNames: ReadonlyMap<string, string> }) {
  const { colors } = useBrand();
  const gutter = useWidePageGutter();
  const { candidates } = queue;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = candidates.find((candidate) => candidate.id === selectedId) ?? candidates[0] ?? null;

  function decideSelected(decision: ReviewDecision) {
    if (!selected) return;
    setSelectedId(candidateAfter(candidates, selected.id)?.id ?? null);
    queue.decide(selected, decision);
  }

  function restore(candidateId: string | null) {
    if (candidateId) setSelectedId(candidateId);
  }

  useReviewShortcuts({
    follow: () => decideSelected('follow'),
    ignore: () => decideSelected('ignore'),
    undo: () => restore(queue.undoLast()),
  });

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: gutter }]}>
        {selected ? (
          <View style={styles.header}>
            <Text style={[styles.grow, styles.intro, { color: colors.inkMuted }]}>
              {`${describeDetections(candidates.length)} dans vos opérations. Rien n’est suivi sans votre accord.`}
            </Text>
            {shortcutsAvailable ? <ShortcutHints /> : null}
          </View>
        ) : null}
        {selected ? (
          <View style={styles.split}>
            <View style={styles.list} role="list" accessibilityLabel="Détections">
              {candidates.map((candidate) => (
                <CandidateListItem
                  key={candidate.id}
                  candidate={candidate}
                  selected={candidate.id === selected.id}
                  onSelect={() => setSelectedId(candidate.id)}
                />
              ))}
            </View>
            <CandidateDetail
              candidate={selected}
              accountName={selected.accountId ? accountNames.get(selected.accountId) : undefined}
              onDecide={decideSelected}
            />
          </View>
        ) : (
          <View style={styles.empty}>
            <ReviewEmpty />
          </View>
        )}
      </ScrollView>
      <UndoBanner
        undoable={queue.undoable}
        onUndo={(candidateId) => restore(queue.undo(candidateId) ? candidateId : null)}
        style={styles.banner}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingTop: 0, paddingBottom: 96, gap: 24 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  intro: { fontSize: 15, lineHeight: 22 },
  grow: { flex: 1 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  shortcuts: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  shortcut: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shortcutText: { fontSize: 13, lineHeight: 18 },
  kbd: { borderWidth: 1, borderBottomWidth: 2, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1 },
  kbdText: { fontSize: 12, lineHeight: 18 },
  split: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  list: { flexGrow: 1, flexShrink: 1, flexBasis: 300, maxWidth: 380, gap: 10 },
  listItem: { borderRadius: LIST_ITEM_RADIUS, borderWidth: 1, padding: 17, gap: 8 },
  listItemSelected: { borderWidth: 2, padding: 16 },
  detail: { flexGrow: 2, flexShrink: 1, flexBasis: 520, padding: 28, gap: 22 },
  detailHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, flexGrow: 1, flexShrink: 1, flexBasis: 240 },
  detailTitle: { fontSize: 26, lineHeight: 32 },
  detailAmount: { alignItems: 'flex-end', marginLeft: 'auto' },
  alignRight: { textAlign: 'right' },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  detailSection: { flexGrow: 1, flexShrink: 1, flexBasis: 240, gap: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 12, borderTopWidth: 1 },
  empty: { maxWidth: 640, width: '100%', alignSelf: 'center' },
  banner: { position: 'absolute', bottom: 24, alignSelf: 'center', width: 480, maxWidth: '90%' },
});
