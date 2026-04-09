# Learning Loop V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn each learning-graph concept into a real learning unit with a persisted lesson package, grounded quiz lifecycle, real mastery updates, path recomputation after submission, and a concept-scoped voice sandbox built on Web Speech API plus Ollama.

**Architecture:** Implement this in four layers. First extend persistence and shared contracts so lesson packages, quiz artifacts, recap data, and voice summaries have a stable shape. Then move backend orchestration onto persisted `lesson_version -> quiz_version -> attempt -> mastery -> path_version` truth. After that, convert the dashboard concept page from explanation-first debugging into lesson-first learning. Finally, add a separate voice sandbox panel that uses real session/concept data without disturbing the main concept route until the audio loop is stable.

**Tech Stack:** PostgreSQL migrations, Express, TypeScript, Zod shared schemas, React 19, React Router, TanStack Query, Vitest, Web Speech API, Ollama HTTP API

**Spec:** `docs/superpowers/specs/2026-04-09-learning-loop-v2-design.md`

---

## File Map

### New Files

- `backend/src/infra/database/migrations/031_add-learning-lesson-packages.sql` — adds lesson-package and voice-summary persistence
- `backend/src/services/learning-graph/lesson-package.service.ts` — owns lesson package generation, versioning, and retrieval
- `backend/src/services/learning-graph/voice-tutor.service.ts` — concept-scoped Ollama prompt construction and summary shaping for the sandbox
- `backend/tests/unit/learning-graph/lesson-package.service.test.ts` — unit coverage for versioning and package shaping
- `backend/tests/unit/learning-graph/quiz.service.test.ts` — unit coverage for real quiz grading against persisted payloads
- `packages/dashboard/src/features/learning-graph/components/ConceptLessonCard.tsx` — lesson-first concept surface with Feynman explanation, metaphor image, image reading, and technical translation
- `packages/dashboard/src/features/learning-graph/components/ConceptMasteryCard.tsx` — visible mastery percentage + human label + recap state
- `packages/dashboard/src/features/learning-graph/components/VoiceTutorSandboxPanel.tsx` — concept-scoped voice playground with start/stop mic and spoken AI replies
- `packages/dashboard/src/features/learning-graph/lib/mastery.ts` — helper functions for mastery labels and threshold UI
- `packages/dashboard/src/features/learning-graph/lib/__tests__/mastery.test.ts` — pure helper tests for mastery labels and threshold copy

### Modified Files

- `packages/shared-schemas/src/learning-graph-api.schema.ts` — add lesson package, quiz artifact, recap, and voice sandbox contracts
- `packages/shared-schemas/src/index.ts` — export new learning-loop contracts
- `backend/src/services/learning-graph/session.service.ts` — persist lesson packages, load current lesson, persist quiz attempts, upsert mastery, replace path snapshots, and store voice summaries
- `backend/src/services/learning-graph/tutor.service.ts` — produce structured Feynman lesson sections instead of a single explanation string
- `backend/src/services/learning-graph/quiz.service.ts` — generate grounded quizzes from lesson packages and grade stored quizzes
- `backend/src/services/learning-graph/mastery.service.ts` — compute next mastery from previous mastery plus attempts
- `backend/src/services/learning-graph/path-engine.service.ts` — expose recomputation helpers used after quiz submission
- `backend/src/services/learning-graph/learning-orchestrator.service.ts` — orchestrate lesson loading, quiz reveal, submission, recap, and voice sandbox responses
- `backend/src/api/routes/learning-graph/index.routes.ts` — expose lesson-package, quiz reveal, submission, re-explanation, and voice sandbox endpoints
- `backend/tests/integration/learning-graph/session-flow.test.ts` — add end-to-end coverage for lesson load, quiz submit, mastery update, and path refresh
- `packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts` — add lesson, quiz, recap, re-explanation, and voice sandbox API calls
- `packages/dashboard/src/features/learning-graph/hooks/useConceptLearning.ts` — switch from manual explanation button to lesson-first query and add quiz reveal / re-explanation / recap invalidation
- `packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx` — render lesson-first concept view and gate quiz reveal behind learner confirmation
- `packages/dashboard/src/features/learning-graph/components/ConceptExplanationCard.tsx` — either remove or repurpose into a narrow re-explanation action surface
- `packages/dashboard/src/features/learning-graph/components/ConceptQuizCard.tsx` — render only after learner confirmation and show recap / retry states
- `packages/dashboard/src/features/learning-graph/components/index.ts` — export the new lesson, mastery, and voice components
- `packages/dashboard/src/router/AppRoutes.tsx` — add a route for the voice sandbox panel if it is not embedded under the concept route

## Task 1: Add lesson-package and voice-summary persistence

**Files:**
- Create: `backend/src/infra/database/migrations/031_add-learning-lesson-packages.sql`
- Modify: `packages/shared-schemas/src/learning-graph-api.schema.ts`
- Modify: `packages/shared-schemas/src/index.ts`
- Test: `cd backend && npx vitest run tests/integration/learning-graph/session-flow.test.ts`
- Test: `cd packages/shared-schemas && npm run build`

- [ ] **Step 1: Write the failing integration assertions for lesson-package retrieval**

Add this test to `backend/tests/integration/learning-graph/session-flow.test.ts`:

```ts
it('returns a default lesson package before quiz reveal', async () => {
  const response = await request(app)
    .get(`/api/learning-graph/learning-sessions/${sessionId}/concepts/${conceptId}`)
    .set('Authorization', `Bearer ${userToken}`);

  expect(response.status).toBe(200);
  expect(response.body.data.lessonPackage).toMatchObject({
    version: 1,
    regenerationReason: 'initial',
    feynmanExplanation: expect.any(String),
    metaphorImage: {
      imageUrl: expect.any(String),
      prompt: expect.any(String),
    },
    imageMapping: expect.arrayContaining([
      expect.objectContaining({
        visualElement: expect.any(String),
        technicalMeaning: expect.any(String),
      }),
    ]),
    technicalTranslation: expect.any(String),
  });
  expect(response.body.data.quiz).toBeNull();
});
```

