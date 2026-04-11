import { Button } from '@insforge/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ConceptExplanationCard,
  ConceptLessonCard,
  ConceptMasteryCard,
  ConceptQuizCard,
  LearningPathPanel,
  VoiceTutorDock,
  VoiceTutorSheet,
} from '../components';
import { useConceptLearning } from '../hooks/useConceptLearning';
import { useLearningSessions } from '../hooks/useLearningSessions';
import { useVoiceTutor } from '../hooks/useVoiceTutor';
import { getVoiceTutorStatusCopy } from '../lib/voice-tutor';

function LockedQuizState() {
  return (
    <section className="rounded-[24px] border border-dashed border-[var(--alpha-8)] bg-[var(--alpha-2)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Quiz locked
          </p>
          <h2 className="text-lg font-medium text-foreground">Bài kiểm tra ngắn</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Quiz vẫn đang được ẩn. Học xong bài chính rồi bấm &quot;Tôi đã hiểu, cho tôi quiz&quot;
            để chuyển sang bước tự kiểm tra.
          </p>
        </div>
        <span className="rounded-full border border-[var(--alpha-8)] px-3 py-1 text-xs text-muted-foreground">
          Chưa mở
        </span>
      </div>
    </section>
  );
}

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
  const quizSectionRef = useRef<HTMLDivElement | null>(null);
  const [shouldScrollToQuiz, setShouldScrollToQuiz] = useState(false);

  const handleRevealQuiz = async () => {
    setShouldScrollToQuiz(true);
    return revealQuiz();
  };

  useEffect(() => {
    if (!shouldScrollToQuiz || !conceptLearning?.quiz) {
      return;
    }

    const timer = window.setTimeout(() => {
      quizSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      setShouldScrollToQuiz(false);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [conceptLearning?.quiz, shouldScrollToQuiz]);

  const voiceTutor = useVoiceTutor({
    sessionId,
    conceptId,
    lessonVersion: conceptLearning?.lessonPackage.version,
    openingText: conceptLearning?.lessonPackage.feynmanExplanation ?? '',
    onConfirmQuiz: handleRevealQuiz,
  });
  const voiceTutorStatus = getVoiceTutorStatusCopy({
    phase: voiceTutor.phase,
    hasError: Boolean(voiceTutor.errorMessage),
  });

  const learningPathPanel = (
    <LearningPathPanel
      items={pathItems}
      onSelect={(nextConceptId) =>
        navigate(`/dashboard/learning-graph/sessions/${sessionId ?? ''}/concepts/${nextConceptId}`)
      }
    />
  );

  const lessonWorkspace = isLoadingConceptLearning ? (
    <section className="rounded-[24px] border border-[var(--alpha-8)] bg-card p-5">
      <p className="text-sm text-muted-foreground">Đang tải dữ liệu khái niệm...</p>
    </section>
  ) : !conceptLearning ? (
    <section className="rounded-[24px] border border-[var(--alpha-8)] bg-card p-5">
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
    <ConceptLessonCard
      conceptName={conceptLearning.concept.displayName}
      lesson={conceptLearning.lessonPackage}
      recapSummary={conceptLearning.recap?.summary ?? null}
      onRevealQuiz={handleRevealQuiz}
      onRegenerateExplanation={generateExplanation}
      isRevealingQuiz={isRevealingQuiz}
      isRegeneratingExplanation={isGeneratingExplanation}
    />
  );

  const studyFlowSections = conceptLearning ? (
    <div className="space-y-6">
      <ConceptExplanationCard
        explanation={explanation}
        prerequisites={conceptLearning.prerequisites.map((item) => item.displayName)}
        onGenerate={generateExplanation}
        isLoading={isGeneratingExplanation}
      />

      <div ref={quizSectionRef}>
        {conceptLearning.quiz ? (
          <ConceptQuizCard
            quiz={conceptLearning.quiz}
            onSubmit={submitQuiz}
            isSubmitting={isSubmittingQuiz}
            recapSummary={conceptLearning.recap?.summary ?? null}
          />
        ) : (
          <LockedQuizState />
        )}
      </div>

      <ConceptMasteryCard
        masteryScore={conceptLearning.mastery?.masteryScore ?? 0}
        attemptCount={conceptLearning.mastery?.attemptCount ?? 0}
      />
    </div>
  ) : null;

  return (
    <div className="space-y-8">
      <section className="border-b border-[var(--alpha-8)] pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Learning Workspace
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">
              {concept?.displayName ?? 'Đang tải khái niệm...'}
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {pathSnapshot.filter((item) => item.pathState === 'completed').length}/{pathSnapshot.length} khái niệm đã hoàn thành
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
      </section>

      <div className="space-y-6 xl:hidden">
        <section>{lessonWorkspace}</section>
        <section>{studyFlowSections}</section>
        <section>{learningPathPanel}</section>
      </div>

      <div className="hidden xl:grid xl:grid-cols-[220px_minmax(0,1fr)] xl:items-start xl:gap-8 2xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="sticky top-6 self-start">
          {learningPathPanel}
        </aside>

        <main className="min-w-0 space-y-8">
          {lessonWorkspace}
          {studyFlowSections}
        </main>
      </div>

      {!isLoadingConceptLearning && conceptLearning ? (
        <>
          <VoiceTutorDock badge={voiceTutorStatus.badge} onOpen={() => voiceTutor.setIsOpen(true)} />
          <VoiceTutorSheet
            open={voiceTutor.isOpen}
            onOpenChange={voiceTutor.setIsOpen}
            badge={voiceTutorStatus.badge}
            helperText={voiceTutorStatus.helper}
            conceptName={conceptLearning.concept.displayName}
            openingText={conceptLearning.lessonPackage.feynmanExplanation}
            currentLearnerTranscript={voiceTutor.currentLearnerTranscript}
            pendingLearnerTranscript={voiceTutor.pendingLearnerTranscript}
            liveAssistantTranscript={voiceTutor.liveAssistantTranscript}
            historyTurns={voiceTutor.historyTurns}
            manualQuestion={voiceTutor.manualQuestion}
            onManualQuestionChange={voiceTutor.setManualQuestion}
            errorMessage={voiceTutor.errorMessage}
            isLoadingHistory={voiceTutor.isLoadingHistory}
            isRecording={voiceTutor.isRecording}
            isSubmittingTurn={voiceTutor.isSubmittingTurn}
            isProcessing={voiceTutor.isProcessing}
            isAssistantTyping={voiceTutor.isAssistantTyping}
            canReplayAudio={voiceTutor.canReplayAudio}
            quizSuggestionVisible={voiceTutor.quizSuggestionVisible}
            onRequestOpening={voiceTutor.requestOpening}
            onStartRecording={voiceTutor.startRecording}
            onStopRecording={voiceTutor.stopRecording}
            onSendManualQuestion={voiceTutor.sendManualQuestion}
            onReplayLastAudio={voiceTutor.replayLastAudio}
            onConfirmQuizSuggestion={voiceTutor.confirmQuizSuggestion}
            onDismissQuizSuggestion={voiceTutor.dismissQuizSuggestion}
          />
        </>
      ) : null}
    </div>
  );
}
