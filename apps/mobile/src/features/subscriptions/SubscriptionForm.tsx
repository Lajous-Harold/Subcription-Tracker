import { useState } from 'react';
import { View } from 'react-native';
import { Button, HelperText, TextInput } from 'react-native-paper';
import { IsoDateSchema, parseAmountToCents, type SubscriptionDetail } from '@subtracker/contracts';
import { ProviderPicker, type ProviderValue } from '@/components/ProviderPicker';
import { FieldError, Muted, SectionTitle } from '@/components/ui';
import { centsToInput } from '@/lib/format';

export interface SubscriptionFormValues {
  label: string;
  providerId: string | null;
  customProviderName: string | null;
  amountCents: number;
  currency: string;
  billingDay: number | null;
  nextDueDate: string | null;
  notes: string | null;
}

interface Props {
  initial?: SubscriptionDetail;
  submitLabel: string;
  submitting: boolean;
  serverError?: string | null;
  onSubmit: (values: SubscriptionFormValues) => void;
}

export function SubscriptionForm({ initial, submitLabel, submitting, serverError, onSubmit }: Props) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [provider, setProvider] = useState<ProviderValue>({
    provider: initial?.provider ?? null,
    customName: initial?.customProviderName ?? '',
  });
  const [amount, setAmount] = useState(initial ? centsToInput(initial.amount.value.cents) : '');
  const [currency, setCurrency] = useState(initial?.amount.value.currency ?? 'EUR');
  const [billingDay, setBillingDay] = useState(initial?.billingDay ? String(initial.billingDay.value) : '');
  const [nextDueDate, setNextDueDate] = useState(
    initial?.nextDueDate?.origin === 'declared' ? initial.nextDueDate.value : '',
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const next: Record<string, string> = {};
    if (!label.trim()) next.label = 'Libellé requis';
    const cents = parseAmountToCents(amount);
    if (cents === null || cents <= 0) next.amount = 'Montant invalide (ex. 9,99)';
    if (!/^[A-Z]{3}$/.test(currency.trim().toUpperCase())) next.currency = 'Code devise à 3 lettres (ex. EUR)';
    const day = billingDay.trim() ? Number(billingDay) : null;
    if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) next.billingDay = 'Jour entre 1 et 31';
    if (nextDueDate.trim() && !IsoDateSchema.safeParse(nextDueDate.trim()).success) {
      next.nextDueDate = 'Date au format AAAA-MM-JJ';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit({
      label: label.trim(),
      providerId: provider.provider?.id ?? null,
      customProviderName: provider.provider ? null : provider.customName.trim() || null,
      amountCents: cents!,
      currency: currency.trim().toUpperCase(),
      billingDay: day,
      nextDueDate: nextDueDate.trim() || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <View style={{ gap: 4 }}>
      <TextInput label="Libellé" mode="outlined" value={label} onChangeText={setLabel} error={Boolean(errors.label)} />
      <FieldError message={errors.label} />
      <SectionTitle>Fournisseur</SectionTitle>
      <ProviderPicker value={provider} onChange={setProvider} />
      <SectionTitle>Montant mensuel</SectionTitle>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          label="Montant"
          mode="outlined"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          error={Boolean(errors.amount)}
          style={{ flex: 2 }}
        />
        <TextInput
          label="Devise"
          mode="outlined"
          value={currency}
          onChangeText={setCurrency}
          autoCapitalize="characters"
          maxLength={3}
          error={Boolean(errors.currency)}
          style={{ flex: 1 }}
        />
      </View>
      <FieldError message={errors.amount ?? errors.currency} />
      <SectionTitle>Échéance (facultatif)</SectionTitle>
      <TextInput
        label="Jour de prélèvement (1 à 31)"
        mode="outlined"
        value={billingDay}
        onChangeText={setBillingDay}
        keyboardType="number-pad"
        maxLength={2}
        error={Boolean(errors.billingDay)}
      />
      <FieldError message={errors.billingDay} />
      <TextInput
        label="Prochaine échéance (AAAA-MM-JJ)"
        mode="outlined"
        value={nextDueDate}
        onChangeText={setNextDueDate}
        placeholder="2026-12-05"
        error={Boolean(errors.nextDueDate)}
      />
      <FieldError message={errors.nextDueDate} />
      <Muted>Sans échéance fixée, elle est estimée à partir du jour de prélèvement ou du dernier paiement.</Muted>
      <TextInput
        label="Notes"
        mode="outlined"
        value={notes}
        onChangeText={setNotes}
        multiline
        style={{ marginTop: 8 }}
      />
      <Muted>Les valeurs saisies sont marquées « Déclaré » et ne seront jamais modifiées automatiquement.</Muted>
      {serverError ? (
        <HelperText type="error" visible>
          {serverError}
        </HelperText>
      ) : null}
      <Button mode="contained" onPress={submit} loading={submitting} disabled={submitting} style={{ marginTop: 12 }}>
        {submitLabel}
      </Button>
    </View>
  );
}
