# Learning Graph Quiz Generation And Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay quiz generation hiện tại từ rule-based hỏi lại lesson thành engine `Hybrid` dùng được cho mọi concept, có prompt khung tổng quát, số câu động `2-4`, validation hậu xử lý, và fallback ổn định cho mastery tracking.

**Architecture:** Mở rộng shared schema để mỗi câu quiz có đủ metadata phục vụ chấm điểm và explainability, sau đó tách backend thành ba lớp nhỏ: `prompt builder`, `validator`, và `quiz service` orchestration. `QuizService` sẽ ưu tiên gọi `ChatCompletionService` để sinh quiz từ context của concept, validate từng câu và toàn bộ bộ đề; nếu output lỗi hoặc model fail thì rơi về fallback rule-based tổng quát hơn thay vì prompt cứng cho `Class và Object`.

**Tech Stack:** TypeScript, Zod, Vitest, backend services, shared schemas, OpenRouter-backed `ChatCompletionService`

---

## File Structure

- Modify: `packages/shared-schemas/src/learning-graph.schema.ts`
  Responsibility: mở rộng `conceptQuizSchema` để mang `question`, `correctAnswer`, `explanationShort`, `difficulty`, `skillTag`, và metadata cần thiết cho UI + grading.
- Modify: `packages/shared-schemas/src/learning-graph-api.schema.ts`
  Responsibility: để mọi API đang dùng `conceptQuizSchema` tự nhận contract mới, và nếu cần thêm typed request/response cho dynamic quiz metadata.
- Create: `backend/src/services/learning-graph/quiz-generation.prompts.ts`
  Responsibility: build system/user prompt tổng quát cho mọi concept, bao gồm `questionCountTarget`, `difficultyTarget`, `learnerMastery`, `missingPrerequisites`.
- Create: `backend/src/services/learning-graph/quiz-validation.service.ts`
  Responsibility: normalize output model, enforce rule-based validation, decide câu nào phải regenerate, và đánh giá coverage của cả bộ đề.
- Modify: `backend/src/services/learning-graph/quiz.service.ts`
  Responsibility: orchestration `LLM-first + validation + regenerate + fallback`, persist hidden answer keys, expose client-safe payload, và chấm điểm bằng contract mới.
- Modify: `backend/src/services/learning-graph/learning-orchestrator.service.ts`
  Responsibility: truyền đủ context concept/lesson/mastery/prerequisites vào `QuizService`, vẫn tạo quiz theo flow hiện tại nhưng không còn phụ thuộc lesson fields cứng.
- Create: `backend/tests/unit/learning-graph/quiz-validation.service.test.ts`
  Responsibility: khóa logic length/similarity/single-correctness/coverage.
- Modify: `backend/tests/unit/learning-graph/quiz.service.test.ts`
  Responsibility: chuyển test sang contract mới, test nhánh LLM success, regenerate, và fallback.
- Modify: `backend/tests/integration/learning-graph/session-flow.test.ts`
  Responsibility: giữ chắc flow reveal quiz -> submit quiz -> update mastery/path vẫn pass với schema quiz mới.

## Task 1: Mở rộng shared quiz schema cho contract tổng quát

**Files:**
- Modify: `packages/shared-schemas/src/learning-graph.schema.ts`
- Modify: `packages/shared-schemas/src/learning-graph-api.schema.ts`
- Test: `packages/shared-schemas/src/learning-graph.schema.ts`

- [ ] **Step 1: Viết test schema failing bằng cách mô tả contract mới trong backend test đang dùng quiz payload**

```ts
const parsed = conceptQuizSchema.parse({
  id: '11111111-1111-1111-1111-111111111111',
  sessionId: '22222222-2222-2222-2222-222222222222',
  conceptId: '33333333-3333-3333-3333-333333333333',
  status: 'active',
  questionCountTarget: 3,
  questions: [
    {
      id: 'q1',
      question: 'Phát biểu nào mô tả đúng nhất về encapsulation?',
      correctAnswer: 'Ẩn dữ liệu và kiểm soát truy cập',
      explanationShort: 'Đây là vai trò cốt lõi của encapsulation.',
      difficulty: 'core',
      skillTag: 'definition',
      options: [
        { id: 'a', text: 'Ẩn dữ liệu và kiểm soát truy cập' },
        { id: 'b', text: 'Tạo nhiều lớp con giống nhau' },
        { id: 'c', text: 'Ghép mọi hàm vào một file' },
        { id: 'd', text: 'Biến mọi object thành class' },
      ],
    },
  ],
  createdAt: '2026-04-11T00:00:00.000Z',
});

expect(parsed.questions[0]?.skillTag).toBe('definition');
```

