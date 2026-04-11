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
import { useTheme } from '../../../lib/contexts/ThemeContext';
import {
  KnowledgeGraphEdge,
  type KnowledgeGraphCanvasEdge,
} from './KnowledgeGraphEdge';
import {
  KnowledgeGraphNode,
  type KnowledgeGraphCanvasNode,
} from './KnowledgeGraphNode';
import { getKnowledgeGraphTheme } from '../lib/knowledge-graph-theme';
import type { KnowledgeGraphViewModel } from '../lib/knowledge-graph-view-model';

const nodeTypes = {
  knowledgeConcept: KnowledgeGraphNode,
};

const edgeTypes = {
  knowledgeEdge: KnowledgeGraphEdge,
};

const COLUMN_GAP = 420;
const NODE_HEIGHT = 126;
const NODE_STACK_GAP = 42;

function buildCenteredLevelOrder(nodes: KnowledgeGraphViewModel['nodes']) {
  const pathNodes = nodes.filter((node) => node.orderGroup === 'path');
  const nonPathNodes = nodes.filter((node) => node.orderGroup !== 'path');
  const upper: typeof nodes = [];
  const lower: typeof nodes = [];

  nonPathNodes.forEach((node, index) => {
    if (index % 2 === 0) {
      upper.push(node);
      return;
    }

    lower.push(node);
  });

  return [...upper.reverse(), ...pathNodes, ...lower];
}

function resolveVerticalCollisions(items: Array<{ node: KnowledgeGraphViewModel['nodes'][number]; y: number }>) {
  const resolved = [...items].sort((left, right) => left.y - right.y);

  for (let index = 1; index < resolved.length; index += 1) {
    const previous = resolved[index - 1]!;
    const current = resolved[index]!;
    const nextAllowedY = previous.y + NODE_HEIGHT + NODE_STACK_GAP;

    if (current.y < nextAllowedY) {
      current.y = nextAllowedY;
    }
  }

  const firstY = resolved[0]?.y ?? 0;
  const lastY = resolved.length > 0 ? resolved[resolved.length - 1]!.y : 0;
  const totalHeight = lastY - firstY;
  const recenterOffset = totalHeight / 2;

  return resolved.map((item) => ({ ...item, y: item.y - recenterOffset }));
}

function buildCanvasNodes(
  viewModel: KnowledgeGraphViewModel,
  graphTheme: ReturnType<typeof getKnowledgeGraphTheme>
): KnowledgeGraphCanvasNode[] {
  const levelGroups = new Map<number, typeof viewModel.nodes>();

  for (const node of viewModel.nodes) {
    const group = levelGroups.get(node.level) ?? [];
    group.push(node);
    levelGroups.set(node.level, group);
  }

  const positionedNodes = new Map<string, { x: number; y: number }>();

  for (const [level, group] of levelGroups) {
    const orderedGroup = buildCenteredLevelOrder(group);
    const initial = orderedGroup.map((node, index) => ({
      node,
      y: index * (NODE_HEIGHT + 110),
    }));
    const resolved = resolveVerticalCollisions(initial);

    for (const item of resolved) {
      positionedNodes.set(item.node.id, {
        x: level * COLUMN_GAP + 96,
        y: item.y + 320,
      });
    }
  }

  return viewModel.nodes.map((node) => {
    const position = positionedNodes.get(node.id) ?? { x: node.level * COLUMN_GAP + 96, y: 320 };

    return {
      id: node.id,
      type: 'knowledgeConcept',
      position,
      data: { node, theme: graphTheme },
      draggable: false,
      selectable: true,
    };
  });
}

function buildCanvasEdges(
  viewModel: KnowledgeGraphViewModel,
  graphTheme: ReturnType<typeof getKnowledgeGraphTheme>
): KnowledgeGraphCanvasEdge[] {
  return viewModel.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'knowledgeEdge',
    selectable: false,
    data: { edge, theme: graphTheme },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color:
        edge.kind === 'path'
          ? graphTheme.edgePath
          : edge.muted
            ? graphTheme.edgeMuted
            : graphTheme.edgePrerequisite,
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
      void fitView({ padding: 0.24, duration: 280, maxZoom: 1.1 });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [fitView, nodeCount]);

  return null;
}

function CanvasInner(props: {
  viewModel: KnowledgeGraphViewModel;
  onSelectNode: (conceptId: string) => void;
}) {
  const { resolvedTheme } = useTheme();
  const graphTheme = useMemo(() => getKnowledgeGraphTheme(resolvedTheme), [resolvedTheme]);
  const nodes = useMemo(() => buildCanvasNodes(props.viewModel, graphTheme), [props.viewModel, graphTheme]);
  const edges = useMemo(() => buildCanvasEdges(props.viewModel, graphTheme), [props.viewModel, graphTheme]);

  return (
    <div
      className="relative min-h-[72vh] overflow-hidden rounded-[28px] border border-[var(--alpha-8)]"
      style={{ background: graphTheme.canvasBg }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32"
        style={{ background: graphTheme.canvasGlow }}
      />

      <div
        className="absolute left-4 top-4 z-20 rounded-2xl border px-3 py-3 backdrop-blur"
        style={{ background: graphTheme.legendBg, borderColor: graphTheme.nodeBorder }}
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: graphTheme.textMuted }}
        >
          Legend
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]" style={{ color: graphTheme.textPrimary }}>
          <span className="rounded-full border border-emerald-300/35 px-2 py-1">Da xong</span>
          <span className="rounded-full border border-sky-300/40 px-2 py-1">Dang hoc</span>
          <span className="rounded-full border border-cyan-300/35 px-2 py-1">Tiep theo</span>
          <span
            className="rounded-full px-2 py-1"
            style={{ border: `1px solid ${graphTheme.nodeBorder}` }}
          >
            Dang khoa
          </span>
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
          color={graphTheme.dotColor}
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
