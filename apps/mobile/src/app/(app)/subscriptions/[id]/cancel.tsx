import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import {
  IsoDateSchema,
  type CancellationMethod,
  type CancellationStatus,
  type Provider,
  type SubscriptionDetail,
} from '@subtracker/contracts';
import { useToast } from '@/components/toast';
import { ErrorState, ErrorText, controlStyles, Loading, Muted, Panel, Screen } from '@/components/ui';
import { CancellationProcedure, useSubscriptionProvider } from '@/features/subscriptions/cancellation';
import { OptionGroup, type Option } from '@/features/subscriptions/OptionGroup';
import { api } from '@/lib/api';
import { CANCELLATION_METHOD_LABELS, CANCELLATION_STATUS_LABELS, formatDate } from '@/lib/format';
import { errorMessage } from '@/lib/http';
import { queryKeys, storeUpdatedSubscription } from '@/lib/query';
import { useBrand } from '@/lib/theme';

const STATUS_OPTIONS: Option<CancellationStatus>[] = (['started', 'requested', 'confirmed', 'abandoned'] as const).map(
  (status) => ({ value: status, label: CANCELLATION_STATUS_LABELS[status] }),
);
const METHOD_OPTIONS = (Object.keys(CANCELLATION_METHOD_LABELS) as CancellationMethod[]).map(
  (method): Option<CancellationMethod> => ({ value: method, label: CANCELLATION_METHOD_LABELS[method] }),
);

export default function CancellationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const subscription = useQuery({ queryKey: queryKeys.subscription(id), queryFn: () => api.subscription(id) });
  const provider = useSubscriptionProvider(subscription.data);

  if (subscription.isLoading || provider.isLoading) return <Loading />;
  if (subscription.error || !subscription.data)
    return <ErrorState error={subscription.error} onRetry={subscription.refetch} />;
  return <CancellationForm subscription={subscription.data} provider={provider.data ?? null} />;
}

function verificationNotice(provider: Provider | null): string {
  const verifiedAt = provider?.cancellation.lastVerifiedAt;
  if (!provider) return 'Fournisseur hors catalogue : adaptez ces étapes à votre contrat.';
  if (verifiedAt) {
    return `Dernière vérification le ${formatDate(verifiedAt)}. Les parcours changent : en cas de doute, fiez-vous au site officiel.`;
  }
  return 'Indicative seulement : fiez-vous au site officiel du fournisseur.';
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Text variant="labelLarge" style={formStyles.fieldLabel}>
      {children}
    </Text>
  );
}

function CancellationForm({ subscription, provider }: { subscription: SubscriptionDetail; provider: Provider | null }) {
  const id = subscription.id;
  const toast = useToast();
  const brand = useBrand();
  const tracked = subscription.cancellation;
  const [status, setStatus] = useState<CancellationStatus>(tracked?.status ?? 'started');
  const [method, setMethod] = useState<CancellationMethod | null>(
    tracked?.method ?? provider?.cancellation.method ?? null,
  );
  const [requestedAt, setRequestedAt] = useState(tracked?.requestedAt ?? '');
  const [effectiveDate, setEffectiveDate] = useState(tracked?.effectiveDate ?? '');
  const [reference, setReference] = useState(tracked?.reference ?? '');
  const [notes, setNotes] = useState(tracked?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const onSaved = (updated: SubscriptionDetail) => {
    storeUpdatedSubscription(updated);
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
  const clear = useMutation({
    mutationFn: () => api.clearCancellation(id),
    onSuccess: onSaved,
    onError: toast.showError,
  });

  const submit = () => {
    for (const value of [requestedAt, effectiveDate]) {
      if (value.trim() && !IsoDateSchema.safeParse(value.trim()).success) return setError('Dates au format AAAA-MM-JJ');
    }
    setError(null);
    save.mutate();
  };

  return (
    <Screen>
      <Panel>
        <CancellationProcedure
          provider={provider}
          title={`Résilier ${provider?.name ?? subscription.customProviderName ?? subscription.label}`}
          showHelpLink
        />
        <Muted>{verificationNotice(provider)}</Muted>
      </Panel>

      <Muted>
        L’application ne résilie rien à votre place : elle vous aide à suivre la démarche. Une absence de prélèvement ne
        prouve pas qu’une résiliation est effective.
      </Muted>

      <Panel>
        <Text variant="titleLarge" accessibilityRole="header">
          Où en êtes-vous ?
        </Text>
        <OptionGroup label="État de la démarche" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
        <FieldLabel>Méthode utilisée</FieldLabel>
        <OptionGroup label="Méthode utilisée" options={METHOD_OPTIONS} value={method} onChange={setMethod} />
        <FieldLabel>Détails de la demande</FieldLabel>
        <TextInput
          label="Date de la demande (AAAA-MM-JJ)"
          mode="outlined"
          outlineStyle={controlStyles.fieldOutline}
          value={requestedAt}
          onChangeText={setRequestedAt}
        />
        <TextInput
          label="Date d’effet (AAAA-MM-JJ)"
          mode="outlined"
          outlineStyle={controlStyles.fieldOutline}
          value={effectiveDate}
          onChangeText={setEffectiveDate}
        />
        <TextInput
          label="Référence ou numéro de dossier"
          mode="outlined"
          outlineStyle={controlStyles.fieldOutline}
          value={reference}
          onChangeText={setReference}
        />
        <TextInput
          label="Notes"
          mode="outlined"
          outlineStyle={controlStyles.fieldOutline}
          value={notes}
          onChangeText={setNotes}
          multiline
        />
        <ErrorText message={error} />
        <View style={formStyles.actions}>
          {tracked ? (
            <Button
              mode="outlined"
              textColor={brand.colors.destructive}
              contentStyle={controlStyles.mainAction}
              style={formStyles.action}
              onPress={() => clear.mutate()}
              loading={clear.isPending}
              disabled={clear.isPending}
            >
              Effacer le suivi
            </Button>
          ) : null}
          <Button
            mode="contained"
            contentStyle={controlStyles.mainAction}
            style={formStyles.action}
            onPress={submit}
            loading={save.isPending}
            disabled={save.isPending}
          >
            Enregistrer le suivi
          </Button>
        </View>
      </Panel>
    </Screen>
  );
}

const formStyles = StyleSheet.create({
  fieldLabel: { marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { flexGrow: 1 },
});
