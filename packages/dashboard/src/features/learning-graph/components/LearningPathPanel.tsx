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
    <section className="rounded-[24px] border border-[var(--alpha-8)] bg-card p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <div className="space-y-2">
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
            className="flex items-center justify-between rounded-2xl border border-[var(--alpha-8)] bg-[var(--alpha-2)] px-3 py-3 text-left transition hover:border-emerald-500/20 hover:bg-emerald-500/[0.04]"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Bước {index + 1}</p>
              <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
            </div>
            <span className="rounded-full border border-[var(--alpha-8)] bg-white/70 px-2 py-1 text-xs text-muted-foreground">
              {pathStateLabels[item.pathState]}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
