import { ChatCompletionService } from '@/services/ai/chat-completion.service.js';
import {
  conceptQuizSchema,
  type ConceptQuizDifficultySchema,
  type ConceptQuizSchema,
  type ConceptQuizSkillTagSchema,
  type LessonPackageSchema,
} from '@insforge/shared-schemas';
import { z } from 'zod';
import {
  buildQuizGenerationMessages,
  parseGeneratedQuizResponse,
  type GeneratedQuizQuestion,
} from './quiz-generation.prompts.js';
import { QuizValidationService } from './quiz-validation.service.js';

const persistedQuizQuestionOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  isCorrect: z.boolean(),
});

const persistedQuizQuestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  difficulty: z.enum(['core', 'medium', 'stretch']),
  skillTag: z.enum(['definition', 'distinction', 'analogy', 'application', 'misconception']),
  correctAnswer: z.string(),
  explanationShort: z.string(),
  options: z.array(persistedQuizQuestionOptionSchema).length(4),
});

const persistedQuizArtifactSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  conceptId: z.string().uuid(),
  lessonVersion: z.number().int().min(1),
  status: z.enum(['active', 'submitted', 'expired']),
  source: z.enum(['llm', 'fallback']),
  questionCountTarget: z.number().int().min(2).max(4),
  questions: z.array(persistedQuizQuestionSchema).min(2).max(4),
  createdAt: z.string(),
});

export type PersistedQuizQuestionOption = z.infer<typeof persistedQuizQuestionOptionSchema>;
export type PersistedQuizQuestion = z.infer<typeof persistedQuizQuestionSchema>;
export type PersistedQuizArtifact = z.infer<typeof persistedQuizArtifactSchema>;

interface BuildQuizForConceptInput {
  quizId: string;
  sessionId: string;
  conceptId: string;
  conceptName: string;
  conceptDescription: string;
  explanationSummary: string;
  technicalExample: string | null;
  missingPrerequisites: string[];
  learnerMastery: number | null;
  difficultyTarget?: ConceptQuizDifficultySchema;
  lessonPackage: LessonPackageSchema;
  createdAt?: string;
}

interface QuizServiceDependencies {
  chatService?: Pick<ChatCompletionService, 'chat'>;
  validator?: QuizValidationService;
}

export class QuizService {
  private static readonly GENERATION_MODEL = 'google/gemini-2.0-flash-lite-001';
  private static readonly GENERIC_FALSE_STATEMENTS = [
    'Chỉ lặp lại tên của khái niệm mà không có ý nghĩa riêng.',
    'Không liên quan đến ý chính của bài học này.',
    'Không giúp giải thích vấn đề đang học.',
    'Chỉ là tên khác của ví dụ minh họa.',
    'Chỉ là một chi tiết rời rạc không ảnh hưởng cách hiểu bài.',
  ];

  private chatService: Pick<ChatCompletionService, 'chat'>;
  private validator: QuizValidationService;

  constructor(dependencies: QuizServiceDependencies = {}) {
    this.chatService = dependencies.chatService ?? ChatCompletionService.getInstance();
    this.validator = dependencies.validator ?? new QuizValidationService();
  }

  private normalize(value: string) {
    return value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private uniqueTexts(values: Array<string | null | undefined>) {
    const seen = new Set<string>();

    return values
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean)
      .filter((value) => {
        const normalized = this.normalize(value);
        if (!normalized || seen.has(normalized)) {
          return false;
        }
        seen.add(normalized);
        return true;
      });
  }

  private compactText(value: string, maxWords = 14, maxChars = 90) {
    const normalized = value
      .replace(/\r/g, ' ')
      .replace(/\n+/g, ' ')
      .replace(/\*\*/g, '')
      .replace(/^[-*•]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) {
      return '';
    }

    const primaryClause =
      normalized
        .split(/[.!?]/)
        .map((part) => part.trim())
        .find(Boolean) ??
      normalized
        .split(/[:;,-]/)
        .map((part) => part.trim())
        .find(Boolean) ??
      normalized;

    const words = primaryClause.split(/\s+/).filter(Boolean);
    const clippedWords = words.slice(0, maxWords).join(' ');
    const clippedChars =
      clippedWords.length > maxChars ? `${clippedWords.slice(0, maxChars - 1).trim()}…` : clippedWords;

    return clippedChars.replace(/[,:;.\-–—]+$/u, '').trim();
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

    return options.map((_, index) => options[(index + offset) % options.length]!);
  }

  resolveDifficultyTarget(masteryScore: number | null | undefined): ConceptQuizDifficultySchema {
    if (masteryScore == null || masteryScore < 0.35) {
      return 'core';
    }
    if (masteryScore < 0.7) {
      return 'medium';
    }
    return 'stretch';
  }

