import { conceptQuizSchema, type ConceptQuizSchema, type LessonPackageSchema } from '@insforge/shared-schemas';
import { z } from 'zod';

const persistedQuizQuestionOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  isCorrect: z.boolean(),
});

const persistedQuizQuestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  options: z.array(persistedQuizQuestionOptionSchema).min(2),
});

const persistedQuizArtifactSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  conceptId: z.string().uuid(),
  lessonVersion: z.number().int().min(1),
  status: z.enum(['active', 'submitted', 'expired']),
  questions: z.array(persistedQuizQuestionSchema).min(1),
  createdAt: z.string(),
});

export type PersistedQuizQuestionOption = z.infer<typeof persistedQuizQuestionOptionSchema>;
export type PersistedQuizQuestion = z.infer<typeof persistedQuizQuestionSchema>;
export type PersistedQuizArtifact = z.infer<typeof persistedQuizArtifactSchema>;

export class QuizService {
  private static readonly FALLBACK_DISTRACTORS = [
    'Đây là một diễn giải khác không đúng với ý chính của bài học.',
    'Đây là chi tiết phụ, không phải đáp án đúng cho câu hỏi này.',
    'Đây là mô tả nghe hợp lý nhưng không bám đúng lesson hiện tại.',
  ];

  private buildQuestion(input: {
    id: string;
    prompt: string;
    correctText: string;
    distractorTexts: string[];
  }): PersistedQuizQuestion {
    const correctOption: PersistedQuizQuestionOption = {
      id: `${input.id}-correct`,
      text: input.correctText,
      isCorrect: true,
    };
    const distractorPool = [...input.distractorTexts, ...QuizService.FALLBACK_DISTRACTORS];
    const distractorOptions = [...new Set(distractorPool)]
      .filter((text) => text.trim().length > 0 && text !== input.correctText)
      .slice(0, 3)
      .map((text, index) => ({
        id: `${input.id}-d${index + 1}`,
        text,
        isCorrect: false,
      }));
    const orderedOptions = this.rotateOptions(input.id, [correctOption, ...distractorOptions]);

    return persistedQuizQuestionSchema.parse({
      id: input.id,
      prompt: input.prompt,
      options: orderedOptions,
    });
  }

  private rotateOptions(
    questionId: string,
    options: PersistedQuizQuestionOption[]
  ): PersistedQuizQuestionOption[] {
    if (options.length <= 1) {
      return options;
    }

    const rawOffset =
      [...questionId].reduce((sum, character) => sum + character.charCodeAt(0), 0) %
      options.length;
    const offset = rawOffset === 0 ? 1 : rawOffset;

    return options.map((_, index) => options[(index + offset) % options.length]);
  }

  buildQuizFromLesson(input: {
    quizId: string;
    sessionId: string;
    conceptId: string;
    conceptName: string;
    lessonPackage: LessonPackageSchema;
    createdAt?: string;
  }): PersistedQuizArtifact {
    const primaryMapping = input.lessonPackage.imageMapping[0];
    const primaryPrerequisite = input.lessonPackage.prerequisiteMiniLessons[0];

    const questions: PersistedQuizQuestion[] = [
      this.buildQuestion({
        id: 'lesson-feynman',
        prompt: `Dau la loi giai thich Feynman cua bai hoc ${input.conceptName}?`,
        correctText: input.lessonPackage.feynmanExplanation,
        distractorTexts: [
          input.lessonPackage.technicalTranslation,
          input.lessonPackage.imageReadingText,
          input.lessonPackage.metaphorImage.prompt,
        ],
      }),
      this.buildQuestion({
        id: 'lesson-technical',
        prompt: `Dau la ban dich ky thuat cua ${input.conceptName}?`,
        correctText: input.lessonPackage.technicalTranslation,
        distractorTexts: [
          input.lessonPackage.feynmanExplanation,
          input.lessonPackage.imageReadingText,
          input.lessonPackage.metaphorImage.prompt,
        ],
      }),
    ];

    if (primaryPrerequisite) {
      questions.push(
        this.buildQuestion({
          id: 'lesson-prerequisite',
          prompt: `Noi dung on lai nao thuoc prerequisite truoc khi hoc ${input.conceptName}?`,
          correctText: `${primaryPrerequisite.title}: ${primaryPrerequisite.content}`,
          distractorTexts: [
            input.lessonPackage.imageReadingText,
            input.lessonPackage.feynmanExplanation,
            input.lessonPackage.technicalTranslation,
          ],
        })
      );
    } else if (primaryMapping) {
      questions.push(
        this.buildQuestion({
          id: 'lesson-image-reading',
          prompt: `Cau nao mo ta y nghia day hoc cua hinh anh trong bai ${input.conceptName}?`,
          correctText: primaryMapping.teachingPurpose,
          distractorTexts: [
            primaryMapping.everydayMeaning,
            primaryMapping.technicalMeaning,
            input.lessonPackage.imageReadingText,
          ],
        })
      );
    }

    return persistedQuizArtifactSchema.parse({
      id: input.quizId,
      sessionId: input.sessionId,
      conceptId: input.conceptId,
      lessonVersion: input.lessonPackage.version,
      status: 'active',
      questions,
      createdAt: input.createdAt ?? new Date().toISOString(),
    });
  }

  parseStoredQuizPayload(payload: unknown): PersistedQuizArtifact | null {
    const parsed = persistedQuizArtifactSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  }

  toClientQuiz(quiz: PersistedQuizArtifact): ConceptQuizSchema {
    return conceptQuizSchema.parse({
      id: quiz.id,
      sessionId: quiz.sessionId,
      conceptId: quiz.conceptId,
      status: quiz.status,
      questions: quiz.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        options: question.options.map((option) => ({
          id: option.id,
          text: option.text,
        })),
      })),
      createdAt: quiz.createdAt,
    });
  }

  grade(input: {
    quiz?: PersistedQuizArtifact;
    questions?: PersistedQuizQuestion[];
    answers: Array<{ questionId: string; selectedOptionId: string }>;
  }) {
    const questions = input.quiz?.questions ?? input.questions ?? [];
    const answerMap = new Map(
      input.answers.map((answer) => [answer.questionId, answer.selectedOptionId])
    );

    const correctCount = questions.filter((question) => {
      const selectedOptionId = answerMap.get(question.id);

      return question.options.some(
        (option) => option.id === selectedOptionId && option.isCorrect
      );
    }).length;

    const score = Number((correctCount / Math.max(questions.length, 1)).toFixed(2));

    return {
      score,
      correctCount,
      totalQuestions: questions.length,
      feedback:
        score >= 0.8
          ? 'Bạn đang làm rất tốt. Nội dung phản hồi này được hiển thị bằng tiếng Việt.'
          : 'Bạn nên xem lại phần giải thích và thử một bài kiểm tra mới bằng tiếng Việt.',
    };
  }
}
