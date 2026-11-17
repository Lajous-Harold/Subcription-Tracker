import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Dialog, Portal, TextInput } from 'react-native-paper';
import { IsoDateSchema, parseAmountToCents, todayIso } from '@subtracker/contracts';
import { ErrorText, styles } from '@/components/ui';
import { api } from '@/lib/api';
import { centsToInput } from '@/lib/format';
import { errorMessage } from '@/lib/http';
import { invalidatePaymentData } from '@/lib/query';

export function AddPaymentDialog({
  subscriptionId,
  defaultCents,
  currency,
  visible,
  onDismiss,
}: {
  subscriptionId: string;
  defaultCents: number;
  currency: string;
  visible: boolean;
  onDismiss: () => void;
}) {
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState(centsToInput(defaultCents));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setAmount(centsToInput(defaultCents));
  }

  const addPayment = useMutation({
    mutationFn: (body: { date: string; amountCents: number }) =>
      api.addPayment(subscriptionId, { ...body, currency, note: note.trim() || null }),
    onSuccess: () => {
      invalidatePaymentData(subscriptionId);
      setNote('');
      onDismiss();
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const submit = () => {
    const cents = parseAmountToCents(amount);
    if (!IsoDateSchema.safeParse(date).success) return setError('Date au format AAAA-MM-JJ');
    if (cents === null || cents <= 0) return setError('Montant invalide');
    setError(null);
    addPayment.mutate({ date, amountCents: cents });
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>Ajouter un paiement</Dialog.Title>
        <Dialog.Content style={{ gap: 8 }}>
          <TextInput label="Date (AAAA-MM-JJ)" mode="outlined" value={date} onChangeText={setDate} />
          <TextInput
            label={`Montant (${currency})`}
            mode="outlined"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <TextInput label="Note (facultatif)" mode="outlined" value={note} onChangeText={setNote} />
          <ErrorText message={error} />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Annuler</Button>
          <Button onPress={submit} loading={addPayment.isPending} disabled={addPayment.isPending}>
            Ajouter
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