  resolveQuestionCountTarget(input: {
    learnerMastery: number | null;
    technicalExample: string | null;
    missingPrerequisites: string[];
    lessonPackage: LessonPackageSchema;
  }) {
    if (input.missingPrerequisites.length > 0 || input.learnerMastery == null || input.learnerMastery < 0.35) {
      return 2;
    }

    const richnessScore = [
      input.technicalExample ? 1 : 0,
      input.lessonPackage.mainLesson.commonMisconceptions.length > 0 ? 1 : 0,
      input.lessonPackage.prerequisiteMiniLessons.length > 0 ? 1 : 0,
      input.learnerMastery >= 0.7 ? 1 : 0,
    ].reduce((sum, value) => sum + value, 0);

    if ((input.learnerMastery ?? 0) >= 0.7 && richnessScore >= 3) {
      return 4;
    }

    return 3;
  }

  private toPersistedQuestion(input: GeneratedQuizQuestion, index: number): PersistedQuizQuestion {
    const questionId = `q${index + 1}`;
    const normalizedCorrectAnswer = this.normalize(input.correctAnswer);
    const options = input.options.map((text, optionIndex) => ({
      id: `${questionId}-o${optionIndex + 1}`,
      text,
      isCorrect: this.normalize(text) === normalizedCorrectAnswer,
    }));

    return persistedQuizQuestionSchema.parse({
      id: questionId,
      prompt: input.question,
      difficulty: input.difficulty,
      skillTag: input.skillTag,
      correctAnswer: input.correctAnswer,
      explanationShort: input.explanationShort,
      options: this.rotateOptions(questionId, options),
    });
  }

  private toPersistedArtifact(
    input: BuildQuizForConceptInput & {
      source: 'llm' | 'fallback';
      questionCountTarget: number;
      questions: GeneratedQuizQuestion[];
    }
  ): PersistedQuizArtifact {
    return persistedQuizArtifactSchema.parse({
      id: input.quizId,
      sessionId: input.sessionId,
      conceptId: input.conceptId,
      lessonVersion: input.lessonPackage.version,
      status: 'active',
      source: input.source,
      questionCountTarget: input.questionCountTarget,
      questions: input.questions.map((question, index) => this.toPersistedQuestion(question, index)),
      createdAt: input.createdAt ?? new Date().toISOString(),
    });
  }

  private async tryGenerateWithModel(
    input: BuildQuizForConceptInput & {
      difficultyTarget: ConceptQuizDifficultySchema;
      questionCountTarget: number;
    }
  ): Promise<GeneratedQuizQuestion[] | null> {
    let validationFeedback: string[] | undefined;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await this.chatService.chat(
        buildQuizGenerationMessages({
          conceptName: input.conceptName,
          conceptDescription: input.conceptDescription,
          explanationSummary: input.explanationSummary,
          technicalExample: input.technicalExample,
          missingPrerequisites: input.missingPrerequisites,
          learnerMastery: input.learnerMastery,
          difficultyTarget: input.difficultyTarget,
          questionCountTarget: input.questionCountTarget,
          validationFeedback,
        }),
        {
          model: QuizService.GENERATION_MODEL,
          temperature: 0.2,
        }
      );

      const parsed = parseGeneratedQuizResponse(result.text || '{}');
      if (!parsed) {
        validationFeedback = ['JSON output không hợp lệ hoặc không đúng contract.'];
        continue;
      }

      if (parsed.questions.length !== input.questionCountTarget) {
        validationFeedback = [
          `Cần đúng ${input.questionCountTarget} câu hỏi, không ít hơn và không nhiều hơn.`,
        ];
        continue;
      }

      const validation = this.validator.validateQuizSet(parsed.questions);
      if (validation.ok) {
        return parsed.questions;
      }

      validationFeedback = this.validator.toFeedback(validation);
    }

