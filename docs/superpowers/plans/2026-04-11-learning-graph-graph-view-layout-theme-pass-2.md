# Learning Graph Graph View Layout And Theme Pass 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa Graph View để canvas rộng hơn, detail panel mặc định thu gọn, node không dính cụm trong graph nhiều nhánh, và giao diện hoạt động tốt ở cả light/dark theme.

**Architecture:** Giữ nguyên source of truth từ `graph`, `pathSnapshot`, và `currentConcept`, nhưng nâng cấp layout layer của canvas theo hướng `layering + in-column ordering + collision resolution`. `KnowledgeGraphPanel` sẽ đổi từ layout hai cột cố định sang `wide canvas + collapsible detail rail`; `KnowledgeGraphCanvas`, `KnowledgeGraphNode`, `KnowledgeGraphEdge`, và `KnowledgeGraphDetailPanel` sẽ nhận theme-aware tokens để render đúng theo `resolvedTheme`.

**Tech Stack:** React 19, TypeScript, `@xyflow/react`, Tailwind utility classes, dashboard `ThemeContext`, Vitest

---

## File Structure

- Modify: `packages/dashboard/src/features/learning-graph/components/KnowledgeGraphPanel.tsx`
  Responsibility: đổi desktop layout sang `canvas first`, thêm trạng thái rail/panel mở rộng, và giữ panel không chiếm diện tích khi chưa chọn node.
- Modify: `packages/dashboard/src/features/learning-graph/components/KnowledgeGraphCanvas.tsx`
  Responsibility: bỏ chiều cao cứng, tăng viewport, áp dụng collision-aware node layout, và làm fit behavior ít gây giật hơn khi panel mở/đóng.
- Modify: `packages/dashboard/src/features/learning-graph/components/KnowledgeGraphNode.tsx`
  Responsibility: chuyển styling sang token-based để hỗ trợ cả light/dark theme, đồng thời cải thiện kích thước/spacing để node đỡ chật.
- Modify: `packages/dashboard/src/features/learning-graph/components/KnowledgeGraphEdge.tsx`
  Responsibility: đổi màu edge theo theme và tinh chỉnh curve/opacity cho graph nhiều nhánh.
- Modify: `packages/dashboard/src/features/learning-graph/components/KnowledgeGraphDetailPanel.tsx`
  Responsibility: hỗ trợ trạng thái `collapsed rail`, panel mở ra khi chọn node, và styling phù hợp với cả light/dark theme.
- Modify: `packages/dashboard/src/features/learning-graph/lib/knowledge-graph-view-model.ts`
  Responsibility: bổ sung metadata layout như `branchWeight`, `incomingCount`, `outgoingCount`, hoặc ordering keys cần cho anti-overlap pass.
- Create: `packages/dashboard/src/features/learning-graph/lib/knowledge-graph-theme.ts`
  Responsibility: định nghĩa graph theme tokens cho light/dark mode.
- Modify: `packages/dashboard/src/features/learning-graph/lib/__tests__/knowledge-graph-view-model.test.ts`
  Responsibility: mở rộng test để khóa ordering/layout metadata cho graph nhiều nhánh.

## Task 1: Mở rộng view-model để phục vụ anti-overlap layout

**Files:**
- Modify: `packages/dashboard/src/features/learning-graph/lib/knowledge-graph-view-model.ts`
- Modify: `packages/dashboard/src/features/learning-graph/lib/__tests__/knowledge-graph-view-model.test.ts`

- [ ] **Step 1: Thêm test fail cho graph nhiều nhánh để khóa ordering trong cùng một level**

