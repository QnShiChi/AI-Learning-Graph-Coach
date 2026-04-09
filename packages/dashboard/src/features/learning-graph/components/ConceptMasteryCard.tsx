import { getMasteryLabel, hasPassedConcept } from '../lib/mastery';

interface ConceptMasteryCardProps {
  masteryScore: number;
  attemptCount?: number;
  recapSummary?: string | null;
}

export function ConceptMasteryCard({
  masteryScore,
  attemptCount = 0,
  recapSummary = null,
}: ConceptMasteryCardProps) {
  const percentage = Math.round(masteryScore * 100);
  const passed = hasPassedConcept(masteryScore);

  return (
    <section className="rounded-lg border border-[var(--alpha-8)] bg-card p-5">
      <p className="text-sm text-muted-foreground">Mastery hiện tại</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-semibold text-foreground">{percentage}%</p>
          <p className="mt-1 text-sm text-foreground">{getMasteryLabel(masteryScore)}</p>
        </div>
        <div className="rounded-full bg-[var(--alpha-4)] px-3 py-1 text-xs text-muted-foreground">
          {passed ? 'Đã qua ngưỡng 0.7' : 'Cần đạt 70% để qua khái niệm'}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-md bg-[var(--alpha-4)] p-3">
          <p className="text-xs text-muted-foreground">Số lần quiz</p>
          <p className="mt-1 text-base font-medium text-foreground">{attemptCount}</p>
        </div>
        <div className="rounded-md bg-[var(--alpha-4)] p-3">
          <p className="text-xs text-muted-foreground">Recap</p>
          <p className="mt-1 text-sm text-foreground">
            {recapSummary ?? 'Recap sẽ xuất hiện sau khi hoàn thành quiz.'}
          </p>
        </div>
      </div>
    </section>
  );
}
