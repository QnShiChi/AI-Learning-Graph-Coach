const pathStateLabels = {
  completed: 'Da hoan thanh',
  current: 'Dang hoc',
  next: 'Tiep theo',
  upcoming: 'Sap toi',
  locked: 'Chua mo',
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
    <section className="rounded-lg border border-[var(--alpha-8)] bg-card p-5">
      <h2 className="text-lg font-medium text-foreground">Lo trinh hoc</h2>
      <div className="mt-4 flex flex-col gap-2">
        {items.map((item, index) => (
          <button
            key={item.conceptId}
            type="button"
            onClick={() => onSelect(item.conceptId)}
            className="flex items-center justify-between rounded-md border border-[var(--alpha-8)] px-3 py-3 text-left transition hover:bg-[var(--alpha-4)]"
          >
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Buoc {index + 1}</p>
              <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
            </div>
            <span className="rounded-full bg-[var(--alpha-4)] px-2 py-1 text-xs text-muted-foreground">
              {pathStateLabels[item.pathState]}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
