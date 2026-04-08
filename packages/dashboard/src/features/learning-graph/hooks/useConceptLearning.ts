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
      showToast(error.message || 'Không thể tạo giải thích lúc này', 'error');
    },
  });

  const quizMutation = useMutation({
    mutationFn: () => learningGraphService.getOrCreateQuiz(sessionId!, conceptId!),
    onError: (error: Error) => {
      showToast(error.message || 'Không thể tạo bài kiểm tra lúc này', 'error');
    },
  });

  const submitQuizMutation = useMutation({
    mutationFn: (input: SubmitConceptQuizRequestSchema) =>
      learningGraphService.submitQuiz(sessionId!, conceptId!, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['learning-graph', 'concept', sessionId, conceptId] });
      void queryClient.invalidateQueries({ queryKey: ['learning-graph', 'graph', sessionId] });
      void queryClient.invalidateQueries({ queryKey: ['learning-graph', 'library'] });
      void queryClient.invalidateQueries({ queryKey: ['learning-graph', 'session', sessionId] });
      showToast('Đã cập nhật tiến độ học tập', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Không thể nộp bài kiểm tra', 'error');
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
