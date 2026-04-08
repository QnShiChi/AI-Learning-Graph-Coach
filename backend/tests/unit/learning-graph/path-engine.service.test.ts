import { describe, expect, it } from 'vitest';
import { PathEngineService } from '@/services/learning-graph/path-engine.service.js';

describe('PathEngineService', () => {
  it('marks the first unmet concept as current and the second as next', () => {
    const service = new PathEngineService();

    const snapshot = service.buildSnapshot({
      concepts: [
        { id: 'c1', difficulty: 0.2 },
        { id: 'c2', difficulty: 0.5 },
        { id: 'c3', difficulty: 0.8 },
      ],
      masteryByConceptId: {
        c1: { masteryScore: 1 },
        c2: { masteryScore: 0.1 },
        c3: { masteryScore: 0 },
      },
      prerequisiteMap: {
        c1: [],
        c2: ['c1'],
        c3: ['c2'],
      },
      nextPathVersion: 2,
    });

    expect(snapshot.pathVersion).toBe(2);
    expect(snapshot.items[0].pathState).toBe('completed');
    expect(snapshot.items[1].pathState).toBe('current');
    expect(snapshot.items[2].pathState).toBe('next');
  });
});
