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
  missingPrerequisiteLabels: string[];
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
    currentConceptLabel: string | null;
    nextConceptId: string | null;
    nextConceptLabel: string | null;
  };
}

function getNodeState(
  pathItem: SessionPathItemSchema | undefined,
  currentConceptId: string | null | undefined
): KnowledgeGraphNodeState {
  if (!pathItem) {
    return 'untracked';
  }

  if (pathItem.pathState === 'current' || pathItem.conceptId === currentConceptId) {
    return 'current';
  }

  return pathItem.pathState;
}

function computeLevels(conceptIds: string[], edges: GetLearningGraphResponseSchema['edges']) {
  const incomingByConceptId = new Map<string, string[]>();
  const cachedLevels = new Map<string, number>();
  const active = new Set<string>();

  for (const conceptId of conceptIds) {
    incomingByConceptId.set(conceptId, []);
  }

  for (const edge of edges) {
    if (!incomingByConceptId.has(edge.toConceptId) || !incomingByConceptId.has(edge.fromConceptId)) {
      continue;
    }

    incomingByConceptId.get(edge.toConceptId)?.push(edge.fromConceptId);
  }

  const visit = (conceptId: string): number => {
    const cached = cachedLevels.get(conceptId);
    if (cached !== undefined) {
      return cached;
    }

    if (active.has(conceptId)) {
      return 0;
    }

    active.add(conceptId);
    const parents = incomingByConceptId.get(conceptId) ?? [];
    const level = parents.length === 0 ? 0 : Math.max(...parents.map(visit)) + 1;
    active.delete(conceptId);
    cachedLevels.set(conceptId, level);
    return level;
  };

  for (const conceptId of conceptIds) {
    visit(conceptId);
  }

  return cachedLevels;
}

function buildPathEdges(pathSnapshot: SessionPathItemSchema[]): KnowledgeGraphRenderEdge[] {
  return pathSnapshot.slice(0, -1).map((item, index) => ({
    id: `path-${item.conceptId}-${pathSnapshot[index + 1]!.conceptId}`,
    source: item.conceptId,
    target: pathSnapshot[index + 1]!.conceptId,
    kind: 'path' as const,
    muted: false,
    highlighted: true,
  }));
}

export function buildKnowledgeGraphViewModel(input: {
  graph: GetLearningGraphResponseSchema;
  pathSnapshot: SessionPathItemSchema[];
  currentConceptId?: string | null;
  selectedConceptId?: string | null;
  mode: KnowledgeGraphMode;
  masteryByConceptId: Record<string, SessionConceptMasterySchema>;
}): KnowledgeGraphViewModel {
  const conceptById = new Map(input.graph.concepts.map((concept) => [concept.id, concept]));
  const pathItemByConceptId = new Map(input.pathSnapshot.map((item) => [item.conceptId, item]));
  const pathPositionByConceptId = new Map(input.pathSnapshot.map((item) => [item.conceptId, item.position]));
  const visibleConceptIds =
    input.mode === 'path'
      ? new Set(input.pathSnapshot.map((item) => item.conceptId))
      : new Set(input.graph.concepts.map((concept) => concept.id));
  const pathEdges = buildPathEdges(input.pathSnapshot).filter(
    (edge) => visibleConceptIds.has(edge.source) && visibleConceptIds.has(edge.target)
  );
  const prerequisiteEdges =
    input.mode === 'path'
      ? []
      : input.graph.edges
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
          }));
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
        missingPrerequisiteLabels: missingPrerequisiteIds.map(
          (prerequisiteId) => conceptById.get(prerequisiteId)?.displayName ?? prerequisiteId
        ),
      };
    })
    .sort(
      (left, right) =>
        left.level - right.level || left.order - right.order || left.label.localeCompare(right.label)
    );

  const currentConcept = input.currentConceptId ? conceptById.get(input.currentConceptId) ?? null : null;
  const nextPathItem = input.pathSnapshot.find((item) => item.pathState === 'next') ?? null;
  const nextConcept = nextPathItem ? conceptById.get(nextPathItem.conceptId) ?? null : null;

  return {
    nodes,
    edges: [...prerequisiteEdges, ...pathEdges],
    selectedNode: nodes.find((node) => node.id === input.selectedConceptId) ?? null,
    summary: {
      completedCount: input.pathSnapshot.filter((item) => item.pathState === 'completed').length,
      totalCount: input.pathSnapshot.length,
      currentConceptId: currentConcept?.id ?? input.currentConceptId ?? null,
      currentConceptLabel: currentConcept?.displayName ?? null,
      nextConceptId: nextConcept?.id ?? null,
      nextConceptLabel: nextConcept?.displayName ?? null,
    },
  };
}