```ts
it('prioritizes branch ordering so path nodes stay near the center of a level', () => {
  const branchedGraph = {
    concepts: [
      buildConcept('root', 'Root'),
      buildConcept('a', 'Branch A'),
      buildConcept('b', 'Branch B'),
      buildConcept('merge', 'Merge Node'),
    ],
    edges: [
      buildEdge('root', 'a'),
      buildEdge('root', 'b'),
      buildEdge('a', 'merge'),
      buildEdge('b', 'merge'),
    ],
  };

  const result = buildKnowledgeGraphViewModel({
    graph: branchedGraph,
    pathSnapshot: [
      buildPathItem('root', 0, 'completed'),
      buildPathItem('a', 1, 'current'),
      buildPathItem('merge', 2, 'next'),
    ],
    currentConceptId: 'a',
    selectedConceptId: 'merge',
    mode: 'full',
    masteryByConceptId: {},
  });

  const levelOneNodes = result.nodes.filter((node) => node.level === 1);
  expect(levelOneNodes.map((node) => [node.id, node.orderGroup])).toEqual([
    ['a', 'path'],
    ['b', 'branch'],
  ]);
});
```

- [ ] **Step 2: Chạy test để xác nhận field mới chưa tồn tại**

Run: `cd packages/dashboard && npx vitest run src/features/learning-graph/lib/__tests__/knowledge-graph-view-model.test.ts`
Expected: FAIL with a type or expectation error mentioning `orderGroup`

- [ ] **Step 3: Mở rộng render model với metadata layout**

```ts
export interface KnowledgeGraphRenderNode {
  id: string;
  label: string;
  description: string;
  difficulty: number;
  masteryScore: number | null;
  state: KnowledgeGraphNodeState;
  level: number;
  order: number;
  orderGroup: 'path' | 'branch' | 'untracked';
  incomingCount: number;
  outgoingCount: number;
  selected: boolean;
  missingPrerequisiteIds: string[];
  missingPrerequisiteLabels: string[];
}
```

- [ ] **Step 4: Tính `incomingCount`, `outgoingCount`, và `orderGroup` trong `buildKnowledgeGraphViewModel`**

```ts
const incomingCountByConceptId = new Map<string, number>();
const outgoingCountByConceptId = new Map<string, number>();

for (const concept of input.graph.concepts) {
  incomingCountByConceptId.set(concept.id, 0);
  outgoingCountByConceptId.set(concept.id, 0);
}

for (const edge of input.graph.edges) {
  incomingCountByConceptId.set(
    edge.toConceptId,
    (incomingCountByConceptId.get(edge.toConceptId) ?? 0) + 1
  );
  outgoingCountByConceptId.set(
    edge.fromConceptId,
    (outgoingCountByConceptId.get(edge.fromConceptId) ?? 0) + 1
  );
}

const orderGroup: KnowledgeGraphRenderNode['orderGroup'] =
  pathPositionByConceptId.has(concept.id) ? 'path' : pathItem ? 'branch' : 'untracked';
```

- [ ] **Step 5: Cập nhật sort để path node nằm gần trung tâm cột**

```ts
.sort((left, right) => {
  const groupRank = { path: 0, branch: 1, untracked: 2 };
  return (
    left.level - right.level ||
    groupRank[left.orderGroup] - groupRank[right.orderGroup] ||
    right.outgoingCount - left.outgoingCount ||
    left.order - right.order ||
    left.label.localeCompare(right.label)
  );
});
```

- [ ] **Step 6: Chạy lại test để xác nhận view-model pass**

Run: `cd packages/dashboard && npx vitest run src/features/learning-graph/lib/__tests__/knowledge-graph-view-model.test.ts`
Expected: PASS

- [ ] **Step 7: Commit phần view-model**

```bash
git add packages/dashboard/src/features/learning-graph/lib/knowledge-graph-view-model.ts packages/dashboard/src/features/learning-graph/lib/__tests__/knowledge-graph-view-model.test.ts
git commit -m "feat: improve learning graph layout metadata"
```

## Task 2: Thêm graph theme tokens cho light/dark mode

