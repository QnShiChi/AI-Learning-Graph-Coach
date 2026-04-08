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
          prompt: `${input.conceptName} có vai trò gì?`,
          options: [
            { id: 'a', text: 'Là một khái niệm cần học trước' },
            { id: 'b', text: 'Là tên của một bảng dữ liệu' },
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
          ? 'Bạn đang làm rất tốt. Nội dung phản hồi này được hiển thị bằng tiếng Việt.'
          : 'Bạn nên xem lại phần giải thích và thử một bài kiểm tra mới bằng tiếng Việt.',
    };
  }
}
