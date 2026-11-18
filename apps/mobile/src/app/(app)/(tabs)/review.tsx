import { ErrorState, Loading } from '@/components/ui';
import { CompactReview } from '@/features/review/CompactReview';
import { useAccountNames, useReviewQueue } from '@/features/review/useReviewQueue';
import { WideReview } from '@/features/review/WideReview';
import { useLayoutMode } from '@/lib/layout';

export default function ReviewScreen() {
  const layoutMode = useLayoutMode();
  const queue = useReviewQueue();
  const accountNames = useAccountNames();
  const { candidatesQuery } = queue;

  if (candidatesQuery.isLoading) return <Loading />;
  if (candidatesQuery.error || !candidatesQuery.data) {
    return <ErrorState error={candidatesQuery.error} onRetry={() => void candidatesQuery.refetch()} />;
  }
  return layoutMode === 'wide' ? (
    <WideReview queue={queue} accountNames={accountNames} />
  ) : (
    <CompactReview queue={queue} accountNames={accountNames} />
  );
}
