import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SubmitConceptQuizRequestSchema } from '@insforge/shared-schemas';
import { learningGraphService } from '../services/learning-graph.service';
import { useToast } from '../../../lib/hooks/useToast';

export function useConceptLearning(sessionId?: string, conceptId?: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const conceptQuery = useQuery({
    queryKey: ['learning-graph', 'concept', sessionId, conceptId],
    queryFn: () => learningGraphService.getConceptLearning(sessionId!, conceptId!),
    enabled: Boolean(sessionId && conceptId),
  });

  const graphQuery = useQuery({
    queryKey: ['learning-graph', 'graph', sessionId],
    queryFn: () => learningGraphService.getGraph(sessionId!),
    enabled: Boolean(sessionId),
  });

  const explanationMutation = useMutation({
    mutationFn: () => learningGraphService.generateExplanation(sessionId!, conceptId!),
    onError: (error: Error) => {
      showToast(error.message || 'Khong the tao giai thich luc nay', 'error');
    },
  });

  const quizMutation = useMutation({
    mutationFn: () => learningGraphService.getOrCreateQuiz(sessionId!, conceptId!),
    onError: (error: Error) => {
      showToast(error.message || 'Khong the tao bai kiem tra luc nay', 'error');
    },
  });

  const submitQuizMutation = useMutation({
    mutationFn: (input: SubmitConceptQuizRequestSchema) =>
      learningGraphService.submitQuiz(sessionId!, conceptId!, input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['learning-graph', 'concept', sessionId, conceptId] });
      void queryClient.invalidateQueries({ queryKey: ['learning-graph', 'graph', sessionId] });
      queryClient.setQueryData(['learning-graph', 'session', sessionId], (previous: any) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          pathSnapshot: result.pathSnapshot,
          currentConcept: result.nextConcept,
          progress: {
            completedCount: result.pathSnapshot.filter((item) => item.pathState === 'completed').length,
            totalCount: result.pathSnapshot.length,
          },
        };
      });
      showToast('Da cap nhat tien do hoc tap', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Khong the nop bai kiem tra', 'error');
    },
  });

  return {
    concept: conceptQuery.data?.concept ?? null,
    mastery: conceptQuery.data?.mastery ?? null,
    prerequisites: conceptQuery.data?.prerequisites ?? [],
    graph: graphQuery.data ?? { concepts: [], edges: [] },
    explanation: explanationMutation.data?.explanation ?? '',
    activeQuiz: quizMutation.data?.quiz ?? null,
    isLoadingConcept: conceptQuery.isLoading,
    isLoadingGraph: graphQuery.isLoading,
    isGeneratingExplanation: explanationMutation.isPending,
    isGeneratingQuiz: quizMutation.isPending,
    isSubmittingQuiz: submitQuizMutation.isPending,
    refetchConcept: conceptQuery.refetch,
    refetchGraph: graphQuery.refetch,
    generateExplanation: explanationMutation.mutateAsync,
    getOrCreateQuiz: quizMutation.mutateAsync,
    submitQuiz: submitQuizMutation.mutateAsync,
  };
}