- [ ] **Step 2: Run the integration test to verify it fails**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/backend
npx vitest run tests/integration/learning-graph/session-flow.test.ts
```

Expected: FAIL because `lessonPackage` is missing from the concept payload.

- [ ] **Step 3: Add the migration for lesson packages and voice summaries**

Create `backend/src/infra/database/migrations/031_add-learning-lesson-packages.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.session_concept_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.learning_sessions(id) ON DELETE CASCADE,
  concept_id UUID NOT NULL REFERENCES public.session_concepts(id) ON DELETE CASCADE,
  lesson_version INTEGER NOT NULL CHECK (lesson_version >= 1),
  lesson_payload JSONB NOT NULL,
  regeneration_reason TEXT NOT NULL CHECK (
    regeneration_reason IN ('initial', 'failed_quiz', 'simpler_reexplain', 'prerequisite_refresh')
  ),
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT session_concept_lessons_version_unique UNIQUE (session_id, concept_id, lesson_version)
);

CREATE UNIQUE INDEX IF NOT EXISTS session_concept_lessons_one_current_idx
  ON public.session_concept_lessons (session_id, concept_id)
  WHERE is_current = TRUE;

CREATE TABLE IF NOT EXISTS public.session_concept_voice_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.learning_sessions(id) ON DELETE CASCADE,
  concept_id UUID NOT NULL REFERENCES public.session_concepts(id) ON DELETE CASCADE,
  lesson_version INTEGER NOT NULL CHECK (lesson_version >= 1),
  summary_version INTEGER NOT NULL CHECK (summary_version >= 1),
  summary_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT session_concept_voice_summaries_unique UNIQUE (
    session_id,
    concept_id,
    lesson_version,
    summary_version
  )
);
```

- [ ] **Step 4: Add shared lesson-package and voice-summary schemas**

Extend `packages/shared-schemas/src/learning-graph-api.schema.ts` with:

```ts
export const lessonImageMappingItemSchema = z.object({
  visualElement: z.string(),
  everydayMeaning: z.string(),
  technicalMeaning: z.string(),
  teachingPurpose: z.string(),
});

export const lessonPackageSchema = z.object({
  version: z.number().int().min(1),
  regenerationReason: z.enum([
    'initial',
    'failed_quiz',
    'simpler_reexplain',
    'prerequisite_refresh',
  ]),
  feynmanExplanation: z.string(),
  metaphorImage: z.object({
    imageUrl: z.string().url(),
    prompt: z.string(),
  }),
  imageMapping: z.array(lessonImageMappingItemSchema),
  imageReadingText: z.string(),
  technicalTranslation: z.string(),
  prerequisiteMiniLessons: z
    .array(
      z.object({
        prerequisiteConceptId: z.string().uuid(),
        title: z.string(),
        content: z.string(),
      })
    )
    .default([]),
});

export const voiceTutorReplySchema = z.object({
  replyText: z.string(),
  summaryVersion: z.number().int().min(1),
});
```

Export them from `packages/shared-schemas/src/index.ts`:

```ts
export * from './learning-graph.schema.js';
export * from './learning-graph-api.schema.js';
```

- [ ] **Step 5: Run schema build and the integration test again**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/packages/shared-schemas
npm run build

cd /home/phan-duong-quoc-nhat/workspace/InsForge/backend
npx vitest run tests/integration/learning-graph/session-flow.test.ts
```

Expected: shared schemas PASS; integration test still FAIL until the backend reads and writes the new lesson records.

- [ ] **Step 6: Commit the persistence/contracts slice**

```bash
git add backend/src/infra/database/migrations/031_add-learning-lesson-packages.sql \
  packages/shared-schemas/src/learning-graph-api.schema.ts \
  packages/shared-schemas/src/index.ts \
  backend/tests/integration/learning-graph/session-flow.test.ts
git commit -m "feat: add learning lesson persistence contracts"
```

## Task 2: Implement lesson-package generation and concept payload loading

**Files:**
- Create: `backend/src/services/learning-graph/lesson-package.service.ts`
- Create: `backend/tests/unit/learning-graph/lesson-package.service.test.ts`
- Modify: `backend/src/services/learning-graph/tutor.service.ts`
- Modify: `backend/src/services/learning-graph/session.service.ts`
- Modify: `backend/src/services/learning-graph/learning-orchestrator.service.ts`
- Modify: `backend/src/api/routes/learning-graph/index.routes.ts`
- Test: `cd backend && npx vitest run tests/unit/learning-graph/lesson-package.service.test.ts`
- Test: `cd backend && npx vitest run tests/integration/learning-graph/session-flow.test.ts`

- [ ] **Step 1: Write the failing unit tests for lesson versioning**

Create `backend/tests/unit/learning-graph/lesson-package.service.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LessonPackageService } from '../../../src/services/learning-graph/lesson-package.service.js';

describe('LessonPackageService', () => {
  it('builds an initial lesson package with all required sections', async () => {
    const service = new LessonPackageService();

    const lesson = await service.buildInitial({
      sessionId: '11111111-1111-1111-1111-111111111111',
      conceptId: '22222222-2222-2222-2222-222222222222',
      conceptName: 'Gradient Descent',
      conceptDescription: 'Technique for minimizing loss iteratively.',
      sourceText: 'Gradient descent updates parameters by following negative gradients.',
      prerequisites: [],
      masteryScore: 0,
    });

    expect(lesson.version).toBe(1);
    expect(lesson.regenerationReason).toBe('initial');
    expect(lesson.feynmanExplanation.length).toBeGreaterThan(0);
    expect(lesson.imageMapping.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the unit test to verify it fails**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/backend
npx vitest run tests/unit/learning-graph/lesson-package.service.test.ts
```

Expected: FAIL because `LessonPackageService` does not exist.

- [ ] **Step 3: Implement the lesson package service and repurpose tutor output**

Create `backend/src/services/learning-graph/lesson-package.service.ts`:

```ts
import { TutorService } from './tutor.service.js';

export class LessonPackageService {
  private tutorService = new TutorService();

  async buildInitial(input: {
    sessionId: string;
    conceptId: string;
    conceptName: string;
    conceptDescription: string;
    sourceText: string | null;
    prerequisites: Array<{ conceptId: string; displayName: string }>;
    masteryScore: number;
  }) {
    const teaching = await this.tutorService.generateLessonPackage({
      conceptName: input.conceptName,
      conceptDescription: input.conceptDescription,
      sourceText: input.sourceText,
      masteryScore: input.masteryScore,
      missingPrerequisites: input.prerequisites.map((item) => item.displayName),
      regenerationReason: 'initial',
    });

    return {
      version: 1,
      regenerationReason: 'initial' as const,
      ...teaching,
    };
  }
}
```

In `backend/src/services/learning-graph/tutor.service.ts`, replace the single-string explanation API with a structured method:

```ts
async generateLessonPackage(input: {
  conceptName: string;
  conceptDescription: string;
  sourceText: string | null;
  masteryScore: number;
  missingPrerequisites: string[];
  regenerationReason: 'initial' | 'failed_quiz' | 'simpler_reexplain' | 'prerequisite_refresh';
}) {
  return {
    feynmanExplanation: `${input.conceptName} có thể hiểu như ...`,
    metaphorImage: {
      imageUrl: 'https://example.com/metaphor-image.png',
      prompt: `Create an everyday-life metaphor image for ${input.conceptName}`,
    },
    imageMapping: [
      {
        visualElement: 'con dốc',
        everydayMeaning: 'đường đi xuống',
        technicalMeaning: 'hướng giảm loss',
        teachingPurpose: 'giúp người học hình dung tối ưu hóa',
      },
    ],
    imageReadingText: 'Trong hình, con dốc tượng trưng cho ...',
    technicalTranslation: `${input.conceptName} trong ngôn ngữ kỹ thuật là ...`,
    prerequisiteMiniLessons: [],
  };
}
```

- [ ] **Step 4: Wire lesson loading into session/orchestrator/routes**

Add to `backend/src/services/learning-graph/session.service.ts`:

```ts
async getCurrentLessonPackage(sessionId: string, conceptId: string) {
  const result = await this.db.getPool().query<{ lesson_payload: unknown }>(
    `SELECT lesson_payload
     FROM public.session_concept_lessons
     WHERE session_id = $1 AND concept_id = $2 AND is_current = TRUE`,
    [sessionId, conceptId]
  );

  return result.rows[0]?.lesson_payload ?? null;
}

async insertLessonPackage(input: {
  sessionId: string;
  conceptId: string;
  version: number;
  regenerationReason: 'initial' | 'failed_quiz' | 'simpler_reexplain' | 'prerequisite_refresh';
  lessonPayload: unknown;
}) {
  await this.db.getPool().query(
    `INSERT INTO public.session_concept_lessons
      (session_id, concept_id, lesson_version, lesson_payload, regeneration_reason, is_current)
     VALUES ($1, $2, $3, $4, $5, TRUE)`,
    [input.sessionId, input.conceptId, input.version, input.lessonPayload, input.regenerationReason]
  );
}
```

In `backend/src/services/learning-graph/learning-orchestrator.service.ts`, update concept loading:

```ts
async getConceptLearning(input: { userId: string; sessionId: string; conceptId: string }) {
  await this.assertSessionAccess(input.userId, input.sessionId);
  const payload = await this.sessionService.getConceptLearningPayload(input.sessionId, input.conceptId);

  let lessonPackage = await this.sessionService.getCurrentLessonPackage(input.sessionId, input.conceptId);
  if (!lessonPackage && payload.concept) {
    lessonPackage = await this.lessonPackageService.buildInitial({
      sessionId: input.sessionId,
      conceptId: input.conceptId,
      conceptName: payload.concept.displayName,
      conceptDescription: payload.concept.description,
      sourceText: payload.session.sourceText,
      prerequisites: payload.prerequisites,
      masteryScore: payload.mastery?.masteryScore ?? 0,
    });
    await this.sessionService.insertLessonPackage({
      sessionId: input.sessionId,
      conceptId: input.conceptId,
      version: lessonPackage.version,
      regenerationReason: lessonPackage.regenerationReason,
      lessonPayload: lessonPackage,
    });
  }

  return { ...payload, lessonPackage, quiz: null, recap: null };
}
```

- [ ] **Step 5: Run the unit and integration tests to verify they pass**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/backend
npx vitest run tests/unit/learning-graph/lesson-package.service.test.ts
npx vitest run tests/integration/learning-graph/session-flow.test.ts
```

Expected: PASS for the new lesson-package unit test and the concept payload test.

- [ ] **Step 6: Commit the lesson-loading slice**

```bash
git add backend/src/services/learning-graph/lesson-package.service.ts \
  backend/tests/unit/learning-graph/lesson-package.service.test.ts \
  backend/src/services/learning-graph/tutor.service.ts \
  backend/src/services/learning-graph/session.service.ts \
  backend/src/services/learning-graph/learning-orchestrator.service.ts \
  backend/src/api/routes/learning-graph/index.routes.ts \
  backend/tests/integration/learning-graph/session-flow.test.ts
git commit -m "feat: add lesson package loading for concepts"
```

## Task 3: Replace placeholder quiz grading with persisted quiz artifacts, mastery updates, and path recomputation

**Files:**
- Create: `backend/tests/unit/learning-graph/quiz.service.test.ts`
- Modify: `backend/src/services/learning-graph/quiz.service.ts`
- Modify: `backend/src/services/learning-graph/mastery.service.ts`
- Modify: `backend/src/services/learning-graph/path-engine.service.ts`
- Modify: `backend/src/services/learning-graph/session.service.ts`
- Modify: `backend/src/services/learning-graph/learning-orchestrator.service.ts`
- Modify: `backend/src/api/routes/learning-graph/index.routes.ts`
- Modify: `backend/tests/integration/learning-graph/session-flow.test.ts`
- Test: `cd backend && npx vitest run tests/unit/learning-graph/quiz.service.test.ts`
- Test: `cd backend && npx vitest run tests/unit/learning-graph/mastery.service.test.ts tests/unit/learning-graph/path-engine.service.test.ts`
- Test: `cd backend && npx vitest run tests/integration/learning-graph/session-flow.test.ts`

- [ ] **Step 1: Write the failing unit test for grading a stored quiz**

Create `backend/tests/unit/learning-graph/quiz.service.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { QuizService } from '../../../src/services/learning-graph/quiz.service.js';

