import { useEffect, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  KnowledgeGraphEdge,
  type KnowledgeGraphCanvasEdge,
} from './KnowledgeGraphEdge';
import {
  KnowledgeGraphNode,
  type KnowledgeGraphCanvasNode,
} from './KnowledgeGraphNode';
import type { KnowledgeGraphViewModel } from '../lib/knowledge-graph-view-model';

const nodeTypes = {
  knowledgeConcept: KnowledgeGraphNode,
};

const edgeTypes = {
  knowledgeEdge: KnowledgeGraphEdge,
};

function buildCanvasNodes(viewModel: KnowledgeGraphViewModel): KnowledgeGraphCanvasNode[] {
  const levelGroups = new Map<number, typeof viewModel.nodes>();

  for (const node of viewModel.nodes) {
    const group = levelGroups.get(node.level) ?? [];
    group.push(node);
    levelGroups.set(node.level, group);
  }

  const maxColumnSize = Math.max(...[...levelGroups.values()].map((group) => group.length), 1);
  const columnGap = 320;
  const rowGap = 180;

  return viewModel.nodes.map((node) => {
    const siblings = levelGroups.get(node.level) ?? [];
    const rowIndex = siblings.findIndex((item) => item.id === node.id);
    const offset = ((maxColumnSize - siblings.length) * rowGap) / 2;

    return {
      id: node.id,
      type: 'knowledgeConcept',
        position: {
          x: node.level * columnGap + 64,
          y: rowIndex * rowGap + 72 + offset,
        },
        data: { node },
        draggable: false,
        selectable: true,
      };
    });
}

function buildCanvasEdges(viewModel: KnowledgeGraphViewModel): KnowledgeGraphCanvasEdge[] {
  return viewModel.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'knowledgeEdge',
    selectable: false,
    data: { edge },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color:
        edge.kind === 'path'
          ? 'rgba(103,232,249,0.95)'
          : edge.muted
            ? 'rgba(148,163,184,0.18)'
            : 'rgba(148,163,184,0.42)',
    },
  }));
}

function FitToGraph({ nodeCount }: { nodeCount: number }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (nodeCount === 0) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      void fitView({ padding: 0.18, duration: 350, maxZoom: 1.25 });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [fitView, nodeCount]);

  return null;
}

function CanvasInner(props: {
  viewModel: KnowledgeGraphViewModel;
  onSelectNode: (conceptId: string) => void;
}) {
  const nodes = useMemo(() => buildCanvasNodes(props.viewModel), [props.viewModel]);
  const edges = useMemo(() => buildCanvasEdges(props.viewModel), [props.viewModel]);

  return (
    <div className="relative h-[620px] overflow-hidden rounded-[28px] border border-[var(--alpha-8)] bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_58%)]" />

      <div className="absolute left-4 top-4 z-20 rounded-2xl border border-white/8 bg-slate-950/70 px-3 py-3 backdrop-blur">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Legend
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
          <span className="rounded-full border border-emerald-300/35 px-2 py-1">Da xong</span>
          <span className="rounded-full border border-sky-300/40 px-2 py-1">Dang hoc</span>
          <span className="rounded-full border border-cyan-300/35 px-2 py-1">Tiep theo</span>
          <span className="rounded-full border border-slate-700 px-2 py-1">Dang khoa</span>
        </div>
      </div>

      <ReactFlow
        fitView
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={0.55}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => props.onSelectNode(node.id)}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1.3}
          color="rgba(148,163,184,0.22)"
        />
        <Controls showInteractive={false} />
        <FitToGraph nodeCount={nodes.length} />
      </ReactFlow>
    </div>
  );
}

export function KnowledgeGraphCanvas(props: {
  viewModel: KnowledgeGraphViewModel;
  onSelectNode: (conceptId: string) => void;
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner viewModel={props.viewModel} onSelectNode={props.onSelectNode} />
    </ReactFlowProvider>
  );
}
