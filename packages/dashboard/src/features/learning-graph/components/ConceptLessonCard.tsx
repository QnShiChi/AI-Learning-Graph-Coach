import { Button } from '@insforge/ui';
import { useState } from 'react';
import type { LessonPackagePayload } from '../services/learning-graph.service';

interface ConceptLessonCardProps {
  conceptName: string;
  lesson: LessonPackagePayload;
  recapSummary?: string | null;
  onRevealQuiz: () => void | Promise<unknown>;
  onRegenerateExplanation: () => void | Promise<unknown>;
  isRevealingQuiz: boolean;
  isRegeneratingExplanation?: boolean;
}

function splitParagraphs(value: string): string[] {
  return value
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitTechnicalTranslation(value: string): { body: string; explicitKeyIdeas: string[] } {
  const markerPattern = /\n*\s*Trong phần học này, hãy giữ lại \d+ ý chính:\s*/i;
  const [bodyPart, summaryPart] = value.split(markerPattern);

  const explicitKeyIdeas = (summaryPart ?? '')
    .split('\n')
    .map((line) => line.replace(/^-+\s*/, '').trim())
    .filter(Boolean);

  return {
    body: (bodyPart ?? value).trim(),
    explicitKeyIdeas,
  };
}

function extractKeyIdeas(value: string): string[] {
  const sentences =
    value
      .match(/[^.!?]+[.!?]?/g)
      ?.map((part) => part.trim())
      .filter(Boolean) ?? [];

  return sentences.slice(0, 3);
}

function uniqueIdeas(values: string[]): string[] {
  const seen = new Set<string>();

  return values.filter((value) => {
    const normalized = value.toLowerCase().replace(/\s+/g, ' ').trim();

    if (!normalized || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

function LessonMetaphorFallback() {
  return (
    <div className="relative h-[360px] overflow-hidden bg-[linear-gradient(180deg,#dff3ff_0%,#edf9f0_44%,#d9e0ea_44%,#cfd6e1_100%)]">
      <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(255,255,255,0.75),rgba(255,255,255,0))]" />
      <div className="absolute left-8 top-8 h-28 w-44 rounded-[24px] border-[10px] border-slate-700 bg-slate-900 shadow-[0_20px_40px_rgba(15,23,42,0.25)]">
        <div className="absolute inset-3 rounded-2xl border border-cyan-300/40 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.26),transparent_55%),linear-gradient(180deg,rgba(14,116,144,0.32),rgba(15,23,42,0.92))]" />
        <div className="absolute left-7 top-9 h-px w-24 bg-cyan-100/80" />
        <div className="absolute left-7 top-14 h-px w-16 bg-cyan-100/80" />
        <div className="absolute left-7 top-[74px] h-px w-20 bg-cyan-100/80" />
      </div>
      <div className="absolute left-11 top-10 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
        Blueprint
      </div>
      <div className="absolute bottom-[72px] left-12 h-16 w-36 rounded-[24px] bg-rose-500 shadow-[inset_0_-10px_0_rgba(0,0,0,0.14),0_12px_24px_rgba(15,23,42,0.18)]" />
      <div className="absolute bottom-[72px] left-56 h-16 w-36 rounded-[24px] bg-amber-400 shadow-[inset_0_-10px_0_rgba(0,0,0,0.14),0_12px_24px_rgba(15,23,42,0.18)]" />
      <div className="absolute bottom-[92px] left-[72px] h-6 w-14 rounded-t-[20px] bg-rose-300/95" />
      <div className="absolute bottom-[92px] left-[316px] h-6 w-14 rounded-t-[20px] bg-amber-200/95" />
      <div className="absolute bottom-14 left-[84px] h-11 w-11 rounded-full border-[7px] border-slate-800 bg-slate-950" />
      <div className="absolute bottom-14 left-[182px] h-11 w-11 rounded-full border-[7px] border-slate-800 bg-slate-950" />
      <div className="absolute bottom-14 left-[328px] h-11 w-11 rounded-full border-[7px] border-slate-800 bg-slate-950" />
      <div className="absolute bottom-14 left-[426px] h-11 w-11 rounded-full border-[7px] border-slate-800 bg-slate-950" />
      <div className="absolute right-8 top-12 max-w-[220px] rounded-3xl bg-white/86 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.16)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Ẩn dụ trực quan
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Trên tường là bản thiết kế chung, dưới sàn là nhiều chiếc xe thật được tạo ra từ cùng
          một mẫu nhưng có màu sắc và trạng thái riêng.
        </p>
      </div>
      <div className="absolute left-48 top-24 hidden h-px w-20 bg-slate-600 lg:block" />
      <div className="absolute left-[252px] top-[92px] hidden h-10 w-px bg-slate-600 lg:block" />
      <div className="absolute left-[240px] top-[124px] hidden rounded-full bg-slate-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white lg:block">
        Class
      </div>
      <div className="absolute left-[148px] bottom-[138px] hidden h-px w-20 bg-slate-600 lg:block" />
      <div className="absolute left-[226px] bottom-[138px] hidden h-10 w-px bg-slate-600 lg:block" />
      <div className="absolute left-[214px] bottom-[98px] hidden rounded-full bg-slate-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white lg:block">
        Objects
      </div>
    </div>
  );
}

export function ConceptLessonCard({
  conceptName,
  lesson,
  recapSummary = null,
  onRevealQuiz,
  onRegenerateExplanation,
  isRevealingQuiz,
  isRegeneratingExplanation = false,
}: ConceptLessonCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const shouldShowImage = !imageFailed && lesson.metaphorImage.imageUrl.trim().length > 0;
  const feynmanParagraphs = splitParagraphs(lesson.feynmanExplanation);
  const { body: technicalBody, explicitKeyIdeas } = splitTechnicalTranslation(
    lesson.technicalTranslation
  );
  const technicalParagraphs = splitParagraphs(technicalBody);
  const keyIdeas = uniqueIdeas([
    ...explicitKeyIdeas,
    ...extractKeyIdeas(technicalBody),
    ...lesson.imageMapping.map((item) => item.technicalMeaning.trim()),
  ]).slice(0, 3);
  const shortFeynman = feynmanParagraphs.slice(0, 2);

  return (
    <article className="w-full space-y-10 px-1 pb-10">
      <header className="space-y-5 border-b border-[var(--alpha-8)] pb-8">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Khái niệm cốt lõi
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">
              {conceptName}
            </h2>
          </div>
        </div>
      </header>

      <section className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Bài học chính
          </p>
          <h3 className="text-2xl font-semibold text-foreground">Điểm cần hiểu trước</h3>
        </div>
        <div className="space-y-5 text-[17px] leading-8 text-foreground">
          {technicalParagraphs.map((paragraph, index) => (
            <p key={`${paragraph}-${index}`}>{paragraph}</p>
          ))}
        </div>
      </section>

      {keyIdeas.length > 0 ? (
        <section className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Ý chính cần nhớ
            </p>
            <h3 className="text-2xl font-semibold text-foreground">Ba ý cốt lõi của bài này</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {keyIdeas.map((idea, index) => (
              <div
                key={`${idea}-${index}`}
                className="rounded-[22px] border border-[var(--alpha-8)] bg-[var(--alpha-2)] px-4 py-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Ý {index + 1}
                </p>
                <p className="mt-3 text-base leading-7 text-foreground">{idea}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Ví dụ minh họa
          </p>
          <h3 className="text-2xl font-semibold text-foreground">Ẩn dụ đời thường</h3>
        </div>
        <figure className="overflow-hidden rounded-[28px] border border-[var(--alpha-8)] bg-[var(--alpha-2)]">
          {shouldShowImage ? (
            <img
              src={lesson.metaphorImage.imageUrl}
              alt="Minh họa ẩn dụ cho khái niệm hiện tại"
              className="h-[360px] w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <LessonMetaphorFallback />
          )}
          <figcaption className="border-t border-[var(--alpha-8)] px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Caption
            </p>
            <p className="mt-2 text-sm leading-7 text-foreground">{lesson.metaphorImage.prompt}</p>
          </figcaption>
        </figure>

        <div className="rounded-[24px] bg-[var(--alpha-2)] px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Đọc hình
          </p>
          <p className="mt-3 whitespace-pre-wrap text-base leading-8 text-foreground">
            {lesson.imageReadingText}
          </p>
        </div>
      </section>

      {lesson.imageMapping.length > 0 ? (
        <section className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Mapping trực giác sang kỹ thuật
            </p>
            <h3 className="text-2xl font-semibold text-foreground">Từ ví dụ sang khái niệm</h3>
          </div>
          <div className="space-y-4">
            {lesson.imageMapping.map((item, index) => (
              <div
                key={`${item.visualElement}-${index}`}
                className="grid gap-4 border-b border-[var(--alpha-8)] pb-4 last:border-b-0 last:pb-0 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Chi tiết trực giác
                  </p>
                  <p className="mt-2 text-base font-medium text-foreground">{item.visualElement}</p>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.everydayMeaning}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                    Ý nghĩa kỹ thuật
                  </p>
                  <p className="mt-2 text-base leading-8 text-foreground">{item.technicalMeaning}</p>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    {item.teachingPurpose}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {shortFeynman.length > 0 ? (
        <section className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Hiểu theo trực giác
            </p>
            <h3 className="text-2xl font-semibold text-foreground">Một cách hình dung ngắn</h3>
          </div>
          <div className="rounded-[24px] border border-[var(--alpha-8)] bg-[var(--alpha-2)] px-5 py-4">
            <div className="space-y-4 text-base leading-8 text-foreground">
              {shortFeynman.map((paragraph, index) => (
                <p key={`${paragraph}-${index}`}>{paragraph}</p>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Củng cố thêm
          </p>
          <h3 className="text-2xl font-semibold text-foreground">Ôn nhanh điều kiện tiên quyết</h3>
        </div>
        {lesson.prerequisiteMiniLessons.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm leading-7 text-muted-foreground">
              Xem lại các mảnh kiến thức nền nếu bạn thấy phần chính còn hơi nặng.
            </p>
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

      {recapSummary ? (
        <section className="space-y-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Recap
            </p>
            <h3 className="text-2xl font-semibold text-foreground">Tóm tắt nhanh trước khi làm quiz</h3>
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
              Khi đã đọc xong bài học, bạn có thể chọn giải thích lại theo cách khác hoặc mở quiz
              để tự kiểm tra.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => void onRegenerateExplanation()}
              disabled={isRegeneratingExplanation}
            >
              {isRegeneratingExplanation ? 'Đang tạo lại...' : 'Giải thích lại'}
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