    return null;
  }

  private buildDefinitionQuestion(input: BuildQuizForConceptInput): GeneratedQuizQuestion {
    const correctAnswer = this.compactText(
      input.explanationSummary || input.lessonPackage.mainLesson.definition || input.conceptDescription
    );

    return {
      question: `Phát biểu nào mô tả đúng nhất về ${input.conceptName}?`,
      options: [
        correctAnswer,
        `${input.conceptName} chỉ lặp lại tên gọi mà không có ý nghĩa riêng.`,
        `${input.conceptName} chỉ là một chi tiết rời rạc không ảnh hưởng cách hiểu bài.`,
        `${input.conceptName} không liên quan đến vấn đề đang học.`,
      ],
      correctAnswer,
      explanationShort: `Đây là ý cốt lõi của ${input.conceptName} trong bài học hiện tại.`,
      difficulty: 'core',
      skillTag: 'definition',
    };
  }

  private buildMisconceptionQuestion(input: BuildQuizForConceptInput): GeneratedQuizQuestion {
    const truths = this.uniqueTexts([
      this.compactText(input.conceptDescription),
      this.compactText(input.explanationSummary),
      this.compactText(input.lessonPackage.mainLesson.definition),
      ...input.lessonPackage.mainLesson.commonMisconceptions.map((item) => this.compactText(item)),
      `${input.conceptName} có ý nghĩa riêng trong bài.`,
      `${input.conceptName} cần được hiểu qua ý chính của concept.`,
      `${input.conceptName} không nên bị hiểu như một mẹo ghi nhớ rời rạc.`,
    ])
      .filter((item) => this.normalize(item) !== this.normalize(`${input.conceptName} chỉ là tên khác của ví dụ minh họa.`))
      .slice(0, 3);

    const correctAnswer = `${input.conceptName} chỉ là tên khác của ví dụ minh họa.`;

    return {
      question: `Điều nào là hiểu sai thường gặp về ${input.conceptName}?`,
      options: [correctAnswer, ...truths].slice(0, 4),
      correctAnswer,
      explanationShort: `Ví dụ minh họa chỉ hỗ trợ hiểu ${input.conceptName}, không thay thế ý chính của bài.`,
      difficulty: input.learnerMastery != null && input.learnerMastery >= 0.7 ? 'stretch' : 'medium',
      skillTag: 'misconception',
    };
  }

  private buildPrerequisiteQuestion(input: BuildQuizForConceptInput): GeneratedQuizQuestion | null {
    const prerequisite = input.lessonPackage.prerequisiteMiniLessons[0];
    if (!prerequisite) {
      return null;
    }

    const correctAnswer = this.compactText(prerequisite.title);
    const distractors = this.uniqueTexts([
      this.compactText(input.conceptName),
      this.compactText(input.lessonPackage.mainLesson.technicalExample),
      this.compactText(input.lessonPackage.mainLesson.definition),
      ...QuizService.GENERIC_FALSE_STATEMENTS,
    ])
      .filter((item) => this.normalize(item) !== this.normalize(correctAnswer))
      .slice(0, 3);

    if (distractors.length < 3) {
      return null;
    }

    return {
      question: `Để học chắc ${input.conceptName}, nên nối lại phần nào trước?`,
      options: [correctAnswer, ...distractors],
      correctAnswer,
      explanationShort: 'Câu này kiểm tra khả năng nhận ra kiến thức nền cần có trước khi đi sâu hơn.',
      difficulty: 'core',
      skillTag: 'application',
    };
  }

  private buildApplicationQuestion(input: BuildQuizForConceptInput): GeneratedQuizQuestion {
    const correctAnswer = this.compactText(
      input.technicalExample ||
        input.lessonPackage.mainLesson.technicalExample ||
        input.lessonPackage.mainLesson.importance ||
        input.explanationSummary
    );

    return {
      question: `Khi áp dụng ${input.conceptName} vào bài học này, điều nào gần đúng nhất?`,
      options: [
        correctAnswer,
        'Chỉ cần nhớ nguyên văn ví dụ minh họa.',
        'Bỏ qua ý chính và tập trung vào tên gọi.',
        'Đổi chủ đề khác là đủ để hiểu bài.',
      ],
      correctAnswer,
      explanationShort: 'Câu này kiểm tra người học có hiểu vai trò thực tế của khái niệm trong bài hay không.',
      difficulty: input.learnerMastery != null && input.learnerMastery >= 0.7 ? 'stretch' : 'medium',
      skillTag: 'application',
    };
  }

  private buildFallbackQuestions(
    input: BuildQuizForConceptInput & {
      difficultyTarget: ConceptQuizDifficultySchema;
      questionCountTarget: number;
    }
  ): GeneratedQuizQuestion[] {
    const candidates = [
      this.buildDefinitionQuestion(input),
      this.buildMisconceptionQuestion(input),
      this.buildPrerequisiteQuestion(input) ?? this.buildApplicationQuestion(input),
      this.buildApplicationQuestion(input),
    ].filter((question): question is GeneratedQuizQuestion => question !== null);

    const selected = candidates.slice(0, input.questionCountTarget);
    const validation = this.validator.validateQuizSet(selected);

    if (validation.ok) {
      return selected;
    }

    return [
      this.buildDefinitionQuestion(input),
      this.buildMisconceptionQuestion(input),
    ];
  }

  async buildQuizForConcept(input: BuildQuizForConceptInput): Promise<PersistedQuizArtifact> {
    const difficultyTarget = input.difficultyTarget ?? this.resolveDifficultyTarget(input.learnerMastery);
    const questionCountTarget = this.resolveQuestionCountTarget({
      learnerMastery: input.learnerMastery,
      technicalExample: input.technicalExample,
      missingPrerequisites: input.missingPrerequisites,
      lessonPackage: input.lessonPackage,
    });

    const generatedQuestions = await this.tryGenerateWithModel({
      ...input,
      difficultyTarget,
      questionCountTarget,
    });

    if (generatedQuestions) {
      return this.toPersistedArtifact({
        ...input,
        source: 'llm',
        questionCountTarget,
        questions: generatedQuestions,
      });
    }

    return this.toPersistedArtifact({
      ...input,
      source: 'fallback',
      questionCountTarget,
      questions: this.buildFallbackQuestions({
        ...input,
        difficultyTarget,
        questionCountTarget,
      }),
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
      questionCountTarget: quiz.questionCountTarget,
      questions: quiz.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        difficulty: question.difficulty,
        skillTag: question.skillTag,
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
          ? 'Bạn đã nắm khá chắc khái niệm này. Có thể chuyển sang bước tiếp theo.'
          : 'Bạn nên xem lại ý cốt lõi hoặc mở giải thích thêm rồi làm lại quiz.',
    };
  }
}
