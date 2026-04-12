# Learning Graph Graph View Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Biến `Graph View / Đồ thị kiến thức` từ giao diện hai danh sách thành một knowledge map node-based với canvas trung tâm, recommended path highlight, và detail panel giải thích rõ current/next/locked state.

**Architecture:** Giữ nguyên source of truth hiện tại từ `graph`, `pathSnapshot`, `currentConcept`, và `session.currentConceptId`, sau đó thêm một lớp view-model để map dữ liệu session sang node/edge/render state cho React Flow. `KnowledgeGraphPanel` trở thành orchestration shell cho header, mode toggle, canvas, và detail panel; phần render graph được tách thành các component nhỏ hơn để node state, edge state, và layout logic không dồn vào một file.

**Tech Stack:** React 19, TypeScript, TanStack Query, `@xyflow/react`, `lucide-react`, Tailwind utility classes, Vitest

---

## File Structure

- Modify: `packages/dashboard/src/features/learning-graph/pages/KnowledgeGraphPage.tsx`
  Responsibility: lấy cả session overview lẫn graph data, truyền đầy đủ props vào graph shell, và giữ route-level loading/error đơn giản.
- Modify: `packages/dashboard/src/features/learning-graph/components/KnowledgeGraphPanel.tsx`
  Responsibility: trở thành shell chính của Graph View, sở hữu `selectedConceptId`, `graphMode`, header, responsive layout, loading/empty/error states, và panel default summary.
- Create: `packages/dashboard/src/features/learning-graph/components/KnowledgeGraphCanvas.tsx`
  Responsibility: render React Flow canvas, background, controls, fitView, node click handling, và hover highlight.
- Create: `packages/dashboard/src/features/learning-graph/components/KnowledgeGraphNode.tsx`
  Responsibility: render concept node với visual states `completed/current/next/upcoming/locked/untracked`, difficulty ring, mastery ring, và badges.
- Create: `packages/dashboard/src/features/learning-graph/components/KnowledgeGraphEdge.tsx`
  Responsibility: render prerequisite edge và path edge với style tách biệt.
- Create: `packages/dashboard/src/features/learning-graph/components/KnowledgeGraphDetailPanel.tsx`
  Responsibility: render default summary/legend hoặc selected node detail + CTA `Đi tới bài học này`.
- Create: `packages/dashboard/src/features/learning-graph/lib/knowledge-graph-view-model.ts`
  Responsibility: map `graph + pathSnapshot + currentConcept` thành render model cho nodes/edges/panel, tính node states, path edges, locked reasons, và layout levels.
- Create: `packages/dashboard/src/features/learning-graph/lib/__tests__/knowledge-graph-view-model.test.ts`
  Responsibility: test mapping logic cho node states, path edges, locked prerequisites, và `path-only` mode.
- Modify: `packages/dashboard/src/features/learning-graph/components/index.ts`
  Responsibility: export các graph components mới dùng trong feature.

## Task 1: Tạo view-model cho Graph View và test mapping state

**Files:**
- Create: `packages/dashboard/src/features/learning-graph/lib/knowledge-graph-view-model.ts`
- Create: `packages/dashboard/src/features/learning-graph/lib/__tests__/knowledge-graph-view-model.test.ts`

- [ ] **Step 1: Viết test fail cho mapping `completed/current/next/locked` và path edges**

