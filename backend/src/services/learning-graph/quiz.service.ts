export interface QuizQuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizQuestionOption[];
}

export class QuizService {
  async getOrCreateActiveQuiz(input: {
    sessionId: string;
    conceptId: string;
    conceptName: string;
    conceptDescription: string;
  }) {
    return {
      id: crypto.randomUUID(),
      sessionId: input.sessionId,
      conceptId: input.conceptId,
      status: 'active' as const,
      questions: [
        {
          id: 'q1',
          prompt: `${input.conceptName} co vai tro gi?`,
          options: [
            { id: 'a', text: 'La mot khai niem can hoc truoc' },
            { id: 'b', text: 'La ten cua mot bang du lieu' },
          ],
        },
      ],
      createdAt: new Date().toISOString(),
    };
  }

  grade(input: {
    questions: QuizQuestion[];
    answers: Array<{ questionId: string; selectedOptionId: string }>;
  }) {
    const answerMap = new Map(
      input.answers.map((answer) => [answer.questionId, answer.selectedOptionId])
    );

    const correctCount = input.questions.filter((question) => {
      const selectedOptionId = answerMap.get(question.id);

      return question.options.some(
        (option) => option.id === selectedOptionId && option.isCorrect
      );
    }).length;

    const score = Number((correctCount / input.questions.length).toFixed(2));

    return {
      score,
      feedback:
        score >= 0.8
          ? 'Ban dang lam rat tot. Noi dung phan hoi nay duoc hien thi bang tieng Viet.'
          : 'Ban nen xem lai phan giai thich va thu mot bai kiem tra moi bang tieng Viet.',
    };
  }
}
