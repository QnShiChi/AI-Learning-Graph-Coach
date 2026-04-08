import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateLearningSessionRequestSchema,
  GetLearningSessionResponseSchema,
} from '@insforge/shared-schemas';
import { learningGraphService } from '../services/learning-graph.service';
import { useToast } from '../../../lib/hooks/useToast';

export function useLearningSessions(sessionId?: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const sessionOverviewQuery = useQuery<GetLearningSessionResponseSchema>({
    queryKey: ['learning-graph', 'session', sessionId],
    queryFn: () => learningGraphService.getSessionOverview(sessionId!),
    enabled: Boolean(sessionId),
  });

  const createSessionMutation = useMutation({
    mutationFn: (input: CreateLearningSessionRequestSchema) => learningGraphService.createSession(input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['learning-graph', 'session'] });
      queryClient.setQueryData(['learning-graph', 'session', result.session.id], {
        session: result.session,
        pathSnapshot: result.pathSnapshot,
        progress: {
          completedCount: result.pathSnapshot.filter((item) => item.pathState === 'completed').length,
          totalCount: result.pathSnapshot.length,
        },
        currentConcept: result.currentConcept,
      });
      showToast('Đã tạo phiên học thành công', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Không thể tạo phiên học', 'error');
    },
  });

  return {
    session: sessionOverviewQuery.data?.session ?? null,
    pathSnapshot: sessionOverviewQuery.data?.pathSnapshot ?? [],
    progress: sessionOverviewQuery.data?.progress ?? { completedCount: 0, totalCount: 0 },
    currentConcept: sessionOverviewQuery.data?.currentConcept ?? null,
    isLoading: sessionOverviewQuery.isLoading,
    error: sessionOverviewQuery.error,
    refetch: sessionOverviewQuery.refetch,
    createSession: createSessionMutation.mutateAsync,
    isCreatingSession: createSessionMutation.isPending,
  };
}
