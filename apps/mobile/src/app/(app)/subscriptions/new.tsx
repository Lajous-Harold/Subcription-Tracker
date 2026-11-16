import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Screen } from '@/components/ui';
import { useToast } from '@/components/toast';
import { SubscriptionForm, type SubscriptionFormValues } from '@/features/subscriptions/SubscriptionForm';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/http';
import { invalidateSubscriptionData } from '@/lib/query';

export default function NewSubscriptionScreen() {
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: (values: SubscriptionFormValues) =>
      api.createSubscription({
        label: values.label,
        providerId: values.providerId,
        customProviderName: values.customProviderName,
        amountCents: values.amountCents,
        currency: values.currency,
        billingDay: values.billingDay,
        nextDueDate: values.nextDueDate,
        notes: values.notes,
      }),
    onSuccess: (created) => {
      invalidateSubscriptionData();
      toast.show('Abonnement ajouté');
      router.replace(`/subscriptions/${created.id}`);
    },
  });

  return (
    <Screen>
      <SubscriptionForm
        submitLabel="Ajouter"
        submitting={mutation.isPending}
        serverError={mutation.error ? errorMessage(mutation.error) : null}
        onSubmit={(values) => mutation.mutate(values)}
      />
    </Screen>
  );
}
