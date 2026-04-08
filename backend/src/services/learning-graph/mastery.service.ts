export class MasteryService {
  calculateNext(input: {
    previousMastery: number;
    quizScore: number;
    attemptCount: number;
  }) {
    const masteryScore = Math.min(
      1,
      Number((input.previousMastery * 0.4 + input.quizScore * 0.6).toFixed(2))
    );

    return {
      masteryScore,
      lastQuizScore: input.quizScore,
      attemptCount: input.attemptCount + 1,
    };
  }
}
