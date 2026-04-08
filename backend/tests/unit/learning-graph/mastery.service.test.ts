import { describe, expect, it } from 'vitest';
import { MasteryService } from '@/services/learning-graph/mastery.service.js';
import { QuizService } from '@/services/learning-graph/quiz.service.js';

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

describe('QuizService', () => {
  it('grades a single-attempt quiz payload deterministically', () => {
    const service = new QuizService();

    const result = service.grade({
      questions: [
        {
          id: 'q1',
          prompt: 'Gradient descent la gi?',
          options: [
            { id: 'a', text: 'Toi uu hoa', isCorrect: true },
            { id: 'b', text: 'Luu tru file', isCorrect: false },
          ],
        },
      ],
      answers: [{ questionId: 'q1', selectedOptionId: 'a' }],
    });

    expect(result.score).toBe(1);
    expect(result.feedback).toContain('tieng Viet');
  });
});
