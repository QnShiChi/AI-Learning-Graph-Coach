export const LEARNING_MASTERY_THRESHOLD = 0.7;

export function getMasteryLabel(score: number) {
  if (score >= LEARNING_MASTERY_THRESHOLD) {
    return 'Đã đạt ngưỡng';
  }

  if (score >= 0.4) {
    return 'Đang tiến bộ';
  }

  return 'Chưa vững';
}

export function hasPassedConcept(score: number) {
  return score >= LEARNING_MASTERY_THRESHOLD;
}
