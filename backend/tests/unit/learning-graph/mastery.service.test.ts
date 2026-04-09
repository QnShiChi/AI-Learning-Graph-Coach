import { describe, expect, it } from 'vitest';
import { MasteryService } from '@/services/learning-graph/mastery.service.js';
import { QuizService } from '@/services/learning-graph/quiz.service.js';

describe('MasteryService', () => {
  it('updates mastery from persisted attempt history plus the latest quiz score', () => {
    const service = new MasteryService();

    const next = service.calculateNext({
      previousAttemptScores: [0.25, 0.75],
      quizScore: 0.8,
    });

    expect(next.masteryScore).toBe(0.6);
    expect(next.lastQuizScore).toBe(0.8);
    expect(next.attemptCount).toBe(3);
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
    expect(result.feedback).toContain('tiếng Việt');
  });
});
