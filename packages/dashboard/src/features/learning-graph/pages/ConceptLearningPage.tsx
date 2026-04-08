import { Button } from '@insforge/ui';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConceptExplanationCard, ConceptQuizCard, LearningPathPanel } from '../components';
import { useConceptLearning } from '../hooks/useConceptLearning';
import { useLearningSessions } from '../hooks/useLearningSessions';

export default function ConceptLearningPage() {
  const navigate = useNavigate();
  const params = useParams<{ sessionId: string; conceptId: string }>();
  const sessionId = params.sessionId;
  const conceptId = params.conceptId;

  const { pathSnapshot, session } = useLearningSessions(sessionId);
  const {
    concept,
    mastery,
    prerequisites,
    graph,
    explanation,
    activeQuiz,
    isLoadingConcept,
    isGeneratingExplanation,
    isGeneratingQuiz,
    isSubmittingQuiz,
    generateExplanation,
    getOrCreateQuiz,
    submitQuiz,
  } = useConceptLearning(sessionId, conceptId);

  const pathItems = useMemo(
    () =>
      pathSnapshot.map((item) => ({
        conceptId: item.conceptId,
        label: item.conceptId === concept?.id ? concept.displayName : `Concept ${item.position + 1}`,
        pathState: item.pathState,
      })),
    [concept?.displayName, concept?.id, pathSnapshot]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-medium text-foreground">
            {concept?.displayName ?? 'Đang tải khái niệm...'}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Học theo vòng lặp: đọc giải thích, làm quiz, cập nhật mastery, rồi sang khái niệm tiếp theo.
          </p>
        </div>
        <div className="flex gap-3">
          {session ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/dashboard/learning-graph/sessions/${session.id}/overview`)}
            >
              Về tổng quan
            </Button>
          ) : null}
          {session ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/dashboard/learning-graph/sessions/${session.id}/graph`)}
            >
              Xem đồ thị
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <LearningPathPanel
          items={pathItems}
          onSelect={(nextConceptId) =>
            navigate(`/dashboard/learning-graph/sessions/${sessionId ?? ''}/concepts/${nextConceptId}`)
          }
        />

        <div className="space-y-6">
          <section className="rounded-lg border border-[var(--alpha-8)] bg-card p-5">
            <h2 className="text-lg font-medium text-foreground">Trạng thái học tập</h2>
            {isLoadingConcept ? (
              <p className="mt-3 text-sm text-muted-foreground">Đang tải dữ liệu khái niệm...</p>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-md bg-[var(--alpha-4)] p-4">
                  <p className="text-xs text-muted-foreground">Mức độ thành thạo</p>
                  <p className="mt-1 text-lg font-medium text-foreground">
                    {Math.round((mastery?.masteryScore ?? 0) * 100)}%
                  </p>
                </div>
                <div className="rounded-md bg-[var(--alpha-4)] p-4">
                  <p className="text-xs text-muted-foreground">Số lần quiz</p>
                  <p className="mt-1 text-lg font-medium text-foreground">
                    {mastery?.attemptCount ?? 0}
                  </p>
                </div>
                <div className="rounded-md bg-[var(--alpha-4)] p-4">
                  <p className="text-xs text-muted-foreground">Số cạnh đồ thị</p>
                  <p className="mt-1 text-lg font-medium text-foreground">{graph.edges.length}</p>
                </div>
              </div>
            )}
          </section>

          <ConceptExplanationCard
            title="Giải thích khái niệm"
            explanation={explanation || concept?.description || ''}
            prerequisites={prerequisites.map((item) => item.displayName)}
            onGenerate={generateExplanation}
            isLoading={isGeneratingExplanation}
          />

          <ConceptQuizCard
            quizId={activeQuiz?.id}
            questions={activeQuiz?.questions ?? []}
            onGenerate={getOrCreateQuiz}
            onSubmit={submitQuiz}
            isGenerating={isGeneratingQuiz}
            isSubmitting={isSubmittingQuiz}
          />
        </div>
      </div>
    </div>
  );
}
