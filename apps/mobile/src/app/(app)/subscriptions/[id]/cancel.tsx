import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, HelperText, RadioButton, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import {
  IsoDateSchema,
  type CancellationMethod,
  type CancellationStatus,
  type Provider,
  type SubscriptionDetail,
} from '@subtracker/contracts';
import { useToast } from '@/components/toast';
import { ErrorState, Loading, Muted, Screen, SectionTitle } from '@/components/ui';
import { api } from '@/lib/api';
import { CANCELLATION_METHOD_LABELS, CANCELLATION_STATUS_LABELS, formatDate } from '@/lib/format';
import { errorMessage } from '@/lib/http';
import { invalidateSubscriptionData, keys, queryClient } from '@/lib/query';

const GENERIC_INSTRUCTIONS =
  'Cherchez dans votre espace client une rubrique « Abonnement » ou « Résiliation » : les contrats souscrits en ligne doivent en principe pouvoir être résiliés en ligne. À défaut, envoyez une lettre recommandée avec accusé de réception en indiquant vos références client, et conservez la preuve d’envoi.';

const STATUSES: CancellationStatus[] = ['started', 'requested', 'confirmed', 'abandoned'];
const METHODS = Object.keys(CANCELLATION_METHOD_LABELS) as CancellationMethod[];

export default function CancellationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const subscription = useQuery({ queryKey: keys.subscription(id), queryFn: () => api.subscription(id) });
  const slug = subscription.data?.provider?.slug;
  const provider = useQuery({
    queryKey: ['provider', slug],
    queryFn: () => api.provider(slug!),
    enabled: Boolean(slug),
  });

  if (subscription.isLoading || (slug && provider.isLoading)) return <Loading />;
  if (subscription.error || !subscription.data)
    return <ErrorState error={subscription.error} onRetry={subscription.refetch} />;
  return <CancellationForm subscription={subscription.data} provider={provider.data ?? null} />;
}

function CancellationForm({ subscription, provider }: { subscription: SubscriptionDetail; provider: Provider | null }) {
  const id = subscription.id;
  const toast = useToast();
  const current = subscription.cancellation;
  const [status, setStatus] = useState<CancellationStatus>(current?.status ?? 'started');
  const [method, setMethod] = useState<CancellationMethod | null>(
    current?.method ?? provider?.cancellation.method ?? null,
  );
  const [requestedAt, setRequestedAt] = useState(current?.requestedAt ?? '');
  const [effectiveDate, setEffectiveDate] = useState(current?.effectiveDate ?? '');
  const [reference, setReference] = useState(current?.reference ?? '');
  const [notes, setNotes] = useState(current?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const onSaved = (updated: SubscriptionDetail) => {
    queryClient.setQueryData(keys.subscription(id), updated);
    invalidateSubscriptionData(id);
    toast.show('Suivi de résiliation enregistré');
  };
  const save = useMutation({
    mutationFn: () =>
      api.upsertCancellation(id, {
        status,
        method,
        requestedAt: requestedAt.trim() || null,
        effectiveDate: effectiveDate.trim() || null,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      }),
    onSuccess: onSaved,
    onError: (caught) => setError(errorMessage(caught)),
  });
  const clear = useMutation({ mutationFn: () => api.clearCancellation(id), onSuccess: onSaved });
  const procedure = provider?.cancellation;

  const submit = () => {
    for (const value of [requestedAt, effectiveDate]) {
      if (value.trim() && !IsoDateSchema.safeParse(value.trim()).success) return setError('Dates au format AAAA-MM-JJ');
    }
    setError(null);
    save.mutate();
  };

  return (
    <Screen>
      <Card>
        <Card.Title
          title="Comment résilier"
          subtitle={provider?.name ?? subscription.customProviderName ?? 'Fournisseur inconnu'}
        />
        <Card.Content style={{ gap: 8 }}>
          {procedure ? (
            <>
              <Text variant="bodyMedium">{`Méthode : ${CANCELLATION_METHOD_LABELS[procedure.method]}`}</Text>
              <Text variant="bodyMedium">{procedure.instructions}</Text>
              <Muted>
                {procedure.lastVerifiedAt
                  ? `Procédure vérifiée le ${formatDate(procedure.lastVerifiedAt)}. Les parcours changent : en cas de doute, fiez-vous au site officiel.`
                  : 'Procédure non vérifiée : indicative seulement, fiez-vous au site officiel du fournisseur.'}
              </Muted>
            </>
          ) : (
            <Text variant="bodyMedium">{GENERIC_INSTRUCTIONS}</Text>
          )}
        </Card.Content>
        <Card.Actions>
          {procedure?.sourceUrl ? (
            <Button onPress={() => WebBrowser.openBrowserAsync(procedure.sourceUrl!)}>Aide officielle</Button>
          ) : null}
          {procedure?.url ? (
            <Button mode="contained" icon="open-in-new" onPress={() => WebBrowser.openBrowserAsync(procedure.url!)}>
              Ouvrir le parcours officiel
            </Button>
          ) : null}
        </Card.Actions>
      </Card>

      <Muted>
        L’application ne résilie rien à votre place : elle vous aide à suivre la démarche. Une absence de prélèvement ne
        prouve pas qu’une résiliation est effective.
      </Muted>

      <SectionTitle>Suivi de ma démarche</SectionTitle>
      <Card>
        <Card.Content style={{ gap: 8 }}>
          <RadioButton.Group onValueChange={(value) => setStatus(value as CancellationStatus)} value={status}>
            {STATUSES.map((value) => (
              <RadioButton.Item key={value} label={CANCELLATION_STATUS_LABELS[value]} value={value} />
            ))}
          </RadioButton.Group>
          <Muted>Méthode utilisée</Muted>
          <View>
            <SegmentedButtons
              value={method ?? ''}
              onValueChange={(value) => setMethod(value as CancellationMethod)}
              buttons={METHODS.slice(0, 3).map((value) => ({ value, label: CANCELLATION_METHOD_LABELS[value] }))}
              style={{ marginBottom: 6 }}
            />
            <SegmentedButtons
              value={method ?? ''}
              onValueChange={(value) => setMethod(value as CancellationMethod)}
              buttons={METHODS.slice(3).map((value) => ({ value, label: CANCELLATION_METHOD_LABELS[value] }))}
            />
          </View>
          <TextInput
            label="Date de la demande (AAAA-MM-JJ)"
            mode="outlined"
            value={requestedAt}
            onChangeText={setRequestedAt}
          />
          <TextInput
            label="Date d’effet (AAAA-MM-JJ)"
            mode="outlined"
            value={effectiveDate}
            onChangeText={setEffectiveDate}
          />
          <TextInput
            label="Référence / numéro de dossier"
            mode="outlined"
            value={reference}
            onChangeText={setReference}
          />
          <TextInput label="Notes" mode="outlined" value={notes} onChangeText={setNotes} multiline />
          {error ? (
            <HelperText type="error" visible>
              {error}
            </HelperText>
          ) : null}
        </Card.Content>
        <Card.Actions>
          {subscription.cancellation ? (
            <Button onPress={() => clear.mutate()} loading={clear.isPending}>
              Effacer le suivi
            </Button>
          ) : null}
          <Button mode="contained" onPress={submit} loading={save.isPending} disabled={save.isPending}>
            Enregistrer
          </Button>
        </Card.Actions>
      </Card>
    </Screen>
  );
}
