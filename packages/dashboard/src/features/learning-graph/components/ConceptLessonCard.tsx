import { Button } from '@insforge/ui';
import type { LessonPackagePayload } from '../services/learning-graph.service';

interface ConceptLessonCardProps {
  lesson: LessonPackagePayload;
  onRevealQuiz: () => void | Promise<unknown>;
  isRevealingQuiz: boolean;
}

export function ConceptLessonCard({
  lesson,
  onRevealQuiz,
  isRevealingQuiz,
}: ConceptLessonCardProps) {
  return (
    <section className="rounded-lg border border-[var(--alpha-8)] bg-card p-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Bài học chính</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Học phần này trước, sau đó tự chọn mở quiz khi đã sẵn sàng.
        </p>
      </div>

      <div className="mt-5 space-y-5">
        <div>
          <h3 className="text-base font-medium text-foreground">Giải thích theo kiểu Feynman</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
            {lesson.feynmanExplanation}
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-[var(--alpha-8)] bg-[var(--alpha-2)]">
          <img
            src={lesson.metaphorImage.imageUrl}
            alt="Minh họa ẩn dụ cho khái niệm hiện tại"
            className="h-64 w-full object-cover"
          />
          <div className="border-t border-[var(--alpha-8)] p-3">
            <p className="text-xs text-muted-foreground">Ẩn dụ trực quan</p>
            <p className="mt-1 text-sm text-foreground">{lesson.metaphorImage.prompt}</p>
          </div>
        </div>

        <div>
          <h3 className="text-base font-medium text-foreground">Đọc hình</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {lesson.imageReadingText}
          </p>
        </div>

        {lesson.imageMapping.length > 0 ? (
          <div>
            <h3 className="text-base font-medium text-foreground">Gỡ nghĩa từ hình minh họa</h3>
            <div className="mt-3 space-y-3">
              {lesson.imageMapping.map((item, index) => (
                <div
                  key={`${item.visualElement}-${index}`}
                  className="rounded-md border border-[var(--alpha-8)] p-3"
                >
                  <p className="text-sm font-medium text-foreground">{item.visualElement}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.everydayMeaning}</p>
                  <p className="mt-2 text-sm text-foreground">{item.technicalMeaning}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <h3 className="text-base font-medium text-foreground">Dịch sang ngôn ngữ kỹ thuật</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
            {lesson.technicalTranslation}
          </p>
        </div>

        {lesson.prerequisiteMiniLessons.length > 0 ? (
          <div>
            <h3 className="text-base font-medium text-foreground">Ôn nhanh điều kiện tiên quyết</h3>
            <div className="mt-3 space-y-3">
              {lesson.prerequisiteMiniLessons.map((item) => (
                <div
                  key={item.prerequisiteConceptId}
                  className="rounded-md border border-[var(--alpha-8)] bg-[var(--alpha-2)] p-3"
                >
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {item.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 rounded-md bg-[var(--alpha-4)] p-4">
        <p className="text-sm text-foreground">
          Khi đã hiểu phần bài học, bạn có thể chủ động mở quiz để tự kiểm tra.
        </p>
        <Button type="button" onClick={() => void onRevealQuiz()} disabled={isRevealingQuiz}>
          {isRevealingQuiz ? 'Đang mở quiz...' : 'Tôi đã hiểu, cho tôi quiz'}
        </Button>
      </div>
    </section>
  );
}
