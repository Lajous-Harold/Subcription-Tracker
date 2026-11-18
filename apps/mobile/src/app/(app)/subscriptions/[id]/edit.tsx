import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import type { UpdateSubscriptionBody } from '@subtracker/contracts';
import { ErrorState, FormColumn, Loading, Screen } from '@/components/ui';
import { useToast } from '@/components/toast';
import { leaveTo } from '@/features/subscriptions/navigation';
import { SubscriptionForm, type SubscriptionFormValues } from '@/features/subscriptions/SubscriptionForm';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/http';
import { invalidateSubscriptionData, queryKeys } from '@/lib/query';

export default function EditSubscriptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: queryKeys.subscription(id),
    queryFn: () => api.subscription(id),
  });

  const saveChanges = useMutation({
    mutationFn: (values: SubscriptionFormValues) => {
      if (!data) throw new Error('Abonnement non chargé');
      // N'envoie que ce qui change : seuls ces champs passent en « Déclaré ».
      const body: UpdateSubscriptionBody = {};
      if (values.label !== data.label) body.label = values.label;
      if (values.providerId !== (data.provider?.id ?? null)) body.providerId = values.providerId;
      if (!values.providerId && values.customProviderName !== data.customProviderName) {
        body.customProviderName = values.customProviderName;
      }
      if (values.amountCents !== data.amount.value.cents) body.amountCents = values.amountCents;
      if (values.currency !== data.amount.value.currency) body.currency = values.currency;
      if (values.billingDay !== (data.billingDay?.value ?? null)) body.billingDay = values.billingDay;
      const declaredNextDueDate = data.nextDueDate?.origin === 'declared' ? data.nextDueDate.value : null;
      if (values.nextDueDate !== declaredNextDueDate) body.nextDueDate = values.nextDueDate;
      if (values.notes !== data.notes) body.notes = values.notes;
      if (Object.keys(body).length === 0) return Promise.resolve(data);
      return api.updateSubscription(id, body);
    },
    onSuccess: () => {
      invalidateSubscriptionData(id);
      toast.show('Modifications enregistrées');
      leaveTo(`/subscriptions/${id}`);
    },
  });

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <Screen>
      <FormColumn>
        <SubscriptionForm
          initial={data}
          submitLabel="Enregistrer les modifications"
          submitting={saveChanges.isPending}
          serverError={saveChanges.error ? errorMessage(saveChanges.error) : null}
          onSubmit={(values) => saveChanges.mutate(values)}
        />
      </FormColumn>
    </Screen>
  );
}
