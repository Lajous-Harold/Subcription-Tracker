import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import type { Cancellation, CancellationStatus, Provider, SubscriptionDetail } from '@subtracker/contracts';
import { AppButton } from '@/components/AppButton';
import { useToast } from '@/components/toast';
import { Muted } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, formatMediumDate } from '@/lib/format';
import { queryKeys, storeUpdatedSubscription } from '@/lib/query';
import { radii, tabularNums, useBrand } from '@/lib/theme';
import {
  CANCELLATION_CHOICES,
  cancellationChoiceOf,
  cancellationStatusFor,
  GENERIC_CANCELLATION_INSTRUCTIONS,
  splitInstructionSteps,
  type CancellationChoice,
} from './presentation';

export function useSubscriptionProvider(subscription: SubscriptionDetail | undefined) {
  const slug = subscription?.provider?.slug;
  return useQuery({
    queryKey: queryKeys.provider(slug),
    queryFn: () => api.provider(slug!),
    enabled: Boolean(slug),
  });
}

function ProcedureBadge({ provider }: { provider: Provider | null }) {
  const { colors } = useBrand();
  if (!provider) return <Muted>Démarche générale</Muted>;
  const verifiedAt = provider.cancellation.lastVerifiedAt;
  const color = verifiedAt ? colors.action : colors.signalText;
  return (
    <View
      style={procedureStyles.badge}
      accessible
      accessibilityLabel={
        verifiedAt ? `Procédure vérifiée le ${formatDate(verifiedAt)}` : 'Procédure non vérifiée : indicative seulement'
      }
    >
      <Icon source={verifiedAt ? 'check' : 'alert-circle-outline'} size={14} color={color} />
      <Text variant="labelMedium" style={{ color }}>
        {verifiedAt ? 'Procédure vérifiée' : 'Procédure non vérifiée'}
      </Text>
    </View>
  );
}

/** Contenu d'un panneau : titre, badge de vérification, étapes numérotées et lien vers le parcours officiel. */
export function CancellationProcedure({
  provider,
  title,
  showHelpLink,
}: {
  provider: Provider | null;
  title: string;
  showHelpLink?: boolean;
}) {
  const brand = useBrand();
  const procedure = provider?.cancellation;
  const steps = splitInstructionSteps(procedure?.instructions ?? GENERIC_CANCELLATION_INSTRUCTIONS);
  const officialUrl = procedure?.url ?? procedure?.sourceUrl ?? null;
  const helpUrl = showHelpLink && procedure?.sourceUrl !== officialUrl ? procedure?.sourceUrl : null;

  return (
    <>
      <View style={procedureStyles.heading}>
        <Text variant="titleLarge" accessibilityRole="header" style={procedureStyles.title}>
          {title}
        </Text>
        <ProcedureBadge provider={provider} />
      </View>
      <View style={procedureStyles.steps}>
        {steps.map((step, index) => (
          <View key={step} style={procedureStyles.step} accessible accessibilityLabel={`Étape ${index + 1} : ${step}`}>
            <View style={[procedureStyles.stepNumber, { backgroundColor: brand.colors.background }]}>
              <Text style={[procedureStyles.stepNumberText, tabularNums, { fontFamily: brand.fonts.bold }]}>
                {index + 1}
              </Text>
            </View>
            <Text variant="bodyMedium" style={procedureStyles.stepText}>
              {step}
            </Text>
          </View>
        ))}
      </View>
      {officialUrl ? (
        <AppButton
          variant="ink"
          icon="open-in-new"
          iconPosition="end"
          onPress={() => void WebBrowser.openBrowserAsync(officialUrl)}
        >
          Ouvrir la page officielle
        </AppButton>
      ) : null}
      {helpUrl ? (
        <AppButton variant="secondary" onPress={() => void WebBrowser.openBrowserAsync(helpUrl)}>
          Lire l’aide officielle
        </AppButton>
      ) : null}
    </>
  );
}

