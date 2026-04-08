import { describe, expect, it } from 'vitest';
import { MasteryService } from '@/services/learning-graph/mastery.service.js';

describe('MasteryService', () => {
  it('updates mastery from quiz score only', () => {
    const service = new MasteryService();

    const next = service.calculateNext({
      previousMastery: 0.25,
      quizScore: 0.8,
      attemptCount: 1,
    });

    expect(next.masteryScore).toBeGreaterThan(0.25);
    expect(next.lastQuizScore).toBe(0.8);
    expect(next.attemptCount).toBe(2);
  });
});
