import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FormColumn, Screen } from '@/components/ui';
import { useToast } from '@/components/toast';
import { SubscriptionForm, type SubscriptionFormValues } from '@/features/subscriptions/SubscriptionForm';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/http';
import { invalidateSubscriptionData } from '@/lib/query';

export default function NewSubscriptionScreen() {
  const toast = useToast();
  const createSubscription = useMutation({
    mutationFn: (values: SubscriptionFormValues) => api.createSubscription(values),
    onSuccess: (created) => {
      invalidateSubscriptionData();
      toast.show('Abonnement ajouté');
      router.replace(`/subscriptions/${created.id}`);
    },
  });

  return (
    <Screen>
      <FormColumn>
        <SubscriptionForm
          submitLabel="Ajouter l’abonnement"
          submitting={createSubscription.isPending}
          serverError={createSubscription.error ? errorMessage(createSubscription.error) : null}
          onSubmit={(values) => createSubscription.mutate(values)}
        />
      </FormColumn>
    </Screen>
  );
}
