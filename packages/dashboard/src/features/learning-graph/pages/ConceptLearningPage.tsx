import { Button } from '@insforge/ui';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ConceptExplanationCard,
  ConceptLessonCard,
  ConceptMasteryCard,
  ConceptQuizCard,
  LearningPathPanel,
} from '../components';
import { useConceptLearning } from '../hooks/useConceptLearning';
import { useLearningSessions } from '../hooks/useLearningSessions';

export default function ConceptLearningPage() {
  const navigate = useNavigate();
  const params = useParams<{ sessionId: string; conceptId: string }>();
  const sessionId = params.sessionId;
  const conceptId = params.conceptId;

  const { pathSnapshot, session } = useLearningSessions(sessionId);
  const {
    conceptLearning,
    concept,
    conceptErrorMessage,
    explanation,
    isLoadingConceptLearning,
    isGeneratingExplanation,
    isRevealingQuiz,
    isSubmittingQuiz,
    generateExplanation,
    revealQuiz,
    refetchConcept,
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
            Học theo bài học chính trước, chỉ mở quiz khi bạn thực sự muốn tự kiểm tra.
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
          {isLoadingConceptLearning ? (
            <section className="rounded-lg border border-[var(--alpha-8)] bg-card p-5">
              <p className="text-sm text-muted-foreground">Đang tải dữ liệu khái niệm...</p>
            </section>
          ) : !conceptLearning ? (
            <section className="rounded-lg border border-[var(--alpha-8)] bg-card p-5">
              <h2 className="text-lg font-medium text-foreground">Không tải được khái niệm</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {conceptErrorMessage ?? 'Đã có lỗi khi tải dữ liệu học tập cho khái niệm này.'}
              </p>
              <div className="mt-4">
                <Button type="button" variant="outline" onClick={() => void refetchConcept()}>
                  Thử tải lại
                </Button>
              </div>
            </section>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
              <ConceptLessonCard
                lesson={conceptLearning.lessonPackage}
                onRevealQuiz={revealQuiz}
                isRevealingQuiz={isRevealingQuiz}
              />

              <div className="space-y-6">
                <ConceptMasteryCard
                  masteryScore={conceptLearning.mastery?.masteryScore ?? 0}
                  attemptCount={conceptLearning.mastery?.attemptCount ?? 0}
                  recapSummary={conceptLearning.recap?.summary ?? null}
                />

                <ConceptExplanationCard
                  explanation={explanation}
                  prerequisites={conceptLearning.prerequisites.map((item) => item.displayName)}
                  onGenerate={generateExplanation}
                  isLoading={isGeneratingExplanation}
                />

                {conceptLearning.quiz ? (
                  <ConceptQuizCard
                    quiz={conceptLearning.quiz}
                    onSubmit={submitQuiz}
                    isSubmitting={isSubmittingQuiz}
                    recapSummary={conceptLearning.recap?.summary ?? null}
                  />
                ) : (
                  <section className="rounded-lg border border-dashed border-[var(--alpha-8)] bg-card p-5">
                    <h2 className="text-lg font-medium text-foreground">Bài kiểm tra ngắn</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Quiz vẫn đang được ẩn. Hãy học xong bài học chính rồi bấm
                      {' '}
                      &quot;Tôi đã hiểu, cho tôi quiz&quot;
                      {' '}
                      để mở bài kiểm tra.
                    </p>
                  </section>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