- [ ] **Step 2: Mở rộng `conceptQuizSchema` với skill tag, difficulty, explanation ngắn, và target question count**

```ts
const conceptQuizQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
      })
    )
    .length(4),
  correctAnswer: z.string(),
  explanationShort: z.string(),
  difficulty: z.enum(['core', 'medium', 'stretch']),
  skillTag: z.enum(['definition', 'distinction', 'analogy', 'application', 'misconception']),
});

export const conceptQuizSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  conceptId: z.string().uuid(),
  status: sessionConceptQuizStatusSchema,
  questionCountTarget: z.number().int().min(2).max(4),
  questions: z.array(conceptQuizQuestionSchema).min(2).max(4),
  createdAt: z.string(),
});
```

- [ ] **Step 3: Cập nhật API schemas để response `getConceptLearning` và `getConceptQuiz` tự dùng contract mới**

```ts
export const getConceptQuizResponseSchema = z.object({
  quiz: conceptQuizSchema,
});

export const getConceptLearningResponseSchema = z.object({
  concept: sessionConceptSchema,
  mastery: sessionConceptMasterySchema.nullable(),
  prerequisites: z.array(sessionConceptSchema),
  lessonPackage: lessonPackageSchema,
  explanation: z.string().nullable(),
  quiz: conceptQuizSchema.nullable(),
  recap: conceptRecapSchema.nullable(),
});
```

- [ ] **Step 4: Chạy build package schemas**

Run: `cd packages/shared-schemas && npm run build`
Expected: PASS

- [ ] **Step 5: Commit schema contract**

```bash
git add packages/shared-schemas/src/learning-graph.schema.ts packages/shared-schemas/src/learning-graph-api.schema.ts
git commit -m "feat: expand learning graph quiz schema contract"
```

## Task 2: Tách prompt builder và validator cho quiz tổng quát

**Files:**
- Create: `backend/src/services/learning-graph/quiz-generation.prompts.ts`
- Create: `backend/src/services/learning-graph/quiz-validation.service.ts`
- Create: `backend/tests/unit/learning-graph/quiz-validation.service.test.ts`

- [ ] **Step 1: Viết test validator fail cho option quá dài, option quá giống nhau, và coverage trùng ý**

```ts
it('rejects options that are too long for UI scanning', () => {
  const validator = new QuizValidationService();

  const result = validator.validateQuestion({
    id: 'q1',
    question: 'Encapsulation là gì?',
    options: [
      'Đây là một đoạn mô tả quá dài, vượt quá giới hạn scan nhanh của UI dark theme',
      'Tách biệt trách nhiệm',
      'Che giấu dữ liệu',
      'Tái sử dụng class',
    ],
    correctAnswer: 'Che giấu dữ liệu',
    explanationShort: 'Encapsulation bảo vệ dữ liệu.',
    difficulty: 'core',
    skillTag: 'definition',
  });

  expect(result.ok).toBe(false);
  expect(result.reasons).toContain('option_too_long');
});

it('rejects a quiz set that repeats the same angle three times', () => {
  const validator = new QuizValidationService();

  const result = validator.validateQuizSet([
    makeQuestion({ id: 'q1', skillTag: 'definition', question: 'X là gì?' }),
    makeQuestion({ id: 'q2', skillTag: 'definition', question: 'Định nghĩa đúng của X?' }),
    makeQuestion({ id: 'q3', skillTag: 'definition', question: 'Mô tả nào đúng nhất về X?' }),
  ]);

  expect(result.ok).toBe(false);
  expect(result.reasons).toContain('coverage_too_narrow');
});
```

- [ ] **Step 2: Tạo prompt builder tổng quát cho mọi concept**

```ts
export function buildQuizGenerationMessages(input: {
  conceptName: string;
  conceptDescription: string;
  explanationSummary: string;
  exampleOrAnalogy: string | null;
  missingPrerequisites: string[];
  learnerMastery: number | null;
  difficultyTarget: 'core' | 'medium' | 'stretch';
  questionCountTarget: number;
}) {
  return [
    {
      role: 'system' as const,
      content:
        'Bạn là hệ thống sinh quiz ngắn bằng tiếng Việt cho Learning Workspace. Hãy tạo câu hỏi trắc nghiệm ngắn, sắc, đo mức hiểu thật. Mỗi câu chỉ kiểm tra 1 ý, có 4 lựa chọn ngắn, đúng 1 đáp án đúng rõ ràng, có explanation ngắn 1-2 câu. Tránh paraphrase lặp ý, tránh copy nguyên văn explanation, tránh hỏi meta về cách giải thích.',
    },
    {
      role: 'user' as const,
      content: JSON.stringify({
        language: 'vi',
        concept_name: input.conceptName,
        concept_description: input.conceptDescription,
        explanation_summary: input.explanationSummary,
        example_or_analogy: input.exampleOrAnalogy,
        missing_prerequisites: input.missingPrerequisites,
        learner_mastery: input.learnerMastery,
        difficulty_target: input.difficultyTarget,
        question_count_target: input.questionCountTarget,
        output_contract: {
          questions: [
            {
              question: 'string',
              options: ['string', 'string', 'string', 'string'],
              correct_answer: 'string',
              explanation_short: 'string',
              difficulty: 'core|medium|stretch',
              skill_tag: 'definition|distinction|analogy|application|misconception',
            },
          ],
        },
      }),
    },
  ];
}
```