function cancellationDetails(cancellation: Cancellation): string | null {
  return (
    [
      cancellation.requestedAt ? `Demandée le ${formatMediumDate(cancellation.requestedAt)}` : null,
      cancellation.effectiveDate ? `Effective le ${formatMediumDate(cancellation.effectiveDate)}` : null,
      cancellation.reference ? `Réf. ${cancellation.reference}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || null
  );
}

function cancellationSummary(cancellation: Cancellation | null): string | null {
  if (!cancellation) return 'L’application n’envoie rien au fournisseur : elle garde la trace de votre démarche.';
  const details = cancellationDetails(cancellation);
  switch (cancellation.status) {
    case 'started':
      return 'Démarche commencée : choisissez « Demandée » une fois la demande envoyée.';
    case 'abandoned':
      return details ? `Démarche abandonnée · ${details}` : 'Démarche abandonnée.';
    default:
      return details;
  }
}

const SEGMENT_RADIUS = 10;
const SEGMENT_INSET = 4;

/** Sélecteur « Où en êtes-vous ? » de la fiche ; méthode, dates et référence se règlent dans le formulaire complet. */
export function CancellationTracker({ subscription }: { subscription: SubscriptionDetail }) {
  const { colors } = useBrand();
  const toast = useToast();
  const cancellation = subscription.cancellation;
  const selected = cancellationChoiceOf(cancellation);
  const updateStatus = useMutation({
    mutationFn: (status: CancellationStatus) => api.upsertCancellation(subscription.id, { status }),
    onSuccess: (updated) => {
      storeUpdatedSubscription(updated);
      toast.show('Suivi de résiliation mis à jour');
    },
    onError: toast.showError,
  });
  const choose = (choice: CancellationChoice) => {
    const status = cancellationStatusFor(choice, cancellation);
    if (status) updateStatus.mutate(status);
  };
  const summary = cancellationSummary(cancellation);

  return (
    <View style={trackerStyles.section}>
      <Text variant="bodyMedium" accessibilityRole="header" style={{ color: colors.inkMuted }}>
        Où en êtes-vous ?
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Suivi de la résiliation"
        style={[trackerStyles.segments, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        {CANCELLATION_CHOICES.map((choice) => {
          const checked = choice.value === selected;
          return (
            <Pressable
              key={choice.value}
              accessibilityRole="radio"
              accessibilityState={{ checked, disabled: updateStatus.isPending }}
              disabled={updateStatus.isPending}
              onPress={() => choose(choice.value)}
              style={({ pressed }) => [
                trackerStyles.segment,
                { backgroundColor: checked ? colors.ink : pressed ? colors.tile : 'transparent' },
              ]}
            >
              <Text variant="labelLarge" numberOfLines={1} style={{ color: checked ? colors.surface : colors.ink }}>
                {choice.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {summary ? <Muted>{summary}</Muted> : null}
      <AppButton
        variant="secondary"
        icon="clipboard-check-outline"
        onPress={() => router.push(`/subscriptions/${subscription.id}/cancel`)}
      >
        {cancellation ? 'Compléter le suivi' : 'Détailler ma démarche'}
      </AppButton>
    </View>
  );
}

const procedureStyles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  title: { flexShrink: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  steps: { gap: 10 },
  step: { flexDirection: 'row', gap: 10 },
  stepNumber: { width: 22, height: 22, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: 12, lineHeight: 16 },
  stepText: { flex: 1, fontSize: 14, lineHeight: 20 },
});

const trackerStyles = StyleSheet.create({
  section: { gap: 8 },
  segments: {
    flexDirection: 'row',
    gap: SEGMENT_INSET,
    padding: SEGMENT_INSET,
    borderWidth: 1,
    borderRadius: SEGMENT_RADIUS + SEGMENT_INSET,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 8,
    borderRadius: SEGMENT_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
