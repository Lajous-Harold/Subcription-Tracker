import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, Chip, Text, useTheme } from 'react-native-paper';
import type { Candidate } from '@subtracker/contracts';
import { useToast } from '@/components/toast';
import { EmptyState, ErrorState, Loading, Muted, Screen, styles } from '@/components/ui';
import { api } from '@/lib/api';
import { CONFIDENCE_LABELS, formatDate, formatMoney } from '@/lib/format';
import { errorMessage } from '@/lib/http';
import { invalidateDetectionData, keys } from '@/lib/query';

function CandidateCard({ candidate }: { candidate: Candidate }) {
  const toast = useToast();
  const theme = useTheme();
  const accept = useMutation({
    mutationFn: () =>
      api.acceptCandidate(
        candidate.id,
        candidate.suggestedSubscriptionId ? { mergeIntoSubscriptionId: candidate.suggestedSubscriptionId } : {},
      ),
    onSuccess: (sub) => {
      invalidateDetectionData();
      toast.show(`« ${sub.label} » ajouté à vos abonnements`);
    },
    onError: (error) => toast.show(errorMessage(error)),
  });
  const reject = useMutation({
    mutationFn: () => api.rejectCandidate(candidate.id),
    onSuccess: () => {
      invalidateDetectionData();
      toast.show('Rejeté : il ne sera plus proposé');
    },
    onError: (error) => toast.show(errorMessage(error)),
  });
  const levelColor =
    candidate.level === 'high'
      ? theme.colors.primaryContainer
      : candidate.level === 'medium'
        ? theme.colors.secondaryContainer
        : theme.colors.errorContainer;

  return (
    <Card>
      <Card.Title
        title={candidate.label}
        subtitle={`${candidate.occurrences} paiements · tous les ~${Math.round(candidate.intervalDays)} jours${candidate.provider ? '' : ' · fournisseur non reconnu'}`}
        right={() => (
          <Text variant="titleMedium" style={{ marginRight: 16 }}>
            {formatMoney(candidate.amount.lastCents, candidate.currency)}
          </Text>
        )}
      />
      <Card.Content style={{ gap: 6 }}>
        <View style={styles.row}>
          <Chip compact style={{ backgroundColor: levelColor }}>
            {`${CONFIDENCE_LABELS[candidate.level]} (${Math.round(candidate.confidence * 100)} %)`}
          </Chip>
          {candidate.stale ? (
            <Chip compact icon="alert-outline">
              Peut-être terminé
            </Chip>
          ) : null}
        </View>
        {candidate.reasons.map((reason) => (
          <Muted key={reason}>{`• ${reason}`}</Muted>
        ))}
        <Muted>{`${candidate.stale ? 'Échéance attendue' : 'Prochaine échéance estimée'} : ${formatDate(candidate.nextDueDate)}`}</Muted>
        {candidate.suggestedSubscriptionId ? (
          <Muted>
            Vous suivez déjà un abonnement chez ce fournisseur : « Confirmer » le complètera avec ces paiements.
          </Muted>
        ) : null}
      </Card.Content>
      <Card.Actions>
        <Button onPress={() => reject.mutate()} disabled={reject.isPending || accept.isPending}>
          Ce n’est pas un abonnement
        </Button>
        <Button onPress={() => router.push(`/candidates/${candidate.id}`)}>Corriger</Button>
        <Button mode="contained" onPress={() => accept.mutate()} loading={accept.isPending} disabled={accept.isPending}>
          Confirmer
        </Button>
      </Card.Actions>
    </Card>
  );
}

export default function CandidatesScreen() {
  const toast = useToast();
  const { data, error, isLoading, refetch, isRefetching } = useQuery({
    queryKey: keys.candidates,
    queryFn: () => api.candidates('pending'),
  });
  const rerun = useMutation({
    mutationFn: api.runDetection,
    onSuccess: (result) => {
      invalidateDetectionData();
      toast.show(`${result.analyzedTransactions} opérations analysées, ${result.created} nouvelle(s) détection(s)`);
    },
    onError: (caught) => toast.show(errorMessage(caught)),
  });

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <Muted>
        Paiements mensuels récurrents repérés dans vos opérations. Confirmez, corrigez ou rejetez : rien n’est ajouté
        sans votre accord. La détection n’est pas exhaustive.
      </Muted>
      {data.length === 0 ? (
        <Card>
          <EmptyState
            title="Rien à vérifier"
            description="Les nouvelles détections apparaîtront ici après chaque synchronisation."
          >
            <Button mode="outlined" icon="refresh" onPress={() => rerun.mutate()} loading={rerun.isPending}>
              Relancer la détection
            </Button>
          </EmptyState>
        </Card>
      ) : (
        data.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} />)
      )}
    </Screen>
  );
}