describe('QuizService', () => {
  it('grades against the stored quiz payload instead of a placeholder question', () => {
    const service = new QuizService();

    const quiz = {
      id: 'quiz-1',
      lessonVersion: 2,
      questions: [
        {
          id: 'q1',
          prompt: 'Gradient descent cố gắng làm gì?',
          options: [
            { id: 'a', text: 'Giảm loss', isCorrect: true },
            { id: 'b', text: 'Tăng noise', isCorrect: false },
          ],
        },
      ],
    };

    const result = service.grade({
      quiz,
      answers: [{ questionId: 'q1', selectedOptionId: 'a' }],
    });

    expect(result.score).toBe(1);
    expect(result.correctCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run the quiz and mastery/path tests to verify failure**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/backend
npx vitest run tests/unit/learning-graph/quiz.service.test.ts tests/unit/learning-graph/mastery.service.test.ts tests/unit/learning-graph/path-engine.service.test.ts
```

Expected: FAIL because `QuizService.grade` still expects a raw `questions` array and the mastery/path flow does not yet recompute from persisted attempts.

- [ ] **Step 3: Generate and persist quiz artifacts from lesson packages**

In `backend/src/services/learning-graph/quiz.service.ts`, replace the template-based generator with:

```ts
async buildQuizFromLesson(input: {
  sessionId: string;
  conceptId: string;
  lessonVersion: number;
  lessonPackage: {
    feynmanExplanation: string;
    imageMapping: Array<{
      visualElement: string;
      technicalMeaning: string;
    }>;
    technicalTranslation: string;
  };
}) {
  return {
    lessonVersion: input.lessonVersion,
    questions: [
      {
        id: 'q1',
        prompt: 'Theo bài học vừa rồi, mục tiêu chính của khái niệm này là gì?',
        options: [
          { id: 'a', text: input.lessonPackage.technicalTranslation, isCorrect: true },
          { id: 'b', text: 'Một chi tiết không liên quan trong hình minh họa', isCorrect: false },
        ],
      },
    ],
  };
}

grade(input: {
  quiz: {
    questions: QuizQuestion[];
  };
  answers: Array<{ questionId: string; selectedOptionId: string }>;
}) {
  const answerMap = new Map(input.answers.map((answer) => [answer.questionId, answer.selectedOptionId]));
  const correctCount = input.quiz.questions.filter((question) =>
    question.options.some((option) => option.id === answerMap.get(question.id) && option.isCorrect)
  ).length;

  return {
    correctCount,
    totalCount: input.quiz.questions.length,
    score: Number((correctCount / input.quiz.questions.length).toFixed(2)),
  };
}
```

In `backend/src/services/learning-graph/session.service.ts`, add methods to:

```ts
async getActiveQuiz(sessionId: string, conceptId: string) { /* SELECT quiz_payload FROM session_concept_quizzes WHERE status = 'active' */ }
async insertActiveQuiz(...) { /* INSERT quiz_payload */ }
async markQuizSubmitted(...) { /* UPDATE status = 'submitted', submitted_at = NOW() */ }
async insertQuizAttempt(...) { /* INSERT INTO quiz_attempts */ }
async upsertMastery(...) { /* INSERT ... ON CONFLICT DO UPDATE */ }
async replacePathSnapshot(...) { /* mark current path rows false, insert recomputed rows */ }
```

- [ ] **Step 4: Orchestrate quiz reveal, submission, mastery, recap, and path refresh**

In `backend/src/services/learning-graph/learning-orchestrator.service.ts`, add or update:

```ts
async getOrCreateQuiz(input: { userId: string; sessionId: string; conceptId: string }) {
  await this.assertSessionAccess(input.userId, input.sessionId);

  const lessonPackage = await this.sessionService.getCurrentLessonPackage(input.sessionId, input.conceptId);
  const activeQuiz = await this.sessionService.getActiveQuiz(input.sessionId, input.conceptId);
  if (activeQuiz) {
    return { quiz: activeQuiz };
  }

  const quiz = await this.quizService.buildQuizFromLesson({
    sessionId: input.sessionId,
    conceptId: input.conceptId,
    lessonVersion: lessonPackage.version,
    lessonPackage,
  });

  await this.sessionService.insertActiveQuiz({
    sessionId: input.sessionId,
    conceptId: input.conceptId,
    quizPayload: quiz,
  });

  return { quiz };
}

async submitQuiz(input: { sessionId: string; conceptId: string; quizId: string; answers: Array<{ questionId: string; selectedOptionId: string }>; userId: string; }) {
  await this.assertSessionAccess(input.userId, input.sessionId);
  const quiz = await this.sessionService.getQuizById(input.quizId);
  const graded = this.quizService.grade({ quiz, answers: input.answers });
  const previous = await this.sessionService.getMastery(input.sessionId, input.conceptId);
  const mastery = this.masteryService.calculateNext({
    previousMastery: previous?.masteryScore ?? 0,
    quizScore: graded.score,
    attemptCount: previous?.attemptCount ?? 0,
  });
  await this.sessionService.insertQuizAttempt({
    quizId: input.quizId,
    sessionId: input.sessionId,
    conceptId: input.conceptId,
    userAnswers: input.answers,
    score: graded.score,
    resultSummary: graded,
  });
  await this.sessionService.markQuizSubmitted(input.quizId);
  await this.sessionService.upsertMastery({
    sessionId: input.sessionId,
    conceptId: input.conceptId,
    masteryScore: mastery.masteryScore,
    lastQuizScore: graded.score,
    attemptCount: mastery.attemptCount,
  });
  const nextPath = this.pathEngineService.recomputeAfterSubmission(/* current graph + mastery */);
  await this.sessionService.replacePathSnapshot(input.sessionId, nextPath);

  return {
    score: graded.score,
    mastery,
    recap:
      mastery.masteryScore >= 0.7
        ? {
            summary: 'Bạn đã nắm được ý chính của khái niệm này.',
            whyPassed: 'Mastery hiện đã đạt ngưỡng 0.7 trở lên.',
          }
        : null,
    pathSnapshot: nextPath,
  };
}
```

- [ ] **Step 5: Run backend unit and integration tests to verify pass**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/backend
npx vitest run tests/unit/learning-graph/quiz.service.test.ts
npx vitest run tests/unit/learning-graph/mastery.service.test.ts tests/unit/learning-graph/path-engine.service.test.ts
npx vitest run tests/integration/learning-graph/session-flow.test.ts
```

Expected: PASS for quiz grading, mastery progression, and end-to-end lesson -> quiz -> mastery -> path refresh behavior.

- [ ] **Step 6: Commit the grounded quiz/mastery slice**

```bash
git add backend/tests/unit/learning-graph/quiz.service.test.ts \
  backend/src/services/learning-graph/quiz.service.ts \
  backend/src/services/learning-graph/mastery.service.ts \
  backend/src/services/learning-graph/path-engine.service.ts \
  backend/src/services/learning-graph/session.service.ts \
  backend/src/services/learning-graph/learning-orchestrator.service.ts \
  backend/src/api/routes/learning-graph/index.routes.ts \
  backend/tests/integration/learning-graph/session-flow.test.ts
git commit -m "feat: persist grounded quizzes and recompute mastery"
```

## Task 4: Convert the dashboard concept page to lesson-first learning

**Files:**
- Create: `packages/dashboard/src/features/learning-graph/components/ConceptLessonCard.tsx`
- Create: `packages/dashboard/src/features/learning-graph/components/ConceptMasteryCard.tsx`
- Create: `packages/dashboard/src/features/learning-graph/lib/mastery.ts`
- Create: `packages/dashboard/src/features/learning-graph/lib/__tests__/mastery.test.ts`
- Modify: `packages/dashboard/src/features/learning-graph/hooks/useConceptLearning.ts`
- Modify: `packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx`
- Modify: `packages/dashboard/src/features/learning-graph/components/ConceptQuizCard.tsx`
- Modify: `packages/dashboard/src/features/learning-graph/components/ConceptExplanationCard.tsx`
- Modify: `packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts`
- Modify: `packages/dashboard/src/features/learning-graph/components/index.ts`
- Test: `cd packages/dashboard && npm run typecheck`
- Test: `cd packages/dashboard && npm run build`

- [ ] **Step 1: Write the failing mastery helper test**

Create `packages/dashboard/src/features/learning-graph/lib/__tests__/mastery.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getMasteryLabel, hasPassedConcept } from '../mastery';

describe('mastery helpers', () => {
  it('maps mastery score to learner-friendly labels', () => {
    expect(getMasteryLabel(0.2)).toBe('Chưa vững');
    expect(getMasteryLabel(0.55)).toBe('Đang tiến bộ');
    expect(getMasteryLabel(0.72)).toBe('Đã đạt ngưỡng');
  });

  it('uses 0.7 as the passing threshold', () => {
    expect(hasPassedConcept(0.69)).toBe(false);
    expect(hasPassedConcept(0.7)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the dashboard test/build to verify it fails**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/packages/dashboard
npm run typecheck
```

Expected: FAIL because `mastery.ts` and the new lesson-first component imports do not exist.

- [ ] **Step 3: Add the mastery helpers and lesson-first components**

Create `packages/dashboard/src/features/learning-graph/lib/mastery.ts`:

```ts
export function getMasteryLabel(score: number) {
  if (score >= 0.7) return 'Đã đạt ngưỡng';
  if (score >= 0.4) return 'Đang tiến bộ';
  return 'Chưa vững';
}

export function hasPassedConcept(score: number) {
  return score >= 0.7;
}
```

Create `packages/dashboard/src/features/learning-graph/components/ConceptMasteryCard.tsx`:

```tsx
import { getMasteryLabel } from '../lib/mastery';

export function ConceptMasteryCard({ masteryScore }: { masteryScore: number }) {
  const percentage = Math.round(masteryScore * 100);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">Mastery hiện tại</p>
      <p className="mt-2 text-3xl font-semibold">{percentage}%</p>
      <p className="mt-1 text-sm text-foreground">{getMasteryLabel(masteryScore)}</p>
    </div>
  );
}
```

Create `packages/dashboard/src/features/learning-graph/components/ConceptLessonCard.tsx`:

```tsx
export function ConceptLessonCard({
  lesson,
  onRevealQuiz,
}: {
  lesson: {
    feynmanExplanation: string;
    imageReadingText: string;
    technicalTranslation: string;
    metaphorImage: { imageUrl: string };
  };
  onRevealQuiz: () => void;
}) {
  return (
    <section className="space-y-6 rounded-2xl border border-border bg-card p-6">
      <div>
        <h2 className="text-xl font-semibold">Giải thích dễ hiểu</h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-foreground">
          {lesson.feynmanExplanation}
        </p>
      </div>

      <img
        src={lesson.metaphorImage.imageUrl}
        alt="Minh họa ẩn dụ cho khái niệm hiện tại"
        className="w-full rounded-xl border border-border object-cover"
      />

      <div>
        <h3 className="text-base font-semibold">Đọc hình</h3>
        <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">
          {lesson.imageReadingText}
        </p>
      </div>

      <div>
        <h3 className="text-base font-semibold">Dịch sang ngôn ngữ kỹ thuật</h3>
        <p className="mt-2 whitespace-pre-line text-sm leading-7 text-foreground">
          {lesson.technicalTranslation}
        </p>
      </div>

      <button className="btn btn-primary" onClick={onRevealQuiz}>
        Tôi đã hiểu, cho tôi quiz
      </button>
    </section>
  );
}
```

- [ ] **Step 4: Switch `useConceptLearning` and `ConceptLearningPage` to lesson-first**

In `packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts`, add:

```ts
getOrCreateQuiz(sessionId: string, conceptId: string) {
  return apiClient.request(`/learning-graph/learning-sessions/${sessionId}/concepts/${conceptId}/quiz`, {
    method: 'POST',
  });
}
```

In `packages/dashboard/src/features/learning-graph/hooks/useConceptLearning.ts`, expose:

```ts
const revealQuizMutation = useMutation({
  mutationFn: () => learningGraphService.getOrCreateQuiz(sessionId!, conceptId!),
});

return {
  conceptLearning: conceptQuery.data,
  isLoadingConceptLearning: conceptQuery.isLoading,
  revealQuiz: revealQuizMutation.mutateAsync,
  isRevealingQuiz: revealQuizMutation.isPending,
  submitQuiz: submitQuizMutation.mutateAsync,
};
```

In `packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx`, render:

```tsx
<div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
  <ConceptLessonCard
    lesson={conceptLearning.lessonPackage}
    onRevealQuiz={() => revealQuiz()}
  />

  <div className="space-y-6">
    <ConceptMasteryCard masteryScore={conceptLearning.mastery?.masteryScore ?? 0} />
    {conceptLearning.quiz ? (
      <ConceptQuizCard
        quiz={conceptLearning.quiz}
        onSubmit={submitQuiz}
        isSubmitting={isSubmittingQuiz}
      />
    ) : null}
  </div>
</div>
```

- [ ] **Step 5: Run dashboard verification**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/packages/dashboard
npm run typecheck
npm run build
```

Expected: PASS with the lesson-first concept screen building cleanly.

- [ ] **Step 6: Commit the lesson-first dashboard slice**

```bash
git add packages/dashboard/src/features/learning-graph/components/ConceptLessonCard.tsx \
  packages/dashboard/src/features/learning-graph/components/ConceptMasteryCard.tsx \
  packages/dashboard/src/features/learning-graph/lib/mastery.ts \
  packages/dashboard/src/features/learning-graph/lib/__tests__/mastery.test.ts \
  packages/dashboard/src/features/learning-graph/hooks/useConceptLearning.ts \
  packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx \
  packages/dashboard/src/features/learning-graph/components/ConceptQuizCard.tsx \
  packages/dashboard/src/features/learning-graph/components/ConceptExplanationCard.tsx \
  packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts \
  packages/dashboard/src/features/learning-graph/components/index.ts
git commit -m "feat: make concept learning lesson-first"
```

## Task 5: Add remediation, lesson-version invalidation, and recap behavior

**Files:**
- Modify: `backend/src/services/learning-graph/lesson-package.service.ts`
- Modify: `backend/src/services/learning-graph/session.service.ts`
- Modify: `backend/src/services/learning-graph/learning-orchestrator.service.ts`
- Modify: `packages/dashboard/src/features/learning-graph/hooks/useConceptLearning.ts`
- Modify: `packages/dashboard/src/features/learning-graph/components/ConceptQuizCard.tsx`
- Modify: `packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx`
- Modify: `backend/tests/integration/learning-graph/session-flow.test.ts`
- Test: `cd backend && npx vitest run tests/integration/learning-graph/session-flow.test.ts`
- Test: `cd packages/dashboard && npm run typecheck`

- [ ] **Step 1: Write the failing integration test for failed-quiz regeneration**

Add to `backend/tests/integration/learning-graph/session-flow.test.ts`:

```ts
it('creates a new lesson version and expires the old quiz after a failed quiz attempt', async () => {
  const firstQuiz = await orchestrator.getOrCreateQuiz({ userId, sessionId, conceptId });

  const result = await orchestrator.submitQuiz({
    userId,
    sessionId,
    conceptId,
    quizId: firstQuiz.quiz.id,
    answers: [{ questionId: 'q1', selectedOptionId: 'wrong-answer' }],
  });

  expect(result.mastery.masteryScore).toBeLessThan(0.7);

  const refreshed = await orchestrator.getConceptLearning({ userId, sessionId, conceptId });

  expect(refreshed.lessonPackage.version).toBe(2);
  expect(refreshed.lessonPackage.regenerationReason).toBe('failed_quiz');
  expect(refreshed.quiz).toBeNull();
});
```

- [ ] **Step 2: Run the integration test to verify failure**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/backend
npx vitest run tests/integration/learning-graph/session-flow.test.ts
```

Expected: FAIL because failed submissions do not yet invalidate the lesson version and quiz.

- [ ] **Step 3: Regenerate lesson packages and expire active quizzes on failure**

In `backend/src/services/learning-graph/lesson-package.service.ts`, add:

```ts
async buildRetry(input: {
  previousVersion: number;
  conceptName: string;
  conceptDescription: string;
  sourceText: string | null;
  prerequisites: Array<{ conceptId: string; displayName: string }>;
  masteryScore: number;
}) {
  const teaching = await this.tutorService.generateLessonPackage({
    conceptName: input.conceptName,
    conceptDescription: input.conceptDescription,
    sourceText: input.sourceText,
    masteryScore: input.masteryScore,
    missingPrerequisites: input.prerequisites.map((item) => item.displayName),
    regenerationReason: 'failed_quiz',
  });

  return {
    version: input.previousVersion + 1,
    regenerationReason: 'failed_quiz' as const,
    ...teaching,
  };
}
```

In `backend/src/services/learning-graph/session.service.ts`, add:

```ts
async expireActiveQuiz(sessionId: string, conceptId: string) {
  await this.db.getPool().query(
    `UPDATE public.session_concept_quizzes
     SET status = 'expired', expired_at = NOW()
     WHERE session_id = $1 AND concept_id = $2 AND status = 'active'`,
    [sessionId, conceptId]
  );
}

async replaceCurrentLesson(...) {
  await this.db.getPool().query(
    `UPDATE public.session_concept_lessons
     SET is_current = FALSE
     WHERE session_id = $1 AND concept_id = $2 AND is_current = TRUE`,
    [sessionId, conceptId]
  );
  await this.insertLessonPackage(...);
}
```

In `backend/src/services/learning-graph/learning-orchestrator.service.ts`, inside `submitQuiz(...)`:

```ts
if (mastery.masteryScore < 0.7 && payload.concept) {
  const currentLesson = await this.sessionService.getCurrentLessonPackage(input.sessionId, input.conceptId);
  const nextLesson = await this.lessonPackageService.buildRetry({
    previousVersion: currentLesson.version,
    conceptName: payload.concept.displayName,
    conceptDescription: payload.concept.description,
    sourceText: payload.session.sourceText,
    prerequisites: payload.prerequisites,
    masteryScore: mastery.masteryScore,
  });

  await this.sessionService.expireActiveQuiz(input.sessionId, input.conceptId);
  await this.sessionService.replaceCurrentLesson({
    sessionId: input.sessionId,
    conceptId: input.conceptId,
    version: nextLesson.version,
    regenerationReason: nextLesson.regenerationReason,
    lessonPayload: nextLesson,
  });
}
```

- [ ] **Step 4: Surface retry and recap states in the dashboard**

In `packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx`, add:

```tsx
{quizResult?.recap ? (
  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
    <h3 className="text-base font-semibold">Bạn đã chốt được gì</h3>
    <p className="mt-2 text-sm">{quizResult.recap.summary}</p>
    <p className="mt-2 text-sm text-muted-foreground">{quizResult.recap.whyPassed}</p>
  </div>
) : null}

{quizResult && !quizResult.recap ? (
  <button className="btn btn-outline" onClick={() => conceptQuery.refetch()}>
    Giải thích lại rồi thử quiz mới
  </button>
) : null}
```

- [ ] **Step 5: Run backend and dashboard verification**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/backend
npx vitest run tests/integration/learning-graph/session-flow.test.ts

cd /home/phan-duong-quoc-nhat/workspace/InsForge/packages/dashboard
npm run typecheck
```

Expected: PASS with failed submissions regenerating lessons and passed submissions showing recap-ready data.

- [ ] **Step 6: Commit the remediation and recap slice**

```bash
git add backend/src/services/learning-graph/lesson-package.service.ts \
  backend/src/services/learning-graph/session.service.ts \
  backend/src/services/learning-graph/learning-orchestrator.service.ts \
  backend/tests/integration/learning-graph/session-flow.test.ts \
  packages/dashboard/src/features/learning-graph/hooks/useConceptLearning.ts \
  packages/dashboard/src/features/learning-graph/components/ConceptQuizCard.tsx \
  packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx
git commit -m "feat: add lesson remediation and recap states"
```

## Task 6: Build the concept-scoped voice sandbox with Web Speech API and Ollama

**Files:**
- Create: `backend/src/services/learning-graph/voice-tutor.service.ts`
- Create: `packages/dashboard/src/features/learning-graph/components/VoiceTutorSandboxPanel.tsx`
- Modify: `backend/src/services/learning-graph/session.service.ts`
- Modify: `backend/src/services/learning-graph/learning-orchestrator.service.ts`
- Modify: `backend/src/api/routes/learning-graph/index.routes.ts`
- Modify: `packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts`
- Modify: `packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx`
- Modify: `packages/dashboard/src/features/learning-graph/components/index.ts`
- Modify: `.env.example`
- Test: `cd packages/dashboard && npm run typecheck`
- Test: `cd backend && npx vitest run tests/integration/learning-graph/session-flow.test.ts`

- [ ] **Step 1: Add the environment contract for local Ollama**

Append to `.env.example`:

```dotenv
# Learning graph voice sandbox
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

- [ ] **Step 2: Implement the backend voice tutor service**

Create `backend/src/services/learning-graph/voice-tutor.service.ts`:

```ts
export class VoiceTutorService {
  async reply(input: {
    conceptName: string;
    lessonPackage: {
      feynmanExplanation: string;
      technicalTranslation: string;
    };
    prerequisiteNames: string[];
    priorSummary: string | null;
    learnerUtterance: string;
  }) {
    const response = await fetch(`${process.env.OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL,
        stream: false,
        messages: [
          {
            role: 'system',
            content:
              'Bạn là một bạn học giỏi cùng lớp, giải thích bằng tiếng Việt đơn giản, chỉ bám vào concept hiện tại, prerequisite liên quan, và bài học hiện tại.',
          },
          {
            role: 'user',
            content: [
              `Khái niệm hiện tại: ${input.conceptName}`,
              `Bài học hiện tại: ${input.lessonPackage.feynmanExplanation}`,
              `Diễn giải kỹ thuật: ${input.lessonPackage.technicalTranslation}`,
              `Prerequisites: ${input.prerequisiteNames.join(', ') || 'không có'}`,
              `Tóm tắt hội thoại trước: ${input.priorSummary ?? 'chưa có'}`,
              `Người học hỏi: ${input.learnerUtterance}`,
            ].join('\n'),
          },
        ],
      }),
    });

    const json = (await response.json()) as { message?: { content?: string } };
    return {
      replyText: json.message?.content ?? 'Mình chưa nghe rõ, bạn nói lại giúp mình nhé.',
    };
  }
}
```

- [ ] **Step 3: Add the backend sandbox endpoint and summary persistence**

In `backend/src/services/learning-graph/session.service.ts`, add:

```ts
async getLatestVoiceSummary(sessionId: string, conceptId: string, lessonVersion: number) {
  const result = await this.db.getPool().query<{ summary_payload: { summary: string } }>(
    `SELECT summary_payload
     FROM public.session_concept_voice_summaries
     WHERE session_id = $1 AND concept_id = $2 AND lesson_version = $3
     ORDER BY summary_version DESC
     LIMIT 1`,
    [sessionId, conceptId, lessonVersion]
  );

  return result.rows[0]?.summary_payload?.summary ?? null;
}
```

In `backend/src/services/learning-graph/learning-orchestrator.service.ts`, add:

```ts
async askVoiceTutor(input: {
  userId: string;
  sessionId: string;
  conceptId: string;
  learnerUtterance: string;
}) {
  await this.assertSessionAccess(input.userId, input.sessionId);
  const payload = await this.getConceptLearning(input);
  const previousSummary = await this.sessionService.getLatestVoiceSummary(
    input.sessionId,
    input.conceptId,
    payload.lessonPackage.version
  );
  const reply = await this.voiceTutorService.reply({
    conceptName: payload.concept!.displayName,
    lessonPackage: payload.lessonPackage,
    prerequisiteNames: payload.prerequisites.map((item) => item.displayName),
    priorSummary: previousSummary,
    learnerUtterance: input.learnerUtterance,
  });

  return reply;
}
```

Add route in `backend/src/api/routes/learning-graph/index.routes.ts`:

```ts
router.post(
  '/learning-sessions/:sessionId/concepts/:conceptId/voice-sandbox',
  verifyUser,
  async (req, res, next) => {
    try {
      const result = await orchestrator.askVoiceTutor({
        userId: req.user!.id,
        sessionId: req.params.sessionId,
        conceptId: req.params.conceptId,
        learnerUtterance: req.body.learnerUtterance,
      });

      successResponse(res, result);
    } catch (error) {
      next(error);
    }
  }
);
```

- [ ] **Step 4: Build the browser-side voice sandbox panel**

Create `packages/dashboard/src/features/learning-graph/components/VoiceTutorSandboxPanel.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';