**Files:**
- Create: `packages/dashboard/src/features/learning-graph/lib/knowledge-graph-theme.ts`
- Modify: `packages/dashboard/src/features/learning-graph/components/KnowledgeGraphCanvas.tsx`
- Modify: `packages/dashboard/src/features/learning-graph/components/KnowledgeGraphNode.tsx`
- Modify: `packages/dashboard/src/features/learning-graph/components/KnowledgeGraphEdge.tsx`
- Modify: `packages/dashboard/src/features/learning-graph/components/KnowledgeGraphDetailPanel.tsx`

- [ ] **Step 1: Tạo helper graph theme tokens**

```ts
export interface KnowledgeGraphThemeTokens {
  canvasBg: string;
  canvasGlow: string;
  dotColor: string;
  legendBg: string;
  panelBg: string;
  railBg: string;
  textPrimary: string;
  textMuted: string;
  edgePrerequisite: string;
  edgeMuted: string;
  edgePath: string;
  currentGlow: string;
}

export function getKnowledgeGraphTheme(resolvedTheme: 'light' | 'dark'): KnowledgeGraphThemeTokens {
  if (resolvedTheme === 'light') {
    return {
      canvasBg: 'linear-gradient(180deg, rgba(248,250,252,0.98), rgba(241,245,249,0.98))',
      canvasGlow: 'radial-gradient(circle at top, rgba(14,165,233,0.10), transparent 58%)',
      dotColor: 'rgba(71,85,105,0.18)',
      legendBg: 'rgba(255,255,255,0.84)',
      panelBg: 'rgba(255,255,255,0.92)',
      railBg: 'rgba(255,255,255,0.88)',
      textPrimary: 'rgb(15,23,42)',
      textMuted: 'rgb(71,85,105)',
      edgePrerequisite: 'rgba(71,85,105,0.34)',
      edgeMuted: 'rgba(148,163,184,0.22)',
      edgePath: 'rgba(2,132,199,0.88)',
      currentGlow: '0 0 36px rgba(14,165,233,0.16)',
    };
  }

  return {
    canvasBg: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))',
    canvasGlow: 'radial-gradient(circle at top, rgba(56,189,248,0.14), transparent 58%)',
    dotColor: 'rgba(148,163,184,0.22)',
    legendBg: 'rgba(2,6,23,0.70)',
    panelBg: 'rgba(15,23,42,0.92)',
    railBg: 'rgba(15,23,42,0.86)',
    textPrimary: 'rgb(241,245,249)',
    textMuted: 'rgb(148,163,184)',
    edgePrerequisite: 'rgba(148,163,184,0.42)',
    edgeMuted: 'rgba(148,163,184,0.18)',
    edgePath: 'rgba(103,232,249,0.95)',
    currentGlow: '0 0 48px rgba(56,189,248,0.18)',
  };
}
```

- [ ] **Step 2: Đọc `resolvedTheme` trong canvas và truyền theme tokens xuống node/edge/panel**

```tsx
import { useTheme } from '../../../lib/contexts/ThemeContext';
import { getKnowledgeGraphTheme } from '../lib/knowledge-graph-theme';

const { resolvedTheme } = useTheme();
const graphTheme = useMemo(() => getKnowledgeGraphTheme(resolvedTheme), [resolvedTheme]);
```

- [ ] **Step 3: Thay hardcoded dark canvas bằng token-based inline styles**

```tsx
<div
  className="relative min-h-[72vh] overflow-hidden rounded-[28px] border border-[var(--alpha-8)]"
  style={{ background: graphTheme.canvasBg }}
>
  <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32" style={{ background: graphTheme.canvasGlow }} />
```

- [ ] **Step 4: Cập nhật `KnowledgeGraphNode`, `KnowledgeGraphEdge`, và `KnowledgeGraphDetailPanel` để đọc `theme` từ `data` hoặc props**

```tsx
data: {
  node,
  theme: graphTheme,
}
```

```tsx
const stroke =
  edge.kind === 'path'
    ? theme.edgePath
    : edge.muted
      ? theme.edgeMuted
      : theme.edgePrerequisite;
```

- [ ] **Step 5: Chạy typecheck**

