import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateLearningSessionRequestSchema } from '@insforge/shared-schemas';
import { learningGraphService } from '../services/learning-graph.service';
import { useToast } from '../../../lib/hooks/useToast';

export function useLearningSessionLibrary() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const libraryQuery = useQuery({
    queryKey: ['learning-graph', 'library'],
    queryFn: () => learningGraphService.listSessions(),
  });

  const createSessionMutation = useMutation({
    mutationFn: (input: CreateLearningSessionRequestSchema) => learningGraphService.createSession(input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['learning-graph', 'library'] });
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
    sessions: libraryQuery.data?.sessions ?? [],
    spotlightSession: libraryQuery.data?.spotlightSession ?? null,
    isLoading: libraryQuery.isLoading,
    error: libraryQuery.error,
    refetch: libraryQuery.refetch,
    createSession: createSessionMutation.mutateAsync,
    isCreatingSession: createSessionMutation.isPending,
  };
}
