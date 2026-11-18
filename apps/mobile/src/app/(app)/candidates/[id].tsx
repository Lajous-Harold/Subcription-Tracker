import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { parseAmountToCents, type AcceptCandidateBody, type Candidate } from '@subtracker/contracts';
import { ProviderPicker, type ProviderValue } from '@/components/ProviderPicker';
import { useToast } from '@/components/toast';
import {
  ConfidenceMeter,
  controlStyles,
  EmptyState,
  ErrorState,
  ErrorText,
  Loading,
  Muted,
  Panel,
  Screen,
  ServiceMonogram,
} from '@/components/ui';
import { describeCandidateSource } from '@/features/review/review-session';
import {
  AmountText,
  MergeNotice,
  monthlyAmount,
  OperationList,
  ReasonList,
  SectionLabel,
  StalePill,
} from '@/features/review/ReviewParts';
import { useAccountNames } from '@/features/review/useReviewQueue';
import { api } from '@/lib/api';
import { centsToInput } from '@/lib/format';
import { errorMessage } from '@/lib/http';
import { invalidateDetectionData, queryKeys } from '@/lib/query';
import { useBrand } from '@/lib/theme';

export default function CandidateReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: queryKeys.candidates,
    queryFn: () => api.candidates('pending'),
  });
  const candidate = data?.find((item) => item.id === id);

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!candidate) {
    return (
      <Screen>
        <Panel>
          <EmptyState title="Détection déjà traitée">
            <Button mode="outlined" onPress={() => router.navigate('/review')} contentStyle={styles.mainActionContent}>
              Revenir à la vérification
            </Button>
          </EmptyState>
        </Panel>
      </Screen>
    );
  }
  return (
    <Screen>
      <CandidateSummary candidate={candidate} />
      <CandidateReviewForm candidate={candidate} />
    </Screen>
  );
}

function CandidateSummary({ candidate }: { candidate: Candidate }) {
  const { colors, fonts } = useBrand();
  const accountNames = useAccountNames();
  const accountName = candidate.accountId ? accountNames.get(candidate.accountId) : undefined;
  return (
    <Panel>
      <View style={styles.identity}>
        <ServiceMonogram name={candidate.label} size={56} />
        <View style={styles.grow}>
          <Text style={[styles.title, { fontFamily: fonts.displayBold, color: colors.ink }]}>{candidate.label}</Text>
          <Muted>{describeCandidateSource(candidate, accountName)}</Muted>
        </View>
      </View>
      <View style={styles.amountRow}>
        <AmountText size={34}>{monthlyAmount(candidate)}</AmountText>
        <Text variant="bodyLarge" style={{ color: colors.inkMuted }}>
          {`/ mois · le ${candidate.dayOfMonth}`}
        </Text>
      </View>
      <View style={styles.signals}>
        <ConfidenceMeter level={candidate.level} confidence={candidate.confidence} />
        {candidate.stale ? <StalePill /> : null}
      </View>
      <ReasonList reasons={candidate.reasons} />
      {candidate.suggestedSubscriptionId ? <MergeNotice /> : null}
      <View style={styles.operations}>
        <SectionLabel>Opérations</SectionLabel>
        <OperationList operations={candidate.operations} currency={candidate.currency} />
      </View>
    </Panel>
  );
}

function CandidateReviewForm({ candidate }: { candidate: Candidate }) {
  const id = candidate.id;
  const toast = useToast();
  const [label, setLabel] = useState(candidate.label);
  const [provider, setProvider] = useState<ProviderValue>({ provider: candidate.provider, customName: '' });
  const [amount, setAmount] = useState(centsToInput(candidate.amount.lastCents));
  const [billingDay, setBillingDay] = useState(String(candidate.dayOfMonth));
  const [formError, setFormError] = useState<string | null>(null);

  const accept = useMutation({
    mutationFn: (body: AcceptCandidateBody) => api.acceptCandidate(id, body),
    onSuccess: (sub) => {
      invalidateDetectionData();
      toast.show(`« ${sub.label} » ajouté à vos abonnements`);
      router.replace(`/subscriptions/${sub.id}`);
    },
    onError: (caught) => setFormError(errorMessage(caught)),
  });

  const submit = () => {
    // N'envoie que les valeurs modifiées : elles seules passent en « Déclaré ».
    const body: AcceptCandidateBody = {};
    if (label.trim() && label.trim() !== candidate.label) body.label = label.trim();
    const providerId = provider.provider?.id ?? null;
    if (providerId !== (candidate.provider?.id ?? null)) body.providerId = providerId;
    if (!providerId && provider.customName.trim()) body.customProviderName = provider.customName.trim();
    const cents = parseAmountToCents(amount);
    if (cents === null || cents <= 0) return setFormError('Montant invalide');
    if (cents !== candidate.amount.lastCents) body.amountCents = cents;
    const day = Number(billingDay);
    if (!Number.isInteger(day) || day < 1 || day > 31) return setFormError('Jour entre 1 et 31');
    if (day !== candidate.dayOfMonth) body.billingDay = day;
    setFormError(null);
    accept.mutate(body);
  };

  return (
    <Panel>
      <Text variant="titleLarge" accessibilityRole="header">
        Modifier avant de suivre
      </Text>
      <TextInput
        label="Libellé"
        mode="outlined"
        outlineStyle={controlStyles.fieldOutline}
        value={label}
        onChangeText={setLabel}
      />
      <ProviderPicker value={provider} onChange={setProvider} />
      <TextInput
        label={`Montant mensuel (${candidate.currency})`}
        mode="outlined"
        outlineStyle={controlStyles.fieldOutline}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />
      <TextInput
        label="Jour de prélèvement"
        mode="outlined"
        outlineStyle={controlStyles.fieldOutline}
        value={billingDay}
        onChangeText={setBillingDay}
        keyboardType="number-pad"
        maxLength={2}
      />
      <Muted>
        Les valeurs que vous modifiez sont marquées « Déclaré » ; les autres restent « Observé » et suivront vos
        prochains paiements.
      </Muted>
      <ErrorText message={formError} />
      <Button
        mode="contained"
        onPress={submit}
        loading={accept.isPending}
        disabled={accept.isPending}
        contentStyle={styles.mainActionContent}
      >
        Suivre cet abonnement
      </Button>
    </Panel>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  grow: { flex: 1, gap: 2 },
  title: { fontSize: 24, lineHeight: 30 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 },
  signals: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  operations: { gap: 8 },
  mainActionContent: { minHeight: 48 },
});