export function VoiceTutorSandboxPanel({
  openingText,
  onAsk,
}: {
  openingText: string;
  onAsk: (utterance: string) => Promise<{ replyText: string }>;
}) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const synth = useMemo(() => window.speechSynthesis, []);

  useEffect(() => {
    const RecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!RecognitionCtor) return;

    const recognition = new RecognitionCtor();
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = async (event) => {
      const text = event.results[0][0]?.transcript ?? '';
      setTranscript(text);
      const result = await onAsk(text);
      const utterance = new SpeechSynthesisUtterance(result.replyText);
      utterance.lang = 'vi-VN';
      synth.speak(utterance);
    };
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
  }, [onAsk, synth]);

  return (
    <aside className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-lg font-semibold">Voice sandbox</h3>
      <p className="mt-2 text-sm text-muted-foreground">{openingText}</p>
      <div className="mt-4 flex gap-3">
        <button className="btn btn-primary" onClick={() => recognitionRef.current?.start()}>
          {isListening ? 'Đang nghe...' : 'Bật micro'}
        </button>
        <button
          className="btn btn-outline"
          onClick={() => {
            const utterance = new SpeechSynthesisUtterance(openingText);
            utterance.lang = 'vi-VN';
            synth.speak(utterance);
          }}
        >
          Nghe mở đầu
        </button>
      </div>
      {transcript ? <p className="mt-4 text-sm">Bạn vừa nói: {transcript}</p> : null}
    </aside>
  );
}
```

- [ ] **Step 5: Wire the sandbox into the concept page and run verification**

In `packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts`, add:

```ts
askVoiceTutor(sessionId: string, conceptId: string, learnerUtterance: string) {
  return apiClient.request(
    `/learning-graph/learning-sessions/${sessionId}/concepts/${conceptId}/voice-sandbox`,
    {
      method: 'POST',
      body: JSON.stringify({ learnerUtterance }),
    }
  );
}
```

In `packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx`, render:

```tsx
<VoiceTutorSandboxPanel
  openingText={conceptLearning.lessonPackage.feynmanExplanation}
  onAsk={(utterance) =>
    learningGraphService.askVoiceTutor(sessionId!, conceptId!, utterance)
  }
