import { describe, expect, it } from 'vitest';
import { getMasteryLabel, hasPassedConcept } from '../mastery';

describe('mastery helpers', () => {
  it('maps mastery scores to learner-friendly labels', () => {
    expect(getMasteryLabel(0.2)).toBe('Chưa vững');
    expect(getMasteryLabel(0.55)).toBe('Đang tiến bộ');
    expect(getMasteryLabel(0.72)).toBe('Đã đạt ngưỡng');
  });

  it('uses 0.7 as the passing threshold', () => {
    expect(hasPassedConcept(0.69)).toBe(false);
    expect(hasPassedConcept(0.7)).toBe(true);
  });
});