Run: `cd packages/dashboard && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit theme-aware graph styling**

```bash
git add packages/dashboard/src/features/learning-graph/lib/knowledge-graph-theme.ts packages/dashboard/src/features/learning-graph/components/KnowledgeGraphCanvas.tsx packages/dashboard/src/features/learning-graph/components/KnowledgeGraphNode.tsx packages/dashboard/src/features/learning-graph/components/KnowledgeGraphEdge.tsx packages/dashboard/src/features/learning-graph/components/KnowledgeGraphDetailPanel.tsx
git commit -m "feat: add theme aware learning graph styling"
```

## Task 3: Làm canvas rộng hơn và detail panel mặc định thu gọn

**Files:**
- Modify: `packages/dashboard/src/features/learning-graph/components/KnowledgeGraphPanel.tsx`
- Modify: `packages/dashboard/src/features/learning-graph/components/KnowledgeGraphDetailPanel.tsx`

- [ ] **Step 1: Thêm state `isPanelOpen` vào `KnowledgeGraphPanel`**

```tsx
const [isPanelOpen, setIsPanelOpen] = useState(false);

useEffect(() => {
  if (selectedConceptId) {
    setIsPanelOpen(true);
  }
}, [selectedConceptId]);
```

- [ ] **Step 2: Đổi desktop layout từ `canvas + panel cố định` sang `wide canvas + collapsible rail`**

```tsx
<div
  className={cn(
    'grid gap-6',
    isPanelOpen
      ? 'xl:grid-cols-[minmax(0,1fr)_340px]'
      : 'xl:grid-cols-[minmax(0,1fr)_56px]'
  )}
>
  <KnowledgeGraphCanvas viewModel={viewModel} onSelectNode={setSelectedConceptId} />
  <KnowledgeGraphDetailPanel
    viewModel={viewModel}
    selectedConceptId={selectedConceptId}
    isOpen={isPanelOpen}
    onOpenChange={setIsPanelOpen}
    onOpenConcept={...}
  />
</div>
```

- [ ] **Step 3: Tạo rail mảnh khi panel đóng**

```tsx
if (!props.isOpen) {
  return (
    <aside className="hidden xl:flex xl:sticky xl:top-6 xl:h-[72vh] xl:items-center xl:justify-center">
      <button
        type="button"
        onClick={() => props.onOpenChange(true)}
        className="flex h-40 w-14 items-center justify-center rounded-[20px] border border-[var(--alpha-8)]"
      >
        <span className="rotate-180 [writing-mode:vertical-rl] text-xs font-semibold uppercase tracking-[0.18em]">
          Chi tiet
        </span>
      </button>
    </aside>
  );
}
```

- [ ] **Step 4: Khi đóng panel, không reset graph; chỉ đóng UI**

```tsx
<button
  type="button"
  onClick={() => props.onOpenChange(false)}
  className="..."
>
  Thu gon
</button>
```

- [ ] **Step 5: Chạy typecheck**

Run: `cd packages/dashboard && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit panel behavior**

```bash
git add packages/dashboard/src/features/learning-graph/components/KnowledgeGraphPanel.tsx packages/dashboard/src/features/learning-graph/components/KnowledgeGraphDetailPanel.tsx
git commit -m "feat: add collapsible learning graph detail rail"
```

## Task 4: Nới canvas và thêm anti-overlap node spacing

**Files:**
- Modify: `packages/dashboard/src/features/learning-graph/components/KnowledgeGraphCanvas.tsx`

- [ ] **Step 1: Bỏ chiều cao cứng và tăng viewport breathing room**

```tsx
<div
  className="relative min-h-[72vh] overflow-hidden rounded-[28px] border border-[var(--alpha-8)]"
  style={{ background: graphTheme.canvasBg }}
>
```

- [ ] **Step 2: Tách helper `buildCanvasNodes` thành các phase rõ ràng**

```ts
const columnGap = 420;
const baseRowGap = 220;
const nodeHeight = 140;

function resolveColumnPositions(nodesInLevel: KnowledgeGraphRenderNode[]) {
  return nodesInLevel.map((node, index) => ({
    node,
    y: index * (nodeHeight + baseRowGap),
  }));
}
```

