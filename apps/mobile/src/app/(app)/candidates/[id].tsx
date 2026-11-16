import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, Card, HelperText, TextInput } from 'react-native-paper';
import { parseAmountToCents, type AcceptCandidateBody, type Candidate } from '@subtracker/contracts';
import { ProviderPicker, type ProviderValue } from '@/components/ProviderPicker';
import { useToast } from '@/components/toast';
import { EmptyState, ErrorState, Loading, Muted, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { centsToInput } from '@/lib/format';
import { errorMessage } from '@/lib/http';
import { invalidateDetectionData, keys } from '@/lib/query';

/** Corriger une détection avant de la confirmer : chaque valeur modifiée devient « Déclaré ». */
export default function CandidateReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: keys.candidates,
    queryFn: () => api.candidates('pending'),
  });
  const candidate = data?.find((item) => item.id === id);

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!candidate) {
    return (
      <Screen>
        <EmptyState title="Détection déjà traitée" />
      </Screen>
    );
  }
  return <CandidateReviewForm candidate={candidate} />;
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
    <Screen>
      <Card>
        <Card.Content style={{ gap: 8 }}>
          <TextInput label="Libellé" mode="outlined" value={label} onChangeText={setLabel} />
          <ProviderPicker value={provider} onChange={setProvider} />
          <TextInput
            label={`Montant mensuel (${candidate.currency})`}
            mode="outlined"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <TextInput
            label="Jour de prélèvement"
            mode="outlined"
            value={billingDay}
            onChangeText={setBillingDay}
            keyboardType="number-pad"
            maxLength={2}
          />
          <Muted>
            Les valeurs que vous modifiez sont marquées « Déclaré » ; les autres restent « Observé » et suivront vos
            prochains paiements.
          </Muted>
          {formError ? (
            <HelperText type="error" visible>
              {formError}
            </HelperText>
          ) : null}
        </Card.Content>
        <Card.Actions>
          <Button mode="contained" onPress={submit} loading={accept.isPending} disabled={accept.isPending}>
            Confirmer l’abonnement
          </Button>
        </Card.Actions>
      </Card>
    </Screen>
  );
}
