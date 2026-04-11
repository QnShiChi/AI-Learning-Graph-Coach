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
    <section className="rounded-[20px] border border-[var(--alpha-8)] bg-[var(--alpha-2)] px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Mastery hiện tại
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <span className="text-4xl font-semibold tracking-tight text-foreground">{percentage}%</span>
        <span className="text-sm text-foreground">{getMasteryLabel(masteryScore)}</span>
        <span className="rounded-full bg-[var(--alpha-4)] px-3 py-1 text-[11px] text-muted-foreground">
          {passed ? 'Đã qua ngưỡng 0.7' : 'Cần đạt 70% để qua khái niệm'}
        </span>
      </div>
      <div className="mt-3 text-sm text-muted-foreground">
        {attemptCount} lần quiz
      </div>
    </section>
  );
}
