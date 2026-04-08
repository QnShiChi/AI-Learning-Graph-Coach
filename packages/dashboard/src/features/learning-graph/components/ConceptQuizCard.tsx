import { Button } from '@insforge/ui';
import { useEffect, useState } from 'react';

interface ConceptQuizCardProps {
  quizId?: string;
  questions: Array<{ id: string; prompt: string; options: Array<{ id: string; text: string }> }>;
  onGenerate: () => void | Promise<unknown>;
  onSubmit: (
    payload: {
      quizId: string;
      answers: Array<{ questionId: string; selectedOptionId: string }>;
    }
  ) => void | Promise<unknown>;
  isGenerating: boolean;
  isSubmitting: boolean;
}

export function ConceptQuizCard({
  quizId,
  questions,
  onGenerate,
  onSubmit,
  isGenerating,
  isSubmitting,
}: ConceptQuizCardProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    setAnswers({});
  }, [quizId]);

  return (
    <section className="rounded-lg border border-[var(--alpha-8)] bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-foreground">Bài kiểm tra ngắn</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Mỗi khái niệm có một bài quiz ngắn để cập nhật mastery.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void onGenerate()}>
          {isGenerating ? 'Đang tạo...' : 'Tạo bài quiz'}
        </Button>
      </div>

      {questions.length === 0 || !quizId ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Chưa có bài quiz. Bấm nút bên trên để tạo bài kiểm tra cho khái niệm này.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {questions.map((question, index) => (
            <div key={question.id} className="rounded-md border border-[var(--alpha-8)] p-4">
              <p className="text-sm font-medium text-foreground">
                Câu {index + 1}: {question.prompt}
              </p>
              <div className="mt-3 space-y-2">
                {question.options.map((option) => (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--alpha-8)] px-3 py-2 text-sm text-foreground"
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
                quizId,
                answers: questions.map((question) => ({
                  questionId: question.id,
                  selectedOptionId: answers[question.id] ?? question.options[0]?.id ?? '',
                })),
              })
            }
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Đang nộp bài...' : 'Nộp bài'}
          </Button>
        </div>
      )}
    </section>
  );
}
