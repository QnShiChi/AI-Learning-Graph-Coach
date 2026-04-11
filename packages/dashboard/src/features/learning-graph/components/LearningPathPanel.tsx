const pathStateLabels = {
  completed: 'Đã hoàn thành',
  current: 'Đang học',
  next: 'Tiếp theo',
  upcoming: 'Sắp tới',
  locked: 'Chưa mở',
} as const;

interface LearningPathPanelProps {
  items: Array<{
    conceptId: string;
    label: string;
    pathState: keyof typeof pathStateLabels;
  }>;
  onSelect: (conceptId: string) => void;
}

export function LearningPathPanel({ items, onSelect }: LearningPathPanelProps) {
  return (
    <section className="rounded-[20px] border border-[var(--alpha-8)] bg-card/80 p-4 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Learning path
        </p>
        <h2 className="text-lg font-medium text-foreground">Lộ trình học</h2>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {items.map((item, index) => (
          <button
            key={item.conceptId}
            type="button"
            onClick={() => onSelect(item.conceptId)}
            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--alpha-8)] bg-[var(--alpha-2)] px-3 py-2.5 text-left transition hover:border-emerald-500/20 hover:bg-emerald-500/[0.04]"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Bước {index + 1}
              </p>
              <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
            </div>
            <span className="shrink-0 rounded-full border border-[var(--alpha-8)] px-2 py-1 text-[11px] text-muted-foreground">
              {pathStateLabels[item.pathState]}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
