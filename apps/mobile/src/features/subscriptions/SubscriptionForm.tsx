import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { IsoDateSchema, parseAmountToCents, type SubscriptionDetail } from '@subtracker/contracts';
import { ProviderPicker, type ProviderValue } from '@/components/ProviderPicker';
import { ErrorText, controlStyles, Muted, Panel } from '@/components/ui';
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
    if (!/^[A-Z]{3}$/.test(currency.trim().toUpperCase())) {
      validationErrors.currency = 'Code devise à 3 lettres (ex. EUR)';
    }
    const day = billingDay.trim() ? Number(billingDay) : null;
    if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) {
      validationErrors.billingDay = 'Jour entre 1 et 31';
    }
    if (nextDueDate.trim() && !IsoDateSchema.safeParse(nextDueDate.trim()).success) {
      validationErrors.nextDueDate = 'Date au format AAAA-MM-JJ';
    }
    setErrors(validationErrors);
    if (cents === null || Object.keys(validationErrors).length > 0) return;
    onSubmit({
      label: label.trim(),
      providerId: provider.provider?.id ?? null,
      customProviderName: provider.provider ? null : provider.customName.trim() || null,
      amountCents: cents,
      currency: currency.trim().toUpperCase(),
      billingDay: day,
      nextDueDate: nextDueDate.trim() || null,
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
        <View style={formStyles.amountRow}>
          <TextInput
            label="Montant"
            mode="outlined"
            outlineStyle={controlStyles.fieldOutline}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            error={Boolean(errors.amount)}
            style={formStyles.amountField}
          />
          <TextInput
            label="Devise"
            mode="outlined"
            outlineStyle={controlStyles.fieldOutline}
            value={currency}
            onChangeText={setCurrency}
            autoCapitalize="characters"
            maxLength={3}
            error={Boolean(errors.currency)}
            style={formStyles.currencyField}
          />
        </View>
        <ErrorText message={errors.amount ?? errors.currency} />
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
        <TextInput
          label="Prochaine échéance (AAAA-MM-JJ)"
          mode="outlined"
          outlineStyle={controlStyles.fieldOutline}
          value={nextDueDate}
          onChangeText={setNextDueDate}
          placeholder="2026-12-05"
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
      <Button
        mode="contained"
        contentStyle={controlStyles.mainAction}
        onPress={submit}
        loading={submitting}
        disabled={submitting}
      >
        {submitLabel}
      </Button>
    </View>
  );
}

const formStyles = StyleSheet.create({
  form: { gap: 16 },
  section: { gap: 4 },
  sectionTitle: { marginBottom: 8 },
  amountRow: { flexDirection: 'row', gap: 8 },
  amountField: { flex: 2 },
  currencyField: { flex: 1 },
});
