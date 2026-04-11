import { Button } from '@insforge/ui';
import { ArrowRight, Lock, Sparkles, TrendingUp } from 'lucide-react';
import type { KnowledgeGraphThemeTokens } from '../lib/knowledge-graph-theme';
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
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  theme: KnowledgeGraphThemeTokens;
  onOpenConcept: () => void;
}) {
  const { selectedNode, summary } = props.viewModel;
  const { theme } = props;

  if (!props.isOpen) {
    return (
      <>
        <aside className="hidden xl:flex xl:sticky xl:top-6 xl:h-[72vh] xl:items-center xl:justify-center">
          <button
            type="button"
            onClick={() => props.onOpenChange(true)}
            className="flex h-40 w-14 items-center justify-center rounded-[20px] border backdrop-blur transition hover:opacity-90"
            style={{ background: theme.railBg, borderColor: theme.nodeBorder, color: theme.textPrimary }}
            aria-label="Mo chi tiet concept"
          >
            <span className="rotate-180 text-xs font-semibold uppercase tracking-[0.18em] [writing-mode:vertical-rl]">
              Chi tiet
            </span>
          </button>
        </aside>

        <aside
          className="xl:hidden rounded-[24px] border p-4"
          style={{ background: theme.railBg, borderColor: theme.nodeBorder }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: theme.textMuted }}>
                Concept detail
              </p>
              <p className="mt-2 text-sm font-medium" style={{ color: theme.textPrimary }}>
                {selectedNode?.label ?? summary.currentConceptLabel ?? 'Chon mot node de xem chi tiet'}
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => props.onOpenChange(true)}>
              Mo
            </Button>
          </div>
        </aside>
      </>
    );
  }

  if (!selectedNode) {
    return (
      <aside
        className="rounded-[24px] border p-5"
        style={{ background: theme.panelBg, borderColor: theme.nodeBorder }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: theme.textMuted }}>
          Knowledge map
        </p>
        <h2 className="mt-2 text-xl font-semibold" style={{ color: theme.textPrimary }}>Ban dang o dau</h2>

        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border p-4" style={{ borderColor: theme.nodeBorder }}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: theme.textMuted }}>
              Ban dang hoc
            </p>
            <p className="mt-2 text-sm font-medium" style={{ color: theme.textPrimary }}>
              {summary.currentConceptLabel ?? 'Chua co current concept'}
            </p>
          </div>

          <div className="rounded-2xl border p-4" style={{ borderColor: theme.nodeBorder }}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: theme.textMuted }}>
              Buoc tiep theo
            </p>
            <p className="mt-2 text-sm font-medium" style={{ color: theme.textPrimary }}>
              {summary.nextConceptLabel ?? 'Dang doi mo khoa'}
            </p>
          </div>

          <div className="rounded-2xl border p-4" style={{ borderColor: theme.nodeBorder }}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: theme.textMuted }}>
              Tien do
            </p>
            <p className="mt-2 text-2xl font-semibold" style={{ color: theme.textPrimary }}>
              {summary.completedCount}/{summary.totalCount}
            </p>
            <p className="mt-1 text-sm" style={{ color: theme.textMuted }}>concept da hoan thanh</p>
          </div>

          <div className="rounded-2xl border p-4 text-sm leading-6" style={{ borderColor: theme.nodeBorder, color: theme.textMuted }}>
            Line mong la prerequisite. Line sang la duong hoc de xuat hien tai.
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="rounded-[24px] border p-5"
      style={{ background: theme.panelBg, borderColor: theme.nodeBorder }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: theme.textMuted }}>
            {selectedNode.state === 'current' ? 'Ban dang o day' : 'Concept detail'}
          </p>
          <h2 className="text-xl font-semibold" style={{ color: theme.textPrimary }}>{selectedNode.label}</h2>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-full border" style={{ borderColor: theme.nodeBorder }}>
          {selectedNode.state === 'locked' ? (
            <Lock className="h-4 w-4 text-amber-300" />
          ) : (
            <Sparkles className="h-4 w-4 text-sky-300" />
          )}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6" style={{ color: theme.textMuted }}>{selectedNode.description}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full border px-3 py-1 text-xs font-medium" style={{ borderColor: theme.nodeBorder, color: theme.textPrimary }}>
          {stateLabels[selectedNode.state]}
        </span>
        <span className="rounded-full border px-3 py-1 text-xs font-medium" style={{ borderColor: theme.nodeBorder, color: theme.textMuted }}>
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

      <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: theme.nodeBorder }}>
        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: theme.textPrimary }}>
          <TrendingUp className="h-4 w-4 text-sky-300" />
          Vi tri trong hanh trinh hoc
        </div>
        <p className="mt-3 text-sm leading-6" style={{ color: theme.textMuted }}>
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
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={() => props.onOpenChange(false)}>
            Thu gon
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={props.onOpenConcept}
            disabled={!props.selectedConceptId}
          >
            <span>Di toi bai hoc nay</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