```ts
import { describe, expect, it } from 'vitest';
import { buildKnowledgeGraphViewModel } from '../knowledge-graph-view-model';

const sessionId = '11111111-1111-1111-1111-111111111111';
const now = '2026-04-11T09:00:00.000Z';

const graph = {
  concepts: [
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      sessionId,
      canonicalName: 'variables',
      displayName: 'Variables',
      description: 'Lưu giá trị để dùng lại',
      difficulty: 0.25,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      sessionId,
      canonicalName: 'functions',
      displayName: 'Functions',
      description: 'Gom logic thành khối tái sử dụng',
      difficulty: 0.45,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      sessionId,
      canonicalName: 'closures',
      displayName: 'Closures',
      description: 'Giữ được context lexical',
      difficulty: 0.8,
      createdAt: now,
      updatedAt: now,
    },
  ],
  edges: [
    {
      id: 'edge-a-b',
      sessionId,
      fromConceptId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      toConceptId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      edgeType: 'prerequisite' as const,
      weight: 0.8,
      source: 'validation' as const,
      createdAt: now,
    },
    {
      id: 'edge-b-c',
      sessionId,
      fromConceptId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      toConceptId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      edgeType: 'prerequisite' as const,
      weight: 0.9,
      source: 'validation' as const,
      createdAt: now,
    },
  ],
};

const pathSnapshot = [
  {
    id: 'path-1',
    sessionId,
    conceptId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    pathVersion: 1,
    position: 0,
    pathState: 'completed' as const,
    isCurrent: false,
    supersededAt: null,
    createdAt: now,
  },
  {
    id: 'path-2',
    sessionId,
    conceptId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    pathVersion: 1,
    position: 1,
    pathState: 'current' as const,
    isCurrent: true,
    supersededAt: null,
    createdAt: now,
  },
  {
    id: 'path-3',
    sessionId,
    conceptId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    pathVersion: 1,
    position: 2,
    pathState: 'locked' as const,
    isCurrent: false,
    supersededAt: null,
    createdAt: now,
  },
];

describe('buildKnowledgeGraphViewModel', () => {
  it('maps path states into graph node states and generates path edges', () => {
    const result = buildKnowledgeGraphViewModel({
      graph,
      pathSnapshot,
      currentConceptId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      selectedConceptId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      mode: 'full',
      masteryByConceptId: {
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb': {
          sessionId,
          conceptId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          masteryScore: 0.62,
          lastQuizScore: 0.6,
          attemptCount: 2,
          updatedAt: now,
        },
      },
    });

    expect(result.nodes.map((node) => [node.id, node.state])).toEqual([
      ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'completed'],
      ['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'current'],
      ['cccccccc-cccc-cccc-cccc-cccccccccccc', 'locked'],
    ]);
    expect(result.edges.filter((edge) => edge.kind === 'path')).toHaveLength(2);
    expect(result.selectedNode?.missingPrerequisiteIds).toEqual([
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    ]);
  });

  it('filters canvas down to path nodes in path-only mode', () => {
    const result = buildKnowledgeGraphViewModel({
      graph,
      pathSnapshot: pathSnapshot.slice(0, 2),
      currentConceptId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      selectedConceptId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      mode: 'path',
      masteryByConceptId: {},
    });

    expect(result.nodes.map((node) => node.id)).toEqual([
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    ]);
    expect(result.edges.every((edge) => edge.kind === 'path')).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận module mới chưa tồn tại**

Run: `cd packages/dashboard && npx vitest run src/features/learning-graph/lib/__tests__/knowledge-graph-view-model.test.ts`
Expected: FAIL with `Cannot find module '../knowledge-graph-view-model'`

- [ ] **Step 3: Viết `knowledge-graph-view-model.ts` với helpers cho node state, level, path edges, và locked reasons**

```ts
import type {
  GetLearningGraphResponseSchema,
  SessionConceptMasterySchema,
  SessionPathItemSchema,
} from '@insforge/shared-schemas';

export type KnowledgeGraphMode = 'full' | 'path';
export type KnowledgeGraphNodeState =
  | 'completed'
  | 'current'
  | 'next'
  | 'upcoming'
  | 'locked'
  | 'untracked';

export interface KnowledgeGraphRenderNode {
  id: string;
  label: string;
  description: string;
  difficulty: number;
  masteryScore: number | null;
  state: KnowledgeGraphNodeState;
  level: number;
  order: number;
  selected: boolean;
  missingPrerequisiteIds: string[];
}

