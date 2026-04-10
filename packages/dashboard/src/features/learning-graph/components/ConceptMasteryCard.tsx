import { getMasteryLabel, hasPassedConcept } from '../lib/mastery';

interface ConceptMasteryCardProps {
  masteryScore: number;
  attemptCount?: number;
}

export function ConceptMasteryCard({
  masteryScore,
  attemptCount = 0,
}: ConceptMasteryCardProps) {
  const percentage = Math.round(masteryScore * 100);
  const passed = hasPassedConcept(masteryScore);

  return (
    <section className="rounded-[20px] border border-[var(--alpha-8)] bg-card/80 p-4 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Tiến độ hiện tại
      </p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-4xl font-semibold tracking-tight text-foreground">{percentage}%</p>
          <p className="mt-1 text-sm text-foreground">{getMasteryLabel(masteryScore)}</p>
        </div>
        <div className="rounded-full bg-[var(--alpha-4)] px-3 py-1 text-[11px] text-muted-foreground">
          {passed ? 'Đã qua ngưỡng 0.7' : 'Cần đạt 70% để qua khái niệm'}
        </div>
      </div>

      <div className="mt-4">
        <div className="rounded-xl bg-[var(--alpha-4)] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Số lần quiz
          </p>
          <p className="mt-1 text-base font-medium text-foreground">{attemptCount}</p>
        </div>
      </div>
    </section>
  );
}
