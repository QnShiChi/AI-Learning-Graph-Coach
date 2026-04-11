import { Check, Lock, Sparkles } from 'lucide-react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { cn } from '../../../lib/utils/utils';
import type { KnowledgeGraphThemeTokens } from '../lib/knowledge-graph-theme';
import type { KnowledgeGraphRenderNode } from '../lib/knowledge-graph-view-model';

export type KnowledgeGraphCanvasNodeData = {
  node: KnowledgeGraphRenderNode;
  theme: KnowledgeGraphThemeTokens;
};

export type KnowledgeGraphCanvasNode = Node<KnowledgeGraphCanvasNodeData, 'knowledgeConcept'>;

const nodeStateStyles: Record<KnowledgeGraphRenderNode['state'], string> = {
  completed:
    'border-emerald-300/35 bg-[linear-gradient(180deg,rgba(16,185,129,0.22),rgba(4,120,87,0.12))] text-emerald-50 shadow-[0_18px_36px_rgba(5,150,105,0.12)]',
  current:
    'border-sky-300/55 bg-[linear-gradient(180deg,rgba(56,189,248,0.2),rgba(14,116,144,0.12))] text-white shadow-[0_24px_48px_rgba(14,165,233,0.26)] ring-1 ring-sky-200/20',
  next:
    'border-cyan-300/30 bg-[linear-gradient(180deg,rgba(34,211,238,0.14),rgba(14,116,144,0.08))] text-cyan-50 shadow-[0_16px_32px_rgba(34,211,238,0.12)]',
  upcoming:
    'border-[var(--alpha-8)] bg-[linear-gradient(180deg,rgba(30,41,59,0.9),rgba(15,23,42,0.92))] text-slate-100 shadow-[0_16px_28px_rgba(2,6,23,0.18)]',
  locked:
    'border-[var(--alpha-8)] bg-[linear-gradient(180deg,rgba(30,41,59,0.76),rgba(15,23,42,0.78))] text-slate-300 opacity-65',
  untracked:
    'border-[var(--alpha-8)] bg-[linear-gradient(180deg,rgba(30,41,59,0.84),rgba(15,23,42,0.86))] text-slate-300 opacity-80',
};

const stateLabels: Record<KnowledgeGraphRenderNode['state'], string> = {
  completed: 'Da xong',
  current: 'Dang hoc',
  next: 'Tiep theo',
  upcoming: 'Sap toi',
  locked: 'Dang khoa',
  untracked: 'Ngoai lo trinh',
};

function getBadgeIcon(state: KnowledgeGraphRenderNode['state']) {
  if (state === 'completed') {
    return <Check className="h-4 w-4" />;
  }

  if (state === 'locked') {
    return <Lock className="h-4 w-4" />;
  }

  if (state === 'current') {
    return <Sparkles className="h-4 w-4" />;
  }

  return null;
}

export function KnowledgeGraphNode({ data }: NodeProps<KnowledgeGraphCanvasNode>) {
  const node = data.node;
  const theme = data.theme;
  const difficultyAngle = Math.max(12, Math.round(node.difficulty * 360));
  const masteryScore = node.masteryScore ?? 0;
  const masteryAngle = Math.round(masteryScore * 360);
  const isCurrent = node.state === 'current';

  return (
    <div
      className={cn(
        'group relative min-w-[220px] rounded-[24px] border px-4 py-4 transition-all duration-200',
        node.selected && 'ring-2 ring-sky-300/35',
        isCurrent && 'scale-[1.08]',
        nodeStateStyles[node.state]
      )}
      style={{
        borderColor: theme.nodeBorder,
        color: theme.textPrimary,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-0 !bg-transparent !shadow-none"
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-0 !bg-transparent !shadow-none"
        isConnectable={false}
      />

      <div
        className="pointer-events-none absolute inset-0 rounded-[24px]"
        style={{
          background: `conic-gradient(from 180deg, rgba(250,204,21,0.65) 0deg ${difficultyAngle}deg, transparent ${difficultyAngle}deg 360deg)`,
          WebkitMaskImage:
            'radial-gradient(circle at center, transparent 71%, black 73%, black 77%, transparent 79%)',
          maskImage:
            'radial-gradient(circle at center, transparent 71%, black 73%, black 77%, transparent 79%)',
        }}
      />

      {node.masteryScore !== null ? (
        <div
          className="pointer-events-none absolute inset-[8px] rounded-[18px]"
          style={{
            background: `conic-gradient(from 180deg, rgba(56,189,248,0.7) 0deg ${masteryAngle}deg, transparent ${masteryAngle}deg 360deg)`,
            WebkitMaskImage:
              'radial-gradient(circle at center, transparent 82%, black 84%, black 87%, transparent 89%)',
            maskImage:
              'radial-gradient(circle at center, transparent 82%, black 84%, black 87%, transparent 89%)',
          }}
        />
      ) : null}

      {isCurrent ? (
        <div
          className="pointer-events-none absolute inset-0 rounded-[24px] animate-[pulse_4s_ease-in-out_infinite]"
          style={{ boxShadow: theme.currentGlow }}
        />
      ) : null}

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-current/70">
            Concept
          </p>
          <h3 className="text-sm font-semibold leading-5">{node.label}</h3>
        </div>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-current"
          style={{ borderColor: theme.nodeBorder, background: 'rgba(255,255,255,0.08)' }}
        >
          {getBadgeIcon(node.state) ?? <span className="text-[10px] font-semibold">{Math.round(node.difficulty * 100)}</span>}
        </span>
      </div>

      <div className="relative mt-5 flex items-center justify-between gap-3 text-[11px]">
        <span
          className="rounded-full bg-white/8 px-2.5 py-1 font-medium uppercase tracking-[0.12em] text-current/90"
          style={{ border: `1px solid ${theme.nodeBorder}` }}
        >
          {stateLabels[node.state]}
        </span>
        {node.masteryScore !== null ? (
          <span className="font-medium text-current/80">Mastery {Math.round(masteryScore * 100)}%</span>
        ) : (
          <span className="font-medium text-current/60">Do kho {Math.round(node.difficulty * 100)}%</span>
        )}
      </div>
    </div>
  );
}