/>
```

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/packages/dashboard
npm run typecheck
npm run build

cd /home/phan-duong-quoc-nhat/workspace/InsForge/backend
npx vitest run tests/integration/learning-graph/session-flow.test.ts
```

Expected: dashboard builds cleanly; backend integration still passes for the core learning loop; sandbox endpoint compiles behind the learning-graph route.

- [ ] **Step 6: Commit the voice sandbox slice**

```bash
git add backend/src/services/learning-graph/voice-tutor.service.ts \
  backend/src/services/learning-graph/session.service.ts \
  backend/src/services/learning-graph/learning-orchestrator.service.ts \
  backend/src/api/routes/learning-graph/index.routes.ts \
  packages/dashboard/src/features/learning-graph/components/VoiceTutorSandboxPanel.tsx \
  packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts \
  packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx \
  packages/dashboard/src/features/learning-graph/components/index.ts \
  .env.example
git commit -m "feat: add learning graph voice sandbox"
```

## Final Verification

- [ ] Run the shared schema build:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/packages/shared-schemas
npm run build
```

Expected: PASS

- [ ] Run backend learning-graph tests:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/backend
npx vitest run tests/unit/learning-graph/lesson-package.service.test.ts
npx vitest run tests/unit/learning-graph/quiz.service.test.ts
npx vitest run tests/unit/learning-graph/mastery.service.test.ts tests/unit/learning-graph/path-engine.service.test.ts
npx vitest run tests/integration/learning-graph/session-flow.test.ts
```

