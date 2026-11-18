import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { IsoDateSchema, parseAmountToCents, type SubscriptionDetail } from '@subtracker/contracts';
import { AppButton } from '@/components/AppButton';
import { DateField } from '@/components/DateField';
import { ProviderPicker, type ProviderValue } from '@/components/ProviderPicker';
import { ErrorText, controlStyles, Muted, Panel } from '@/components/ui';
import { centsToInput } from '@/lib/format';
import { currencyOptions } from './currencies';
import { OptionGroup } from './OptionGroup';

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

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel style={formStyles.section}>
      <Text variant="titleMedium" accessibilityRole="header" style={formStyles.sectionTitle}>
        {title}
      </Text>
      {children}
    </Panel>
  );
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
    const validationErrors: Record<string, string> = {};
    if (!label.trim()) validationErrors.label = 'Libellé requis';
    const cents = parseAmountToCents(amount);
    if (cents === null || cents <= 0) validationErrors.amount = 'Montant invalide (ex. 9,99)';
    const day = billingDay.trim() ? Number(billingDay) : null;
    if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) {
      validationErrors.billingDay = 'Jour entre 1 et 31';
    }
    if (nextDueDate && !IsoDateSchema.safeParse(nextDueDate).success) {
      validationErrors.nextDueDate = 'Date invalide';
    }
    setErrors(validationErrors);
    if (cents === null || Object.keys(validationErrors).length > 0) return;
    onSubmit({
      label: label.trim(),
      providerId: provider.provider?.id ?? null,
      customProviderName: provider.provider ? null : provider.customName.trim() || null,
      amountCents: cents,
      currency,
      billingDay: day,
      nextDueDate: nextDueDate || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <View style={formStyles.form}>
      <FormSection title="Abonnement">
        <TextInput
          label="Libellé"
          mode="outlined"
          outlineStyle={controlStyles.fieldOutline}
          value={label}
          onChangeText={setLabel}
          error={Boolean(errors.label)}
        />
        <ErrorText message={errors.label} />
        <ProviderPicker value={provider} onChange={setProvider} />
      </FormSection>

      <FormSection title="Montant mensuel">
        <TextInput
          label="Montant"
          mode="outlined"
          outlineStyle={controlStyles.fieldOutline}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          error={Boolean(errors.amount)}
        />
        <ErrorText message={errors.amount} />
        <Text variant="labelLarge" style={formStyles.fieldLabel}>
          Devise
        </Text>
        <OptionGroup label="Devise" options={currencyOptions(currency)} value={currency} onChange={setCurrency} />
      </FormSection>

      <FormSection title="Échéance (facultatif)">
        <TextInput
          label="Jour de prélèvement (1 à 31)"
          mode="outlined"
          outlineStyle={controlStyles.fieldOutline}
          value={billingDay}
          onChangeText={setBillingDay}
          keyboardType="number-pad"
          maxLength={2}
          error={Boolean(errors.billingDay)}
        />
        <ErrorText message={errors.billingDay} />
        <DateField
          label="Prochaine échéance"
          value={nextDueDate}
          onChange={setNextDueDate}
          clearable
          error={Boolean(errors.nextDueDate)}
        />
        <ErrorText message={errors.nextDueDate} />
        <Muted>Sans échéance fixée, elle est estimée à partir du jour de prélèvement ou du dernier paiement.</Muted>
      </FormSection>

      <FormSection title="Notes (facultatif)">
        <TextInput
          label="Notes"
          mode="outlined"
          outlineStyle={controlStyles.fieldOutline}
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </FormSection>

      <Muted>Les valeurs saisies sont marquées « Déclaré » et ne seront jamais modifiées automatiquement.</Muted>
      <ErrorText message={serverError} />
      <AppButton onPress={submit} loading={submitting}>
        {submitLabel}
      </AppButton>
    </View>
  );
}

const formStyles = StyleSheet.create({
  form: { gap: 16 },
  section: { gap: 4 },
  sectionTitle: { marginBottom: 8 },
  fieldLabel: { marginTop: 8, marginBottom: 4 },
});
