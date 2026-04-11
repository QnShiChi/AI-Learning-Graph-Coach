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
      description: 'Luu gia tri de dung lai',
      difficulty: 0.25,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      sessionId,
      canonicalName: 'functions',
      displayName: 'Functions',
      description: 'Gom logic thanh khoi tai su dung',
      difficulty: 0.45,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      sessionId,
      canonicalName: 'closures',
      displayName: 'Closures',
      description: 'Giu duoc lexical scope',
      difficulty: 0.8,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      sessionId,
      canonicalName: 'async-await',
      displayName: 'Async Await',
      description: 'Dieu phoi bat dong bo de doc hon',
      difficulty: 0.68,
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
    {
      id: 'edge-b-d',
      sessionId,
      fromConceptId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      toConceptId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      edgeType: 'prerequisite' as const,
      weight: 0.7,
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
  it('maps path states, levels, and locked prerequisite reasons', () => {
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

    expect(result.nodes.map((node) => [node.id, node.state, node.level])).toEqual([
      ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'completed', 0],
      ['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'current', 1],
      ['cccccccc-cccc-cccc-cccc-cccccccccccc', 'locked', 2],
      ['dddddddd-dddd-dddd-dddd-dddddddddddd', 'untracked', 2],
    ]);
    expect(result.edges.filter((edge) => edge.kind === 'path')).toHaveLength(2);
    expect(result.selectedNode?.missingPrerequisiteIds).toEqual([
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    ]);
    expect(result.selectedNode?.missingPrerequisiteLabels).toEqual(['Functions']);
    expect(result.summary.completedCount).toBe(1);
    expect(result.summary.currentConceptLabel).toBe('Functions');
    expect(result.summary.nextConceptLabel).toBeNull();
  });

  it('filters canvas to recommended path in path mode', () => {
    const result = buildKnowledgeGraphViewModel({
      graph,
      pathSnapshot,
      currentConceptId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      selectedConceptId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      mode: 'path',
      masteryByConceptId: {},
    });

    expect(result.nodes.map((node) => node.id)).toEqual([
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
    ]);
    expect(result.edges).toEqual([
      expect.objectContaining({
        id: 'path-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        kind: 'path',
      }),
      expect.objectContaining({
        id: 'path-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb-cccccccc-cccc-cccc-cccc-cccccccccccc',
        kind: 'path',
      }),
    ]);
  });
});
