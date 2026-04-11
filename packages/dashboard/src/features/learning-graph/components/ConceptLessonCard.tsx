import { Button } from '@insforge/ui';
import { buildConceptLessonSections } from '../lib/concept-lesson-content';
import type { LessonPackagePayload } from '../services/learning-graph.service';

interface ConceptLessonCardProps {
  conceptName: string;
  lesson: LessonPackagePayload;
  easyExplanation: string;
  recapSummary?: string | null;
  onRevealQuiz: () => void | Promise<unknown>;
  onRequestEasyExplanation: () => void | Promise<unknown>;
  isRevealingQuiz: boolean;
  isGeneratingEasyExplanation?: boolean;
}

export function ConceptLessonCard({
  conceptName,
  lesson,
  easyExplanation,
  recapSummary = null,
  onRevealQuiz,
  onRequestEasyExplanation,
  isRevealingQuiz,
  isGeneratingEasyExplanation = false,
}: ConceptLessonCardProps) {
  const sections = buildConceptLessonSections(lesson.mainLesson);

  return (
    <article className="w-full space-y-10 px-1 pb-10">
      <header className="space-y-5 border-b border-[var(--alpha-8)] pb-8">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Khái niệm cốt lõi
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">{conceptName}</h2>
        </div>
      </header>

      {sections.map((section, index) => (
        <section key={`${section.title}-${index}`} className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Bài học chính
            </p>
            <h3 className="text-2xl font-semibold text-foreground">{section.title}</h3>
          </div>

          {section.paragraphs?.length ? (
            <div className="space-y-4 text-[17px] leading-8 text-foreground">
              {section.paragraphs.map((paragraph, paragraphIndex) => (
                <p key={`${section.title}-paragraph-${paragraphIndex}`}>{paragraph}</p>
              ))}
            </div>
          ) : null}

          {section.bullets?.length ? (
            <div className="space-y-3">
              {section.bullets.map((bullet, bulletIndex) => (
                <div
                  key={`${section.title}-bullet-${bulletIndex}`}
                  className="rounded-[20px] border border-[var(--alpha-8)] bg-[var(--alpha-2)] px-4 py-4"
                >
                  <p className="text-base leading-7 text-foreground">{bullet}</p>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ))}

      <section className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Củng cố thêm
          </p>
          <h3 className="text-2xl font-semibold text-foreground">Ôn nhanh điều kiện tiên quyết</h3>
        </div>
        {lesson.prerequisiteMiniLessons.length > 0 ? (
          <div className="space-y-3">
            {lesson.prerequisiteMiniLessons.map((item) => (
              <div
                key={item.prerequisiteConceptId}
                className="rounded-[20px] bg-[var(--alpha-2)] px-4 py-4"
              >
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                  {item.content}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[20px] bg-[var(--alpha-2)] px-4 py-4">
            <p className="text-sm leading-7 text-muted-foreground">
              Bài này không có prerequisite nào đang thiếu, bạn có thể chuyển thẳng sang quiz khi
              đã sẵn sàng.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Học theo cách khác
          </p>
          <h3 className="text-2xl font-semibold text-foreground">Giải thích theo cách dễ hiểu</h3>
        </div>
        {!easyExplanation ? (
          <div className="rounded-[20px] border border-dashed border-[var(--alpha-8)] px-4 py-4 text-sm leading-7 text-muted-foreground">
            Khi cần một cách diễn đạt đơn giản hơn, bấm nút bên dưới để tạo lời giải thích mới.
          </div>
        ) : (
          <div className="rounded-[24px] bg-[var(--alpha-2)] px-5 py-4">
            <p className="whitespace-pre-wrap text-base leading-8 text-foreground">
              {easyExplanation}
            </p>
          </div>
        )}
      </section>

      {recapSummary ? (
        <section className="space-y-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Recap
            </p>
            <h3 className="text-2xl font-semibold text-foreground">
              Tóm tắt nhanh trước khi làm quiz
            </h3>
          </div>
          <div className="rounded-[24px] bg-[var(--alpha-2)] px-5 py-4">
            <p className="text-base leading-8 text-foreground">{recapSummary}</p>
          </div>
        </section>
      ) : null}

      <section className="rounded-[24px] border border-emerald-500/18 bg-[linear-gradient(135deg,rgba(16,185,129,0.08),rgba(20,184,166,0.04))] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Bước tiếp theo
            </p>
            <p className="text-base leading-7 text-foreground">
              Khi đã đọc xong bài học, bạn có thể yêu cầu một cách diễn đạt dễ hiểu hơn hoặc mở
              quiz để tự kiểm tra.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => void onRequestEasyExplanation()}
              disabled={isGeneratingEasyExplanation}
            >
              {isGeneratingEasyExplanation ? 'Đang tạo...' : 'Giải thích theo cách dễ hiểu'}
            </Button>
            <Button type="button" onClick={() => void onRevealQuiz()} disabled={isRevealingQuiz}>
              {isRevealingQuiz ? 'Đang mở quiz...' : 'Tôi đã hiểu, cho tôi quiz'}
            </Button>
          </div>
        </div>
      </section>
    </article>
  );
}
