import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SubmitConceptQuizRequestSchema } from '@insforge/shared-schemas';
import { useEffect } from 'react';
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
    onSuccess: (result) => {
      queryClient.setQueryData(
        ['learning-graph', 'concept', sessionId, conceptId],
        (previous: unknown) => {
          if (!previous || typeof previous !== 'object') {
            return previous;
          }

          return {
            ...previous,
            explanation: result.explanation,
          };
        }
      );
    },
    onError: (error: Error) => {
      showToast(error.message || 'Không thể tạo giải thích lúc này', 'error');
    },
  });

  const revealQuizMutation = useMutation({
    mutationFn: () => learningGraphService.revealQuiz(sessionId!, conceptId!),
    onError: (error: Error) => {
      showToast(error.message || 'Không thể tạo bài kiểm tra lúc này', 'error');
    },
  });

  const submitQuizMutation = useMutation({
    mutationFn: (input: SubmitConceptQuizRequestSchema) =>
      learningGraphService.submitQuiz(sessionId!, conceptId!, input),
    onSuccess: () => {
      revealQuizMutation.reset();
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

  useEffect(() => {
    revealQuizMutation.reset();
  }, [conceptId, revealQuizMutation, sessionId]);

  const conceptLearning = conceptQuery.data
    ? {
        ...conceptQuery.data,
        quiz: conceptQuery.data.quiz ?? revealQuizMutation.data?.quiz ?? null,
      }
    : null;

  return {
    conceptLearning,
    concept: conceptLearning?.concept ?? null,
    mastery: conceptLearning?.mastery ?? null,
    prerequisites: conceptLearning?.prerequisites ?? [],
    graph: graphQuery.data ?? { concepts: [], edges: [] },
    explanation: explanationMutation.data?.explanation ?? conceptLearning?.explanation ?? '',
    activeQuiz: conceptLearning?.quiz ?? null,
    isLoadingConcept: conceptQuery.isLoading,
    isLoadingConceptLearning: conceptQuery.isLoading,
    conceptErrorMessage: conceptQuery.error instanceof Error ? conceptQuery.error.message : null,
    isLoadingGraph: graphQuery.isLoading,
    isGeneratingExplanation: explanationMutation.isPending,
    isGeneratingQuiz: revealQuizMutation.isPending,
    isRevealingQuiz: revealQuizMutation.isPending,
    isSubmittingQuiz: submitQuizMutation.isPending,
    refetchConcept: conceptQuery.refetch,
    refetchGraph: graphQuery.refetch,
    generateExplanation: explanationMutation.mutateAsync,
    revealQuiz: revealQuizMutation.mutateAsync,
    submitQuiz: submitQuizMutation.mutateAsync,
  };
}
