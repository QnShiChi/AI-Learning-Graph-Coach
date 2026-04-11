import type { ConceptQuizSchema, SubmitConceptQuizRequestSchema } from '@insforge/shared-schemas';
import { Button } from '@insforge/ui';
import { useEffect, useState } from 'react';

interface ConceptQuizCardProps {
  quiz: ConceptQuizSchema;
  onSubmit: (payload: SubmitConceptQuizRequestSchema) => void | Promise<unknown>;
  isSubmitting: boolean;
  recapSummary?: string | null;
}

export function ConceptQuizCard({
  quiz,
  onSubmit,
  isSubmitting,
  recapSummary = null,
}: ConceptQuizCardProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const hasAnsweredAllQuestions = quiz.questions.every((question) => Boolean(answers[question.id]));

  useEffect(() => {
    setAnswers({});
  }, [quiz.id]);

  return (
    <section className="rounded-[24px] border border-[var(--alpha-8)] bg-card p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Tự kiểm tra
        </p>
        <h2 className="text-xl font-medium text-foreground">Bài kiểm tra ngắn</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Quiz chỉ xuất hiện khi bạn chủ động yêu cầu. Hãy trả lời rồi nộp để cập nhật mastery.
        </p>
      </div>

      {recapSummary ? (
        <div className="mt-4 rounded-2xl bg-[var(--alpha-4)] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Recap gần nhất
          </p>
          <p className="mt-1 text-sm text-foreground">{recapSummary}</p>
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {quiz.questions.map((question, index) => (
          <div key={question.id} className="rounded-[20px] border border-[var(--alpha-8)] p-4">
            <p className="text-sm font-medium text-foreground">
              Câu {index + 1}: {question.prompt}
            </p>
            <div className="mt-3 space-y-2">
              {question.options.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--alpha-8)] px-3 py-2 text-sm text-foreground"
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={option.id}
                    checked={answers[question.id] === option.id}
                    onChange={() =>
                      setAnswers((previous) => ({ ...previous, [question.id]: option.id }))
                    }
                  />
                  <span>{option.text}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        <Button
          type="button"
          onClick={() =>
            void onSubmit({
              quizId: quiz.id,
              answers: quiz.questions.map((question) => ({
                questionId: question.id,
                selectedOptionId: answers[question.id]!,
              })),
            })
          }
          disabled={isSubmitting || !hasAnsweredAllQuestions}
        >
          {isSubmitting ? 'Đang nộp bài...' : 'Nộp bài'}
        </Button>
      </div>
    </section>
  );
}