- [ ] **Step 3: Thêm collision pass theo từng cột**

```ts
function resolveVerticalCollisions(
  items: Array<{ node: KnowledgeGraphRenderNode; y: number }>
) {
  const minGap = 42;
  const resolved = [...items].sort((left, right) => left.y - right.y);

  for (let index = 1; index < resolved.length; index += 1) {
    const previous = resolved[index - 1]!;
    const current = resolved[index]!;
    const nextAllowedY = previous.y + nodeHeight + minGap;

    if (current.y < nextAllowedY) {
      current.y = nextAllowedY;
    }
  }

  const firstY = resolved[0]?.y ?? 0;
  const lastY = resolved.at(-1)?.y ?? 0;
  const blockHeight = lastY - firstY;
  const recenterOffset = blockHeight / 2;

  return resolved.map((item) => ({ ...item, y: item.y - recenterOffset }));
}
```

- [ ] **Step 4: Cho path nodes nằm gần giữa cột, branch nodes xòe trên/dưới**

```ts
const pathNodes = siblings.filter((node) => node.orderGroup === 'path');
const branchNodes = siblings.filter((node) => node.orderGroup !== 'path');
const centeredOrder = [...branchNodes.slice(0, Math.ceil(branchNodes.length / 2)), ...pathNodes, ...branchNodes.slice(Math.ceil(branchNodes.length / 2))];
```

- [ ] **Step 5: Giảm fitView aggressiveness khi panel mở/đóng**

```tsx
void fitView({
  padding: 0.24,
  duration: 280,
  maxZoom: 1.1,
});
```

- [ ] **Step 6: Chạy verification đầy đủ**

Run: `cd packages/dashboard && npx vitest run src/features/learning-graph/lib/__tests__/knowledge-graph-view-model.test.ts && npm run typecheck && npm run build`
Expected: PASS

- [ ] **Step 7: Chạy build của frontend shell**

Run: `cd frontend && npm run build`
Expected: PASS

- [ ] **Step 8: Commit layout polish**

```bash
git add packages/dashboard/src/features/learning-graph/components/KnowledgeGraphCanvas.tsx packages/dashboard/src/features/learning-graph/components/KnowledgeGraphPanel.tsx packages/dashboard/src/features/learning-graph/components/KnowledgeGraphDetailPanel.tsx packages/dashboard/src/features/learning-graph/components/KnowledgeGraphNode.tsx packages/dashboard/src/features/learning-graph/components/KnowledgeGraphEdge.tsx packages/dashboard/src/features/learning-graph/lib/knowledge-graph-theme.ts packages/dashboard/src/features/learning-graph/lib/knowledge-graph-view-model.ts packages/dashboard/src/features/learning-graph/lib/__tests__/knowledge-graph-view-model.test.ts
git commit -m "feat: improve learning graph overview layout"
```

## Self-Review

- Spec coverage:
  - `panel mặc định thu gọn`: covered by Task 3.
  - `canvas rộng hơn / bỏ 620px`: covered by Task 4.
  - `node không dính nhau`: covered by Task 1 metadata + Task 4 collision pass.
  - `light/dark theme thật sự`: covered by Task 2 token system.
  - `không làm mất viewport khi panel đóng/mở`: covered by Task 3 and Task 4 fit behavior.
- Placeholder scan: Không dùng `TBD`, `TODO`, `implement later`, hay step mơ hồ; mỗi task có file, code, command, expected outcome, và commit.
- Type consistency:
  - dùng nhất quán các tên `KnowledgeGraphRenderNode`, `orderGroup`, `isPanelOpen`, `KnowledgeGraphThemeTokens`, `getKnowledgeGraphTheme`
  - behavior panel luôn đi qua `isOpen` / `onOpenChange`
  - theme luôn đi qua helper `getKnowledgeGraphTheme(resolvedTheme)`