export interface KnowledgeGraphRenderEdge {
  id: string;
  source: string;
  target: string;
  kind: 'prerequisite' | 'path';
  muted: boolean;
  highlighted: boolean;
}

export interface KnowledgeGraphViewModel {
  nodes: KnowledgeGraphRenderNode[];
  edges: KnowledgeGraphRenderEdge[];
  selectedNode: KnowledgeGraphRenderNode | null;
  summary: {
    completedCount: number;
    totalCount: number;
    currentConceptId: string | null;
    nextConceptId: string | null;
  };
}

function getNodeState(
  pathItem: SessionPathItemSchema | undefined,
  currentConceptId: string | null | undefined
): KnowledgeGraphNodeState {
  if (!pathItem) return 'untracked';
  if (pathItem.pathState === 'current' || pathItem.conceptId === currentConceptId) return 'current';
  return pathItem.pathState;
}

function computeLevels(conceptIds: string[], edges: GetLearningGraphResponseSchema['edges']) {
  const incoming = new Map<string, string[]>();
  for (const conceptId of conceptIds) incoming.set(conceptId, []);
  for (const edge of edges) incoming.get(edge.toConceptId)?.push(edge.fromConceptId);

  const cache = new Map<string, number>();
  const visit = (conceptId: string): number => {
    if (cache.has(conceptId)) return cache.get(conceptId)!;
    const parents = incoming.get(conceptId) ?? [];
    const level = parents.length === 0 ? 0 : Math.max(...parents.map(visit)) + 1;
    cache.set(conceptId, level);
    return level;
  };

  for (const conceptId of conceptIds) visit(conceptId);
  return cache;
}

