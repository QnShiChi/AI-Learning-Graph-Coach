import { describe, expect, it } from 'vitest';
import { GraphValidationService } from '@/services/learning-graph/graph-validation.service.js';

describe('GraphValidationService', () => {
  it('dedupes concepts by canonical name and removes self-loops', () => {
    const service = new GraphValidationService();

    const result = service.validate({
      sessionGoal: 'Deep Learning',
      concepts: [
        {
          tempId: '1',
          displayName: 'Backpropagation',
          canonicalName: 'Backpropagation',
          description: 'a',
          difficulty: 0.6,
        },
        {
          tempId: '2',
          displayName: 'backpropagation',
          canonicalName: 'backpropagation',
          description: 'b',
          difficulty: 0.4,
        },
      ],
      edges: [{ fromTempId: '1', toTempId: '1', type: 'prerequisite', weight: 0.9 }],
    });

    expect(result.concepts).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
    expect(result.validationReport.removedSelfLoops).toBe(1);
  });
});
