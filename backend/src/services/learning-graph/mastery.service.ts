export class MasteryService {
  calculateNext(input: {
    previousAttemptScores: number[];
    quizScore: number;
  }) {
    const nextAttemptCount = input.previousAttemptScores.length + 1;
    const totalScore =
      input.previousAttemptScores.reduce((sum, score) => sum + score, 0) + input.quizScore;
    const masteryScore = Math.min(
      1,
      Number((totalScore / Math.max(nextAttemptCount, 1)).toFixed(2))
    );

    return {
      masteryScore,
      lastQuizScore: input.quizScore,
      attemptCount: nextAttemptCount,
    };
  }
}