export function buildKnowledgeGraphViewModel(input: {
  graph: GetLearningGraphResponseSchema;
  pathSnapshot: SessionPathItemSchema[];
  currentConceptId?: string | null;
  selectedConceptId?: string | null;
  mode: KnowledgeGraphMode;
  masteryByConceptId: Record<string, SessionConceptMasterySchema>;
}): KnowledgeGraphViewModel {
  const pathItemByConceptId = new Map(input.pathSnapshot.map((item) => [item.conceptId, item]));
  const pathPositionByConceptId = new Map(input.pathSnapshot.map((item) => [item.conceptId, item.position]));
  const visibleConceptIds =
    input.mode === 'path'
      ? new Set(input.pathSnapshot.map((item) => item.conceptId))
      : new Set(input.graph.concepts.map((concept) => concept.id));
  const visibleEdges =
    input.mode === 'path'
      ? input.pathSnapshot.slice(0, -1).map((item, index) => ({
          id: `path-${item.conceptId}-${input.pathSnapshot[index + 1]!.conceptId}`,
          source: item.conceptId,
          target: input.pathSnapshot[index + 1]!.conceptId,
          kind: 'path' as const,
          muted: false,
          highlighted: true,
        }))
      : [
          ...input.graph.edges
            .filter(
              (edge) => visibleConceptIds.has(edge.fromConceptId) && visibleConceptIds.has(edge.toConceptId)
            )
            .map((edge) => ({
              id: edge.id,
              source: edge.fromConceptId,
              target: edge.toConceptId,
              kind: 'prerequisite' as const,
              muted: pathItemByConceptId.get(edge.toConceptId)?.pathState === 'locked',
              highlighted: false,
            })),
          ...input.pathSnapshot.slice(0, -1).map((item, index) => ({
            id: `path-${item.conceptId}-${input.pathSnapshot[index + 1]!.conceptId}`,
            source: item.conceptId,
            target: input.pathSnapshot[index + 1]!.conceptId,
            kind: 'path' as const,
            muted: false,
            highlighted: true,
          })),
        ];

  const levelByConceptId = computeLevels([...visibleConceptIds], input.graph.edges);

  const nodes = input.graph.concepts
    .filter((concept) => visibleConceptIds.has(concept.id))
    .map((concept) => {
      const pathItem = pathItemByConceptId.get(concept.id);
      const missingPrerequisiteIds = input.graph.edges
        .filter((edge) => edge.toConceptId === concept.id)
        .map((edge) => edge.fromConceptId)
        .filter((fromConceptId) => pathItemByConceptId.get(fromConceptId)?.pathState !== 'completed');

      return {
        id: concept.id,
        label: concept.displayName,
        description: concept.description,
        difficulty: concept.difficulty,
        masteryScore: input.masteryByConceptId[concept.id]?.masteryScore ?? null,
        state: getNodeState(pathItem, input.currentConceptId),
        level: levelByConceptId.get(concept.id) ?? 0,
        order: pathPositionByConceptId.get(concept.id) ?? Number.MAX_SAFE_INTEGER,
        selected: concept.id === input.selectedConceptId,
        missingPrerequisiteIds,
      };
    })
    .sort((left, right) => left.level - right.level || left.order - right.order || left.label.localeCompare(right.label));

  return {
    nodes,
    edges: visibleEdges,
    selectedNode: nodes.find((node) => node.id === input.selectedConceptId) ?? null,
    summary: {
      completedCount: input.pathSnapshot.filter((item) => item.pathState === 'completed').length,
      totalCount: input.pathSnapshot.length,
      currentConceptId: input.currentConceptId ?? null,
      nextConceptId: input.pathSnapshot.find((item) => item.pathState === 'next')?.conceptId ?? null,
    },
  };
}
```

- [ ] **Step 4: Chạy lại test để xác nhận logic pass**

Run: `cd packages/dashboard && npx vitest run src/features/learning-graph/lib/__tests__/knowledge-graph-view-model.test.ts`
Expected: PASS with `2 passed`

- [ ] **Step 5: Commit lớp view-model trước khi động vào UI**

```bash
git add packages/dashboard/src/features/learning-graph/lib/knowledge-graph-view-model.ts packages/dashboard/src/features/learning-graph/lib/__tests__/knowledge-graph-view-model.test.ts
git commit -m "feat: add learning graph view model"
```

## Task 2: Dựng React Flow primitives cho node, edge, canvas, và detail panel

**Files:**
- Create: `packages/dashboard/src/features/learning-graph/components/KnowledgeGraphCanvas.tsx`
- Create: `packages/dashboard/src/features/learning-graph/components/KnowledgeGraphNode.tsx`
- Create: `packages/dashboard/src/features/learning-graph/components/KnowledgeGraphEdge.tsx`
- Create: `packages/dashboard/src/features/learning-graph/components/KnowledgeGraphDetailPanel.tsx`

- [ ] **Step 1: Tạo `KnowledgeGraphNode.tsx` với state classes, difficulty ring, mastery ring, và badges**

```tsx
import { Check, Lock } from 'lucide-react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { KnowledgeGraphRenderNode } from '../lib/knowledge-graph-view-model';

const nodeStateStyles = {
  completed: 'border-emerald-400/40 bg-emerald-500/[0.14] text-emerald-50',
  current: 'border-sky-300/70 bg-sky-500/[0.18] text-white shadow-[0_0_40px_rgba(56,189,248,0.22)] scale-[1.08]',
  next: 'border-cyan-300/50 bg-cyan-500/[0.12] text-cyan-50',
  upcoming: 'border-[var(--alpha-8)] bg-[var(--alpha-4)] text-foreground',
  locked: 'border-[var(--alpha-8)] bg-[var(--alpha-2)] text-muted-foreground opacity-60',
  untracked: 'border-[var(--alpha-8)] bg-[var(--alpha-2)] text-muted-foreground opacity-75',
} as const;

