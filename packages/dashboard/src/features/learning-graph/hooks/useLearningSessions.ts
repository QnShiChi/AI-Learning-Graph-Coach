import { useQuery } from '@tanstack/react-query';
import type { GetLearningSessionResponseSchema } from '@insforge/shared-schemas';
import { learningGraphService } from '../services/learning-graph.service';

export function useLearningSessions(sessionId?: string) {
  const sessionOverviewQuery = useQuery<GetLearningSessionResponseSchema>({
    queryKey: ['learning-graph', 'session', sessionId],
    queryFn: () => learningGraphService.getSessionOverview(sessionId!),
    enabled: Boolean(sessionId),
  });

  return {
    session: sessionOverviewQuery.data?.session ?? null,
    pathSnapshot: sessionOverviewQuery.data?.pathSnapshot ?? [],
    progress: sessionOverviewQuery.data?.progress ?? { completedCount: 0, totalCount: 0 },
    currentConcept: sessionOverviewQuery.data?.currentConcept ?? null,
    isLoading: sessionOverviewQuery.isLoading,
    error: sessionOverviewQuery.error,
    refetch: sessionOverviewQuery.refetch,
  };
}