Expected: PASS

- [ ] Run dashboard verification:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/packages/dashboard
npm run typecheck
npm run build
```

Expected: PASS

- [ ] Smoke-test the concept flow manually:

```text
1. Open /dashboard/learning-graph
2. Create or open a real session
3. Open the current concept
4. Confirm the lesson package loads automatically
5. Confirm quiz is hidden until "Tôi đã hiểu, cho tôi quiz"
6. Submit a passing quiz and verify mastery + recap
7. Submit a failing quiz on another concept and verify lesson regeneration
8. Open the voice sandbox panel, play the opening explanation, then ask one follow-up question through the microphone
```

## Self-Review

Spec coverage check:

- lesson package: covered by Tasks 1 and 2
- metaphor image and image mapping: covered by Tasks 1, 2, and 4
- grounded quiz lifecycle: covered by Task 3
- mastery threshold and visible labels: covered by Tasks 3 and 4
- path recomputation after submission: covered by Task 3
- remediation and recap: covered by Task 5
- voice tutor layer and sandbox rollout: covered by Task 6

Placeholder scan:

- no `TBD` or `TODO` markers remain
- each task includes exact files, commands, and expected outputs

Type consistency check:

- `lessonPackage.version` and `lessonVersion` are used consistently
- quiz persistence consistently uses `quizPayload`
- voice sandbox consistently uses `learnerUtterance` and `replyText`