export function KnowledgeGraphNode({ data }: NodeProps<KnowledgeGraphRenderNode>) {
  const mastery = data.masteryScore ?? 0;
  const difficultyAngle = Math.max(8, Math.round(data.difficulty * 360));

  return (
    <div className={`relative min-w-[220px] rounded-[24px] border px-4 py-4 transition-all duration-150 ${nodeStateStyles[data.state]}`}>
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-0 !bg-transparent" isConnectable={false} />
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-0 !bg-transparent" isConnectable={false} />

      <div
        className="pointer-events-none absolute inset-0 rounded-[24px]"
        style={{
          background: `conic-gradient(from 180deg, rgba(250,204,21,0.55) 0deg ${difficultyAngle}deg, transparent ${difficultyAngle}deg 360deg)`,
          maskImage: 'radial-gradient(circle at center, transparent 62%, black 64%)',
        }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-current/70">
            Concept
          </p>
          <h3 className="text-sm font-semibold leading-5">{data.label}</h3>
        </div>
        {data.state === 'completed' ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-400/20">
            <Check className="h-4 w-4" />
          </span>
        ) : data.state === 'locked' ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <Lock className="h-4 w-4" />
          </span>
        ) : null}
      </div>

      <div className="relative mt-4 flex items-center justify-between text-[11px]">
        <span className="rounded-full border border-white/10 px-2 py-1">
          {data.state === 'current' ? 'Đang học' : data.state === 'next' ? 'Tiếp theo' : data.state}
        </span>
        {data.masteryScore !== null ? <span>Mastery {Math.round(mastery * 100)}%</span> : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Tạo `KnowledgeGraphEdge.tsx` để tách style giữa prerequisite edge và path edge**

```tsx
import {
  BaseEdge,
  MarkerType,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';

interface KnowledgeGraphEdgeData {
  kind: 'prerequisite' | 'path';
  muted: boolean;
  highlighted: boolean;
}

export function KnowledgeGraphEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<KnowledgeGraphEdgeData>) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: data?.kind === 'path' ? 0.18 : 0.24,
  });

  const stroke =
    data?.kind === 'path'
      ? 'rgba(103,232,249,0.95)'
      : data?.muted
        ? 'rgba(148,163,184,0.18)'
        : 'rgba(148,163,184,0.42)';

  return (
    <BaseEdge
      path={edgePath}
      markerEnd={MarkerType.ArrowClosed}
      style={{
        stroke,
        strokeWidth: data?.kind === 'path' ? 3 : 1.5,
        filter: data?.kind === 'path' ? 'drop-shadow(0 0 12px rgba(103,232,249,0.28))' : 'none',
      }}
    />
  );
}
```

- [ ] **Step 3: Tạo `KnowledgeGraphCanvas.tsx` với React Flow, fitView, background, và node click**

```tsx
import { useEffect, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { KnowledgeGraphNode } from './KnowledgeGraphNode';
import { KnowledgeGraphEdge } from './KnowledgeGraphEdge';
import type { KnowledgeGraphViewModel } from '../lib/knowledge-graph-view-model';

const nodeTypes = { knowledgeConcept: KnowledgeGraphNode };
const edgeTypes = { knowledgeEdge: KnowledgeGraphEdge };

function FitToGraph({ nodeCount }: { nodeCount: number }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (nodeCount > 0) {
      window.requestAnimationFrame(() => {
        void fitView({ padding: 0.18, duration: 350, maxZoom: 1.25 });
      });
    }
  }, [fitView, nodeCount]);

  return null;
}

export function KnowledgeGraphCanvas(props: {
  viewModel: KnowledgeGraphViewModel;
  onSelectNode: (conceptId: string) => void;
}) {
  const nodes = useMemo<Node[]>(
    () =>
      props.viewModel.nodes.map((node, index) => ({
        id: node.id,
        type: 'knowledgeConcept',
        position: {
          x: node.level * 320,
          y: (index % 4) * 180 + Math.floor(index / 4) * 20,
        },
        data: node,
        draggable: false,
        selectable: true,
      })),
    [props.viewModel.nodes]
  );

  const edges = useMemo<Edge[]>(
    () =>
      props.viewModel.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'knowledgeEdge',
        markerEnd: { type: MarkerType.ArrowClosed },
        selectable: false,
        data: edge,
      })),
    [props.viewModel.edges]
  );

  return (
    <div className="relative h-[620px] overflow-hidden rounded-[28px] border border-[var(--alpha-8)] bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))]">
      <ReactFlow
        fitView
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={0.55}
        maxZoom={1.6}
        nodesDraggable={false}
        onNodeClick={(_, node) => props.onSelectNode(node.id)}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1.4} color="rgba(148,163,184,0.18)" />
        <Controls showInteractive={false} />
        <FitToGraph nodeCount={nodes.length} />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 4: Tạo `KnowledgeGraphDetailPanel.tsx` để render summary mặc định và selected node detail**

```tsx
import { Button } from '@insforge/ui';
import { Lock, Sparkles } from 'lucide-react';
import type { KnowledgeGraphViewModel } from '../lib/knowledge-graph-view-model';

export function KnowledgeGraphDetailPanel(props: {
  viewModel: KnowledgeGraphViewModel;
  selectedConceptId: string | null;
  onOpenConcept: () => void;
}) {
  const selectedNode = props.viewModel.selectedNode;

  if (!selectedNode) {
    return (
      <aside className="rounded-[24px] border border-[var(--alpha-8)] bg-card/80 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Knowledge map
        </p>
        <h2 className="mt-2 text-xl font-semibold text-foreground">Bạn đang ở đâu</h2>
        <div className="mt-5 space-y-3 text-sm text-muted-foreground">
          <p>Đã hoàn thành {props.viewModel.summary.completedCount}/{props.viewModel.summary.totalCount} concept.</p>
          <p>Line mảnh là prerequisite. Line sáng là đường học đề xuất hiện tại.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="rounded-[24px] border border-[var(--alpha-8)] bg-card/90 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {selectedNode.state === 'current' ? 'Bạn đang ở đây' : 'Concept detail'}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">{selectedNode.label}</h2>
        </div>
        {selectedNode.state === 'locked' ? <Lock className="h-5 w-5 text-amber-300" /> : <Sparkles className="h-5 w-5 text-sky-300" />}
      </div>

      <p className="mt-4 text-sm leading-6 text-muted-foreground">{selectedNode.description}</p>
      {selectedNode.missingPrerequisiteIds.length > 0 ? (
        <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm text-amber-100">
          Cần hoàn thành trước: {selectedNode.missingPrerequisiteIds.length} prerequisite trực tiếp.
        </div>
      ) : null}

      <div className="mt-6">
        <Button type="button" className="w-full" onClick={props.onOpenConcept} disabled={!props.selectedConceptId}>
          Đi tới bài học này
        </Button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 5: Chạy typecheck để xác nhận primitives mới khớp types của React Flow**

Run: `cd packages/dashboard && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit primitives React Flow**

```bash
git add packages/dashboard/src/features/learning-graph/components/KnowledgeGraphCanvas.tsx packages/dashboard/src/features/learning-graph/components/KnowledgeGraphNode.tsx packages/dashboard/src/features/learning-graph/components/KnowledgeGraphEdge.tsx packages/dashboard/src/features/learning-graph/components/KnowledgeGraphDetailPanel.tsx
git commit -m "feat: add learning graph canvas primitives"
```

## Task 3: Tích hợp shell mới vào page hiện tại, thêm toggle, loading, empty, error, và responsive layout

**Files:**
- Modify: `packages/dashboard/src/features/learning-graph/pages/KnowledgeGraphPage.tsx`
- Modify: `packages/dashboard/src/features/learning-graph/components/KnowledgeGraphPanel.tsx`
- Modify: `packages/dashboard/src/features/learning-graph/components/index.ts`

- [ ] **Step 1: Cập nhật `KnowledgeGraphPage.tsx` để lấy thêm session overview và truyền props vào panel**

```tsx
import { useNavigate, useParams } from 'react-router-dom';
import { KnowledgeGraphPanel } from '../components';
import { useConceptLearning } from '../hooks/useConceptLearning';
import { useLearningSessions } from '../hooks/useLearningSessions';

export default function KnowledgeGraphPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { graph, isLoadingGraph } = useConceptLearning(sessionId);
  const { session, pathSnapshot, currentConcept, progress, isLoading } = useLearningSessions(sessionId);

  return (
    <KnowledgeGraphPanel
      sessionId={sessionId ?? ''}
      sessionTitle={session?.goalTitle ?? 'Đồ thị kiến thức'}
      progress={progress}
      currentConceptId={currentConcept?.id ?? session?.currentConceptId ?? null}
      graph={graph}
      pathSnapshot={pathSnapshot}
      isLoading={isLoadingGraph || isLoading}
      onBack={() => navigate(`/dashboard/learning-graph/sessions/${sessionId ?? ''}/overview`)}
      onOpenConcept={(conceptId) =>
        navigate(`/dashboard/learning-graph/sessions/${sessionId ?? ''}/concepts/${conceptId}`)
      }
    />
  );
}
```

- [ ] **Step 2: Viết lại `KnowledgeGraphPanel.tsx` thành shell có header, mode toggle, selected node state, và view-model**

```tsx
import { Button, Switch } from '@insforge/ui';
import { useMemo, useState } from 'react';
import type { GetLearningGraphResponseSchema, SessionPathItemSchema } from '@insforge/shared-schemas';
import { KnowledgeGraphCanvas } from './KnowledgeGraphCanvas';
import { KnowledgeGraphDetailPanel } from './KnowledgeGraphDetailPanel';
import {
  buildKnowledgeGraphViewModel,
  type KnowledgeGraphMode,
} from '../lib/knowledge-graph-view-model';

interface KnowledgeGraphPanelProps {
  sessionId: string;
  sessionTitle: string;
  progress: { completedCount: number; totalCount: number };
  currentConceptId: string | null;
  graph: GetLearningGraphResponseSchema;
  pathSnapshot: SessionPathItemSchema[];
  isLoading: boolean;
  onBack: () => void;
  onOpenConcept: (conceptId: string) => void;
}

export function KnowledgeGraphPanel(props: KnowledgeGraphPanelProps) {
  const [mode, setMode] = useState<KnowledgeGraphMode>('full');
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(props.currentConceptId);

  const viewModel = useMemo(
    () =>
      buildKnowledgeGraphViewModel({
        graph: props.graph,
        pathSnapshot: props.pathSnapshot,
        currentConceptId: props.currentConceptId,
        selectedConceptId,
        mode,
        masteryByConceptId: {},
      }),
    [props.currentConceptId, props.graph, props.pathSnapshot, selectedConceptId, mode]
  );

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 rounded-[24px] border border-[var(--alpha-8)] bg-card/70 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Knowledge map</p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">{props.sessionTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {props.progress.completedCount}/{props.progress.totalCount} concept đã hoàn thành
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 rounded-full border border-[var(--alpha-8)] px-3 py-2 text-sm text-foreground">
            <span>Toàn bộ graph</span>
            <Switch
              checked={mode === 'path'}
              onCheckedChange={(checked) => setMode(checked ? 'path' : 'full')}
              size="sm"
              aria-label="Toggle path-only mode"
            />
            <span>Chỉ đường học đề xuất</span>
          </div>
          <Button type="button" variant="outline" onClick={props.onBack}>
            Về tổng quan
          </Button>
        </div>
      </header>
```

- [ ] **Step 3: Thêm loading, empty, error shell và responsive `canvas + panel` layout ngay trong `KnowledgeGraphPanel.tsx`**

```tsx
      {props.isLoading ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="h-[620px] rounded-[28px] border border-[var(--alpha-8)] bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-6">
            <div className="grid h-full place-items-center rounded-[22px] border border-dashed border-white/10 text-sm text-slate-300">
              Đang dựng knowledge map...
            </div>
          </div>
          <KnowledgeGraphDetailPanel
            viewModel={viewModel}
            selectedConceptId={null}
            onOpenConcept={() => undefined}
          />
        </div>
      ) : viewModel.nodes.length === 0 ? (
        <div className="rounded-[28px] border border-[var(--alpha-8)] bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Chưa có graph để hiển thị</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Session này chưa có concept hoặc quan hệ prerequisite để trực quan hóa.
          </p>
          <div className="mt-4">
            <Button type="button" variant="outline" onClick={props.onBack}>
              Về tổng quan
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <KnowledgeGraphCanvas viewModel={viewModel} onSelectNode={setSelectedConceptId} />
          <KnowledgeGraphDetailPanel
            viewModel={viewModel}
            selectedConceptId={selectedConceptId}
            onOpenConcept={() => selectedConceptId && props.onOpenConcept(selectedConceptId)}
          />
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Export các component mới qua barrel `components/index.ts`**

```ts
export * from './KnowledgeGraphPanel';
export * from './KnowledgeGraphCanvas';
export * from './KnowledgeGraphNode';
export * from './KnowledgeGraphEdge';
export * from './KnowledgeGraphDetailPanel';
```

- [ ] **Step 5: Chạy verification đầy đủ cho feature**

Run: `cd packages/dashboard && npx vitest run src/features/learning-graph/lib/__tests__/knowledge-graph-view-model.test.ts && npm run typecheck && npm run build`
Expected: PASS for Vitest, `tsc --noEmit`, and Vite library build

- [ ] **Step 6: Chạy build shell frontend để xác nhận dashboard package vẫn nhúng được**

Run: `cd frontend && npm run build`
Expected: PASS

- [ ] **Step 7: Commit integration Graph View**

```bash
git add packages/dashboard/src/features/learning-graph/pages/KnowledgeGraphPage.tsx packages/dashboard/src/features/learning-graph/components/KnowledgeGraphPanel.tsx packages/dashboard/src/features/learning-graph/components/index.ts
git add packages/dashboard/src/features/learning-graph/components/KnowledgeGraphCanvas.tsx packages/dashboard/src/features/learning-graph/components/KnowledgeGraphNode.tsx packages/dashboard/src/features/learning-graph/components/KnowledgeGraphEdge.tsx packages/dashboard/src/features/learning-graph/components/KnowledgeGraphDetailPanel.tsx
git add packages/dashboard/src/features/learning-graph/lib/knowledge-graph-view-model.ts packages/dashboard/src/features/learning-graph/lib/__tests__/knowledge-graph-view-model.test.ts
git commit -m "feat: redesign learning graph knowledge map"
```

## Self-Review

- Spec coverage:
  - `knowledge map thật sự`: covered by Task 2 canvas/node/edge primitives and Task 3 panel integration.
  - `current/completed/next/locked`: covered by Task 1 state mapping tests and Task 2 node visuals.
  - `recommended path highlight`: covered by Task 1 path-edge generation and Task 2 edge styling.
  - `toggle toàn bộ graph / chỉ đường học`: covered by Task 3 shell toggle.
  - `side panel chi tiết`: covered by Task 2 detail panel and Task 3 responsive layout.
  - `loading/empty/error`: covered by Task 3 shell states.
- Placeholder scan: Không dùng `TODO`, `TBD`, hay bước “implement later”; mỗi task có file, code, command, expected result, và commit.
- Type consistency:
  - plan dùng nhất quán các tên `KnowledgeGraphMode`, `KnowledgeGraphRenderNode`, `KnowledgeGraphRenderEdge`, `buildKnowledgeGraphViewModel`
  - `path` mode luôn là `'path'`, `full` mode luôn là `'full'`
  - current concept action luôn đi qua `onOpenConcept(selectedConceptId)`