- [ ] **Step 3: Implement validator với rule length, similarity, single-correctness, coverage, và scanability**

```ts
const MAX_OPTION_LENGTH = 90;
const MAX_QUESTION_LENGTH = 160;

validateQuestion(question: GeneratedQuizQuestion) {
  const reasons: string[] = [];

  if (question.question.trim().length > MAX_QUESTION_LENGTH) reasons.push('question_too_long');
  if (question.options.some((option) => option.trim().length > MAX_OPTION_LENGTH)) {
    reasons.push('option_too_long');
  }

  const normalized = question.options.map((option) => normalize(option));
  if (new Set(normalized).size < 4) reasons.push('options_too_similar');

  const exactMatches = question.options.filter((option) => normalize(option) === normalize(question.correctAnswer));
  if (exactMatches.length !== 1) reasons.push('single_correctness_failed');

  return { ok: reasons.length === 0, reasons };
}
```

- [ ] **Step 4: Chạy unit test validator**

Run: `cd backend && npm test -- tests/unit/learning-graph/quiz-validation.service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit prompt + validator**

```bash
git add backend/src/services/learning-graph/quiz-generation.prompts.ts backend/src/services/learning-graph/quiz-validation.service.ts backend/tests/unit/learning-graph/quiz-validation.service.test.ts
git commit -m "feat: add generic quiz prompt builder and validator"
```

## Task 3: Chuyển `QuizService` sang `Hybrid` generation với regenerate và fallback

**Files:**
- Modify: `backend/src/services/learning-graph/quiz.service.ts`
- Modify: `backend/tests/unit/learning-graph/quiz.service.test.ts`

- [ ] **Step 1: Viết test fail cho nhánh LLM-first trả quiz hợp lệ và nhánh fallback khi validator reject**

```ts
it('uses llm quiz output when it passes validation', async () => {
  const service = new QuizService({
    chatCompletionService: fakeChatServiceReturning({
      questions: [
        makeGeneratedQuestion({ id: 'q1', skillTag: 'definition' }),
        makeGeneratedQuestion({ id: 'q2', skillTag: 'application' }),
        makeGeneratedQuestion({ id: 'q3', skillTag: 'misconception' }),
      ],
    }),
  });

  const artifact = await service.buildQuizForConcept(makeQuizInput());

  expect(artifact.questions).toHaveLength(3);
  expect(artifact.questions.map((question) => question.skillTag)).toContain('application');
});

it('falls back to deterministic quiz when llm output keeps failing validation', async () => {
  const service = new QuizService({
    chatCompletionService: fakeChatServiceReturning({
      questions: [
        makeGeneratedQuestion({
          id: 'q1',
          options: ['Cùng một ý', 'Cùng một ý', 'Cùng một ý', 'Cùng một ý'],
        }),
      ],
    }),
  });

  const artifact = await service.buildQuizForConcept(makeQuizInput());

  expect(artifact.questions.length).toBeGreaterThanOrEqual(2);
  expect(artifact.source).toBe('fallback');
});
```

- [ ] **Step 2: Refactor persisted quiz types để lưu đủ metadata ẩn cho grading và analytics**

```ts
const persistedQuizQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(persistedQuizQuestionOptionSchema).length(4),
  correctAnswer: z.string(),
  explanationShort: z.string(),
  difficulty: z.enum(['core', 'medium', 'stretch']),
  skillTag: z.enum(['definition', 'distinction', 'analogy', 'application', 'misconception']),
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
```

- [ ] **Step 3: Thêm orchestration `LLM -> validate -> regenerate invalid set -> fallback`**

```ts
async buildQuizForConcept(input: BuildQuizInput): Promise<PersistedQuizArtifact> {
  const questionCountTarget = this.resolveQuestionCountTarget(input);

  const llmResult = await this.tryGenerateWithModel({
    ...input,
    questionCountTarget,
  });

  if (llmResult.ok) {
    return this.toPersistedArtifact({
      ...input,
      source: 'llm',
      questionCountTarget,
      questions: llmResult.questions,
    });
  }

  const fallbackQuestions = this.buildFallbackQuestions({
    ...input,
    questionCountTarget,
  });

  return this.toPersistedArtifact({
    ...input,
    source: 'fallback',
    questionCountTarget,
    questions: fallbackQuestions,
  });
}
```

- [ ] **Step 4: Giữ client payload không lộ answer key nhưng expose metadata cần UI/feedback**

```ts
toClientQuiz(quiz: PersistedQuizArtifact): ConceptQuizSchema {
  return conceptQuizSchema.parse({
    id: quiz.id,
    sessionId: quiz.sessionId,
    conceptId: quiz.conceptId,
    status: quiz.status,
    questionCountTarget: quiz.questionCountTarget,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      question: question.question,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
      })),
      correctAnswer: question.correctAnswer,
      explanationShort: question.explanationShort,
      difficulty: question.difficulty,
      skillTag: question.skillTag,
    })),
    createdAt: quiz.createdAt,
  });
}
```

- [ ] **Step 5: Cập nhật `grade` để dùng contract mới và feedback ổn định hơn**

```ts
const correctCount = questions.filter((question) => {
  const selectedOptionId = answerMap.get(question.id);
  return question.options.some((option) => option.id === selectedOptionId && option.isCorrect);
}).length;

