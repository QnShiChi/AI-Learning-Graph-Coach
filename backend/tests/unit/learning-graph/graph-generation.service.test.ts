import { describe, expect, it } from 'vitest';
import { GraphGenerationService } from '@/services/learning-graph/graph-generation.service.js';

describe('GraphGenerationService', () => {
  it('parses JSON wrapped in markdown code fences', () => {
    const service = new GraphGenerationService();

    const result = service.parseGraphResponse(`\`\`\`json
{
  "sessionGoal": "Deep Learning",
  "concepts": [],
  "edges": []
}
\`\`\``);

    expect(result).toEqual({
      sessionGoal: 'Deep Learning',
      concepts: [],
      edges: [],
    });
  });

  it('normalizes concepts when the model omits canonicalName', () => {
    const service = new GraphGenerationService();

    const result = service.parseGraphResponse(`{
      "sessionGoal": "Deep Learning",
      "concepts": [
        {
          "tempId": "c1",
          "displayName": "Backpropagation",
          "description": "Mo ta ngan",
          "difficulty": 0.3
        }
      ],
      "edges": []
    }`);

    expect(result).toEqual({
      sessionGoal: 'Deep Learning',
      concepts: [
        {
          tempId: 'c1',
          displayName: 'Backpropagation',
          canonicalName: 'backpropagation',
          description: 'Mo ta ngan',
          difficulty: 0.3,
        },
      ],
      edges: [],
    });
  });

  it('normalizes concept strings and prerequisite names into graph edges', () => {
    const service = new GraphGenerationService();

    const result = service.parseGraphResponse(`{
      "sessionGoal": "Deep Learning",
      "concepts": [
        "Linear Algebra",
        { "displayName": "Gradient Descent", "prerequisites": ["Linear Algebra"] }
      ],
      "edges": []
    }`);

    expect(result.concepts).toHaveLength(2);
    expect(result.edges).toEqual([
      {
        fromTempId: 'concept-1',
        toTempId: 'concept-2',
        type: 'prerequisite',
        weight: 0.5,
      },
    ]);
  });
});
