import { Button } from '@insforge/ui';
import { ArrowRight, Lock, Sparkles, TrendingUp } from 'lucide-react';
import type { KnowledgeGraphViewModel } from '../lib/knowledge-graph-view-model';

const stateLabels = {
  completed: 'Da hoan thanh',
  current: 'Dang hoc',
  next: 'Tiep theo',
  upcoming: 'Sap toi',
  locked: 'Dang khoa',
  untracked: 'Ngoai lo trinh',
} as const;

export function KnowledgeGraphDetailPanel(props: {
  viewModel: KnowledgeGraphViewModel;
  selectedConceptId: string | null;
  onOpenConcept: () => void;
}) {
  const { selectedNode, summary } = props.viewModel;

  if (!selectedNode) {
    return (
      <aside className="rounded-[24px] border border-[var(--alpha-8)] bg-card/85 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Knowledge map
        </p>
        <h2 className="mt-2 text-xl font-semibold text-foreground">Ban dang o dau</h2>

        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-[var(--alpha-8)] bg-[var(--alpha-2)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Ban dang hoc
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {summary.currentConceptLabel ?? 'Chua co current concept'}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--alpha-8)] bg-[var(--alpha-2)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Buoc tiep theo
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {summary.nextConceptLabel ?? 'Dang doi mo khoa'}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--alpha-8)] bg-[var(--alpha-2)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Tien do
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {summary.completedCount}/{summary.totalCount}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">concept da hoan thanh</p>
          </div>

          <div className="rounded-2xl border border-[var(--alpha-8)] bg-[var(--alpha-2)] p-4 text-sm leading-6 text-muted-foreground">
            Line mong la prerequisite. Line sang la duong hoc de xuat hien tai.
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="rounded-[24px] border border-[var(--alpha-8)] bg-card/90 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {selectedNode.state === 'current' ? 'Ban dang o day' : 'Concept detail'}
          </p>
          <h2 className="text-xl font-semibold text-foreground">{selectedNode.label}</h2>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--alpha-8)] bg-[var(--alpha-2)]">
          {selectedNode.state === 'locked' ? (
            <Lock className="h-4 w-4 text-amber-300" />
          ) : (
            <Sparkles className="h-4 w-4 text-sky-300" />
          )}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-muted-foreground">{selectedNode.description}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full border border-[var(--alpha-8)] bg-[var(--alpha-2)] px-3 py-1 text-xs font-medium text-foreground">
          {stateLabels[selectedNode.state]}
        </span>
        <span className="rounded-full border border-[var(--alpha-8)] bg-[var(--alpha-2)] px-3 py-1 text-xs font-medium text-muted-foreground">
          Do kho {Math.round(selectedNode.difficulty * 100)}%
        </span>
        {selectedNode.masteryScore !== null ? (
          <span className="rounded-full border border-sky-300/20 bg-sky-400/[0.08] px-3 py-1 text-xs font-medium text-sky-200">
            Mastery {Math.round(selectedNode.masteryScore * 100)}%
          </span>
        ) : null}
      </div>

      {selectedNode.state === 'locked' && selectedNode.missingPrerequisiteLabels.length > 0 ? (
        <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-100">
            <Lock className="h-4 w-4" />
            Can hoan thanh truoc
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedNode.missingPrerequisiteLabels.map((label) => (
              <span
                key={label}
                className="rounded-full border border-amber-400/20 px-2.5 py-1 text-xs text-amber-100"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl border border-[var(--alpha-8)] bg-[var(--alpha-2)] p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <TrendingUp className="h-4 w-4 text-sky-300" />
          Vi tri trong hanh trinh hoc
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {selectedNode.state === 'current'
            ? 'Day la concept hien tai trong duong hoc de xuat.'
            : selectedNode.state === 'next'
              ? 'Day la buoc tiep theo sau concept hien tai.'
              : selectedNode.state === 'completed'
                ? 'Ban da di qua concept nay trong hanh trinh hoc.'
                : selectedNode.state === 'locked'
                  ? 'Concept nay da xuat hien tren map nhung con bi khoa boi prerequisite chua xong.'
                  : 'Concept nay nam tren knowledge map de giai thich bo cuc prerequisite tong the.'}
        </p>
      </div>

      <div className="mt-6">
        <Button
          type="button"
          className="w-full"
          onClick={props.onOpenConcept}
          disabled={!props.selectedConceptId}
        >
          <span>Di toi bai hoc nay</span>
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}