const score = Number((correctCount / Math.max(questions.length, 1)).toFixed(2));
const feedback =
  score >= 0.8
    ? 'Bạn đã nắm khá chắc khái niệm này. Có thể chuyển sang bước tiếp theo.'
    : 'Bạn nên xem lại ý cốt lõi hoặc mở giải thích thêm rồi làm lại quiz.';
```

- [ ] **Step 6: Chạy unit test quiz service**

Run: `cd backend && npm test -- tests/unit/learning-graph/quiz.service.test.ts`
Expected: PASS

- [ ] **Step 7: Commit hybrid quiz service**

```bash
git add backend/src/services/learning-graph/quiz.service.ts backend/tests/unit/learning-graph/quiz.service.test.ts
git commit -m "feat: add hybrid quiz generation for learning graph"
```

## Task 4: Truyền context thật từ orchestrator và bảo toàn session flow

**Files:**
- Modify: `backend/src/services/learning-graph/learning-orchestrator.service.ts`
- Modify: `backend/tests/integration/learning-graph/session-flow.test.ts`

- [ ] **Step 1: Viết integration test fail cho flow reveal quiz với dynamic question count và schema mới**

```ts
expect(revealQuiz.body.quiz.questions.length).toBeGreaterThanOrEqual(2);
expect(revealQuiz.body.quiz.questions.length).toBeLessThanOrEqual(4);
expect(revealQuiz.body.quiz.questions[0]).toHaveProperty('skillTag');
expect(revealQuiz.body.quiz.questions[0]).toHaveProperty('explanationShort');
```

- [ ] **Step 2: Truyền đủ context concept, summary, analogy, mastery, prerequisites vào `QuizService`**

```ts
const quizArtifact = await this.quizService.buildQuizForConcept({
  quizId: crypto.randomUUID(),
  sessionId: input.sessionId,
  conceptId: concept.id,
  conceptName: concept.displayName,
  conceptDescription: concept.description,
  explanationSummary: lessonPackage.technicalTranslation,
  exampleOrAnalogy: lessonPackage.feynmanExplanation,
  lessonPackage,
  missingPrerequisites: prerequisites.map((item) => item.displayName),
  learnerMastery: mastery?.masteryScore ?? null,
  difficultyTarget: this.quizService.resolveDifficultyTarget(mastery?.masteryScore ?? null),
});
```

- [ ] **Step 3: Chạy integration test cho session flow**

Run: `cd backend && npm test -- tests/integration/learning-graph/session-flow.test.ts`
Expected: PASS

- [ ] **Step 4: Chạy backend build**

Run: `cd backend && npm run build`
Expected: PASS

- [ ] **Step 5: Commit orchestration changes**

```bash
git add backend/src/services/learning-graph/learning-orchestrator.service.ts backend/tests/integration/learning-graph/session-flow.test.ts
git commit -m "refactor: wire generic quiz generation into learning flow"
```

## Self-Review

- Spec coverage: Plan bao phủ đủ 4 phần đã chốt trong spec cho quiz mới: prompt khung dùng chung, question count động `2-4`, validation hậu xử lý, và fallback rule-based an toàn cho MVP.
- Placeholder scan: Không có `TODO`, `TBD`, hay bước mơ hồ; mỗi task đều chỉ rõ file, code shape, command, và expected result.
- Type consistency: Toàn plan dùng thống nhất các field `question`, `correctAnswer`, `explanationShort`, `difficulty`, `skillTag`, `questionCountTarget`, và source `llm|fallback`.

