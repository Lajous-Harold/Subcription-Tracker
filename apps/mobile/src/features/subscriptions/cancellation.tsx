import { useQuery } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';
import type { Cancellation, Provider, SubscriptionDetail } from '@subtracker/contracts';
import { controlStyles, Muted } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { queryKeys } from '@/lib/query';
import { radii, tabularNums, useBrand } from '@/lib/theme';
import { CANCELLATION_PROGRESS, GENERIC_CANCELLATION_INSTRUCTIONS, splitInstructionSteps } from './presentation';

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
      <Icon source={verifiedAt ? 'check-decagram' : 'alert-circle-outline'} size={16} color={color} />
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
            <View style={[procedureStyles.stepNumber, { backgroundColor: brand.colors.tile }]}>
              <Text variant="labelMedium" style={tabularNums}>
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
        <Button
          mode="contained"
          icon="open-in-new"
          contentStyle={[controlStyles.mainAction, procedureStyles.iconAfter]}
          onPress={() => void WebBrowser.openBrowserAsync(officialUrl)}
        >
          Ouvrir la page officielle
        </Button>
      ) : null}
      {helpUrl ? (
        <Button
          mode="outlined"
          contentStyle={controlStyles.mainAction}
          onPress={() => void WebBrowser.openBrowserAsync(helpUrl)}
        >
          Lire l’aide officielle
        </Button>
      ) : null}
    </>
  );
}

function cancellationDetails(cancellation: Cancellation): string | null {
  return (
    [
      cancellation.requestedAt ? `Demandée le ${formatDate(cancellation.requestedAt)}` : null,
      cancellation.effectiveDate ? `Effective le ${formatDate(cancellation.effectiveDate)}` : null,
      cancellation.reference ? `Réf. ${cancellation.reference}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || null
  );
}

/** Orange tant que la démarche est en cours, cobalt une fois confirmée. */
export function CancellationProgress({ cancellation }: { cancellation: Cancellation }) {
  const { colors } = useBrand();
  const details = cancellationDetails(cancellation);
  if (cancellation.status === 'abandoned') {
    return (
      <View style={procedureStyles.progress}>
        <Text variant="titleMedium">Démarche abandonnée</Text>
        <Muted>{details ?? 'L’abonnement est de nouveau suivi comme actif.'}</Muted>
      </View>
    );
  }
  const currentIndex = CANCELLATION_PROGRESS.findIndex((step) => step.status === cancellation.status);
  const current = CANCELLATION_PROGRESS[currentIndex];
  const fillColor = cancellation.status === 'confirmed' ? colors.action : colors.signal;
  return (
    <View style={procedureStyles.progress}>
      <View
        style={procedureStyles.track}
        accessible
        accessibilityLabel={`Résiliation ${current?.label.toLowerCase()} : étape ${currentIndex + 1} sur ${CANCELLATION_PROGRESS.length}`}
      >
        {CANCELLATION_PROGRESS.map((step, index) => {
          const reached = index <= currentIndex;
          return (
            <View key={step.status} style={procedureStyles.trackStep}>
              <View
                style={[procedureStyles.segment, { backgroundColor: reached ? fillColor : colors.trackInactive }]}
              />
              <Text
                variant={index === currentIndex ? 'labelMedium' : 'bodySmall'}
                style={{ color: reached ? colors.ink : colors.inkMuted }}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
      {details ? <Muted>{details}</Muted> : null}
    </View>
  );
}

const procedureStyles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  title: { flexShrink: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  steps: { gap: 10 },
  step: { flexDirection: 'row', gap: 10 },
  stepNumber: { width: 24, height: 24, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  stepText: { flex: 1, lineHeight: 20 },
  iconAfter: { flexDirection: 'row-reverse' },
  progress: { gap: 8 },
  track: { flexDirection: 'row', gap: 6 },
  trackStep: { flex: 1, gap: 6 },
  segment: { height: 8, borderRadius: radii.pill },
});
