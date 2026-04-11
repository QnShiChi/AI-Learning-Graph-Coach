import { BaseEdge, getBezierPath, type Edge, type EdgeProps } from '@xyflow/react';
import type { KnowledgeGraphRenderEdge } from '../lib/knowledge-graph-view-model';

export type KnowledgeGraphCanvasEdgeData = {
  edge: KnowledgeGraphRenderEdge;
};

export type KnowledgeGraphCanvasEdge = Edge<KnowledgeGraphCanvasEdgeData, 'knowledgeEdge'>;

export function KnowledgeGraphEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}: EdgeProps<KnowledgeGraphCanvasEdge>) {
  const edge = data?.edge ?? {
    id: '',
    source: '',
    target: '',
    kind: 'prerequisite' as const,
    muted: false,
    highlighted: false,
  };
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: edge.kind === 'path' ? 0.16 : 0.22,
  });

  const stroke =
    edge.kind === 'path'
      ? 'rgba(103,232,249,0.95)'
      : edge.muted
        ? 'rgba(148,163,184,0.18)'
        : 'rgba(148,163,184,0.42)';

  return (
    <BaseEdge
      path={path}
      markerEnd={markerEnd}
      style={{
        stroke,
        strokeWidth: edge.kind === 'path' ? 3 : 1.5,
        filter: edge.kind === 'path' ? 'drop-shadow(0 0 10px rgba(34,211,238,0.28))' : 'none',
      }}
    />
  );
}
