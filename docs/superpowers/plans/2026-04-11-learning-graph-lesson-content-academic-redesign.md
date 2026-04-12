# Learning Graph Lesson Content Academic Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển lesson content sang cấu trúc học thuật chuẩn, bỏ phụ thuộc mặc định vào Feynman/metaphor/image, và dùng easy explanation generate-on-demand cho UI, voice tutor, và quiz context.

**Architecture:** Đổi `lessonPackage` sang contract `formatVersion: 2` với `mainLesson` là source of truth học thuật. Backend lazy-regenerate payload cũ khi load concept, còn frontend render lesson text-first và chỉ generate phần giải thích dễ hiểu khi người dùng chủ động bấm. Voice tutor và quiz chuyển sang bám vào `mainLesson` thay vì `feynmanExplanation`.

**Tech Stack:** TypeScript, Zod, Vitest, React 19, TanStack Query, Tailwind utility classes

---

## File Structure

- Modify: `packages/shared-schemas/src/learning-graph-api.schema.ts`
  Responsibility: định nghĩa `lessonPackageSchema` format mới với `formatVersion` và `mainLesson`.
- Modify: `backend/src/services/learning-graph/tutor.service.ts`
  Responsibility: sinh lesson học thuật và easy explanation on-demand; bỏ metaphor/Feynman mặc định.
- Modify: `backend/src/services/learning-graph/lesson-package.service.ts`
  Responsibility: detect payload legacy theo shape/schema version và lazy-regenerate sang format mới.
- Modify: `backend/src/services/learning-graph/voice-tutor.service.ts`
  Responsibility: dùng `mainLesson` làm prompt context cho tutor thay vì `feynmanExplanation`.
- Modify: `backend/src/services/learning-graph/quiz.service.ts`
  Responsibility: dùng summary và technical example từ `mainLesson`, không còn `exampleOrAnalogy`.
- Modify: `backend/src/services/learning-graph/quiz-generation.prompts.ts`
  Responsibility: cập nhật input contract quiz prompt theo academic lesson.
- Modify: `backend/src/services/learning-graph/learning-orchestrator.service.ts`
  Responsibility: truyền lesson context mới vào explanation, quiz, và voice tutor flows.
- Modify: `backend/tests/unit/learning-graph/tutor.service.test.ts`
  Responsibility: khóa output lesson học thuật và easy explanation mới.
- Modify: `backend/tests/unit/learning-graph/lesson-package.service.test.ts`
  Responsibility: khóa lazy regeneration từ payload legacy sang `formatVersion: 2`.
- Modify: `backend/tests/unit/learning-graph/voice-tutor.service.test.ts`
  Responsibility: khóa prompt context mới của voice tutor.
- Modify: `backend/tests/unit/learning-graph/quiz.service.test.ts`
  Responsibility: khóa quiz context mới không còn phụ thuộc Feynman/analogy mặc định.
- Modify: `backend/tests/integration/learning-graph/session-flow.test.ts`
  Responsibility: cập nhật end-to-end expectations cho lesson payload, explanation generation, quiz generation, và voice tutor.
- Modify: `packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts`
  Responsibility: đổi `LessonPackagePayload` sang shape học thuật mới.
- Modify: `packages/dashboard/src/features/learning-graph/components/ConceptLessonCard.tsx`
  Responsibility: render lesson article học thuật, inline easy explanation section, và CTA rõ nghĩa.
- Delete: `packages/dashboard/src/features/learning-graph/components/ConceptExplanationCard.tsx`
  Responsibility: bỏ card phụ semantics cũ đã bị hợp nhất vào lesson card.
- Modify: `packages/dashboard/src/features/learning-graph/components/index.ts`
  Responsibility: gỡ export `ConceptExplanationCard`.
- Modify: `packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx`
  Responsibility: bỏ explanation card cũ, đưa easy explanation flow vào lesson card, và truyền opening text mới cho voice tutor.
- Modify: `packages/dashboard/src/features/learning-graph/hooks/useConceptLearning.ts`
  Responsibility: giữ mutation `generateExplanation` nhưng đổi semantics thành easy explanation on-demand.
- Create: `packages/dashboard/src/features/learning-graph/lib/concept-lesson-content.ts`
  Responsibility: chuẩn hóa `mainLesson` thành các section render ổn định cho UI.
- Create: `packages/dashboard/src/features/learning-graph/lib/__tests__/concept-lesson-content.test.ts`
  Responsibility: test transformation/render metadata của lesson học thuật.

## Task 1: Đổi lesson contract sang academic format và lazy-regenerate payload legacy

**Files:**
- Modify: `packages/shared-schemas/src/learning-graph-api.schema.ts`
- Modify: `backend/src/services/learning-graph/tutor.service.ts`
- Modify: `backend/src/services/learning-graph/lesson-package.service.ts`
- Modify: `backend/tests/unit/learning-graph/tutor.service.test.ts`
- Modify: `backend/tests/unit/learning-graph/lesson-package.service.test.ts`

- [ ] **Step 1: Viết test fail cho lesson academic format mới**

```ts
it('builds an academic lesson package with structured mainLesson fields', async () => {
  const service = new TutorService();

  const result = await service.generateLessonPackage({
    conceptName: 'HTML semantic và cấu trúc trang',
    conceptDescription: 'Semantic HTML dùng các thẻ có ý nghĩa để mô tả cấu trúc nội dung.',
    sourceText: `Các ý chính:
- semantic HTML giúp trình duyệt và công cụ hỗ trợ hiểu vai trò của từng vùng nội dung
- thẻ như header, main, section, article, nav, footer mô tả cấu trúc trang
- cấu trúc rõ ràng giúp bảo trì và accessibility tốt hơn`,
    masteryScore: 0,
    missingPrerequisites: [],
  });

  expect(result.formatVersion).toBe(2);
  expect(result.mainLesson.definition.toLowerCase()).toContain('semantic');
  expect(result.mainLesson.importance.length).toBeGreaterThan(0);
  expect(result.mainLesson.corePoints.length).toBeGreaterThan(0);
  expect(result.mainLesson.technicalExample.toLowerCase()).toContain('header');
  expect(result.mainLesson.commonMisconceptions.length).toBeGreaterThan(0);
});
```

```ts
it('regenerates legacy payloads into formatVersion 2 lesson packages', async () => {
  const legacyLessonPackage = {
    version: 1,
    regenerationReason: 'initial' as const,
    feynmanExplanation: 'HTML semantic giống như garage với bản thiết kế xe.',
    metaphorImage: {
      imageUrl: 'https://example.com/legacy.png',
      prompt: 'legacy prompt',
    },
    imageMapping: [],
    imageReadingText: 'legacy',
    technicalTranslation: 'legacy technical translation',
    prerequisiteMiniLessons: [],
  };

  const regeneratedLessonPackage = {
    version: 2,
    formatVersion: 2 as const,
    regenerationReason: 'academic_redesign' as const,
    mainLesson: {
      definition: 'Semantic HTML dùng thẻ có ý nghĩa để mô tả cấu trúc nội dung.',
      importance: 'Cấu trúc đúng giúp accessibility và maintainability tốt hơn.',
      corePoints: ['header, main, section, article, nav, footer có vai trò khác nhau.'],
      technicalExample: '<main><article><h1>Bài viết</h1></article></main>',
      commonMisconceptions: ['Semantic HTML không chỉ là đổi tên div.'],
    },
    prerequisiteMiniLessons: [],
  };

  vi.spyOn(SessionService.prototype, 'getCurrentLessonPackage')
    .mockResolvedValueOnce(legacyLessonPackage)
    .mockResolvedValueOnce(regeneratedLessonPackage);
  vi.spyOn(TutorService.prototype, 'generateLessonPackage').mockResolvedValue(regeneratedLessonPackage);
  vi.spyOn(SessionService.prototype, 'insertLessonPackage').mockResolvedValue(true);

  const service = new LessonPackageService();
  const result = await service.getOrCreateCurrentLessonPackage({
    sessionId: '55555555-5555-5555-5555-555555555555',
    conceptId: '66666666-6666-6666-6666-666666666666',
    conceptName: 'HTML semantic và cấu trúc trang',
    conceptDescription: 'Semantic HTML mô tả cấu trúc nội dung.',
    sourceText: 'Semantic HTML mô tả vai trò của từng vùng nội dung.',
    masteryScore: 0,
    prerequisites: [],
  });

  expect(result.formatVersion).toBe(2);
  expect(result.regenerationReason).toBe('academic_redesign');
});
```

- [ ] **Step 2: Chạy unit tests để xác nhận contract mới chưa được hỗ trợ**

Run: `cd backend && npx vitest run tests/unit/learning-graph/tutor.service.test.ts tests/unit/learning-graph/lesson-package.service.test.ts`
Expected: FAIL with errors mentioning missing `formatVersion`, missing `mainLesson`, or legacy assertions around `feynmanExplanation`.

- [ ] **Step 3: Đổi shared schema và TutorService sang lesson học thuật**

```ts
export const academicLessonSchema = z.object({
  definition: z.string(),
  importance: z.string(),
  corePoints: z.array(z.string()).min(1),
  technicalExample: z.string(),
  commonMisconceptions: z.array(z.string()).default([]),
});

export const lessonPackageSchema = z.object({
  version: z.number().int().min(1),
  formatVersion: z.literal(2),
  regenerationReason: z.enum([
    'initial',
    'failed_quiz',
    'simpler_reexplain',
    'prerequisite_refresh',
    'academic_redesign',
  ]),
  mainLesson: academicLessonSchema,
  prerequisiteMiniLessons: z.array(
    z.object({
      prerequisiteConceptId: z.string().uuid(),
      title: z.string(),
      content: z.string(),
    })
  ).default([]),
});
```

```ts
return lessonPackageSchema.parse({
  version: input.version ?? 1,
  formatVersion: 2,
  regenerationReason: input.regenerationReason ?? 'initial',
  mainLesson: {
    definition: parsed.definition,
    importance: parsed.importance,
    corePoints: parsed.corePoints,
    technicalExample: parsed.technicalExample,
    commonMisconceptions: parsed.commonMisconceptions,
  },
  prerequisiteMiniLessons: input.missingPrerequisites.map((item) => ({
    prerequisiteConceptId: item.id,
    title: `Ôn lại ${item.displayName}`,
    content: `${item.displayName}: ${item.description}`,
  })),
});
```

- [ ] **Step 4: Đổi legacy detection sang shape-based regeneration**

```ts
private isAcademicLessonPackage(value: unknown): value is LessonPackageSchema {
  return lessonPackageSchema.safeParse(value).success;
}

async getOrCreateCurrentLessonPackage(input: {
  sessionId: string;
  conceptId: string;
  conceptName: string;
  conceptDescription: string;
  sourceText: string | null;
  masteryScore: number;
  prerequisites: LessonPackagePrerequisiteInput[];
}): Promise<LessonPackageSchema> {
  const currentLessonPackage = await this.sessionService.getCurrentLessonPackage(
    input.sessionId,
    input.conceptId
  );

  if (this.isAcademicLessonPackage(currentLessonPackage)) {
    return currentLessonPackage;
  }

  const nextVersion =
    currentLessonPackage && typeof currentLessonPackage === 'object' && 'version' in currentLessonPackage
      ? Number((currentLessonPackage as { version?: unknown }).version ?? 1) + 1
      : 1;

  const regeneratedLessonPackage = await this.tutorService.generateLessonPackage({
    conceptName: input.conceptName,
    conceptDescription: input.conceptDescription,
    sourceText: input.sourceText,
    masteryScore: input.masteryScore,
    missingPrerequisites: input.prerequisites,
    regenerationReason: currentLessonPackage ? 'academic_redesign' : 'initial',
    version: nextVersion,
  });
```

- [ ] **Step 5: Chạy lại unit tests và shared schema build**

Run: `cd backend && npx vitest run tests/unit/learning-graph/tutor.service.test.ts tests/unit/learning-graph/lesson-package.service.test.ts && cd ../packages/shared-schemas && npm run build`
Expected: PASS for both unit files and `tsc` build completes without schema errors.

- [ ] **Step 6: Commit contract migration task**

```bash
git add packages/shared-schemas/src/learning-graph-api.schema.ts \
  backend/src/services/learning-graph/tutor.service.ts \
  backend/src/services/learning-graph/lesson-package.service.ts \
  backend/tests/unit/learning-graph/tutor.service.test.ts \
  backend/tests/unit/learning-graph/lesson-package.service.test.ts
git commit -m "feat: redesign lesson packages around academic content"
```

## Task 2: Cập nhật explanation, voice tutor, và quiz để dùng `mainLesson`

**Files:**
- Modify: `backend/src/services/learning-graph/voice-tutor.service.ts`
- Modify: `backend/src/services/learning-graph/quiz.service.ts`
- Modify: `backend/src/services/learning-graph/quiz-generation.prompts.ts`
- Modify: `backend/src/services/learning-graph/learning-orchestrator.service.ts`
- Modify: `backend/tests/unit/learning-graph/voice-tutor.service.test.ts`
- Modify: `backend/tests/unit/learning-graph/quiz.service.test.ts`

- [ ] **Step 1: Viết test fail cho voice tutor và quiz context mới**

```ts
await service.reply({
  conceptName: 'Giới thiệu về OOP',
  lessonPackage: {
    mainLesson: {
      definition: 'OOP tổ chức chương trình quanh class và object.',
      importance: 'Giúp gom dữ liệu và hành vi theo từng thực thể.',
      corePoints: ['Class là khuôn mẫu.', 'Object là thực thể cụ thể.'],
      technicalExample: 'const car = new Car();',
      commonMisconceptions: ['Class không phải object đang chạy.'],
    },
  },
  prerequisiteNames: [],
  priorSummary: null,
  learnerUtterance: 'giải thích dễ hiểu hơn giúp tôi class và object',
});
```

```ts
const artifact = await service.buildQuizForConcept({
  ...makeQuizInput(),
  explanationSummary: 'OOP tổ chức chương trình quanh class và object.',
  technicalExample: 'const car = new Car();',
});

expect(artifact.questionCountTarget).toBe(3);
expect(artifact.questions[0]?.skillTag).not.toBeUndefined();
```

- [ ] **Step 2: Chạy targeted tests để xác nhận các service hiện vẫn phụ thuộc field cũ**

Run: `cd backend && npx vitest run tests/unit/learning-graph/voice-tutor.service.test.ts tests/unit/learning-graph/quiz.service.test.ts`
Expected: FAIL with type errors or runtime errors mentioning `feynmanExplanation`, `technicalTranslation`, or `exampleOrAnalogy`.

- [ ] **Step 3: Đổi prompt context của VoiceTutorService sang `mainLesson`**

```ts
interface VoiceTutorLessonContext {
  mainLesson: {
    definition: string;
    importance: string;
    corePoints: string[];
    technicalExample: string;
    commonMisconceptions: string[];
  };
}
```

```ts
content: [
  `Khái niệm hiện tại: ${input.conceptName}`,
  `Khái niệm là gì: ${input.lessonPackage.mainLesson.definition}`,
  `Vì sao quan trọng: ${input.lessonPackage.mainLesson.importance}`,
  `Ý cốt lõi: ${input.lessonPackage.mainLesson.corePoints.join(' | ')}`,
  `Ví dụ kỹ thuật: ${input.lessonPackage.mainLesson.technicalExample}`,
  `Điểm dễ hiểu sai: ${input.lessonPackage.mainLesson.commonMisconceptions.join(' | ') || 'không có'}`,
  `Prerequisites liên quan: ${input.prerequisiteNames.join(', ') || 'không có'}`,
  `Tóm tắt hội thoại trước: ${input.priorSummary ?? 'chưa có'}`,
  `Người học hỏi: ${input.learnerUtterance}`,
].join('\n')
```

- [ ] **Step 4: Đổi QuizService và quiz prompt input để bỏ `exampleOrAnalogy`**

```ts
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
```

```ts
resolveQuestionCountTarget(input: {
  learnerMastery: number | null;
  technicalExample: string | null;
  missingPrerequisites: string[];
  lessonPackage: LessonPackageSchema;
}) {
  const richnessScore = [
    input.technicalExample ? 1 : 0,
    input.lessonPackage.mainLesson.commonMisconceptions.length > 0 ? 1 : 0,
    input.lessonPackage.prerequisiteMiniLessons.length > 0 ? 1 : 0,
    input.learnerMastery != null && input.learnerMastery >= 0.7 ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);
```

```ts
{
  language: 'vi',
  concept_name: input.conceptName,
  concept_description: input.conceptDescription,
  explanation_summary: input.explanationSummary,
  technical_example: input.technicalExample,
  missing_prerequisites: input.missingPrerequisites,
  learner_mastery: input.learnerMastery,
  difficulty_target: input.difficultyTarget,
  question_count_target: input.questionCountTarget,
}
```

- [ ] **Step 5: Cập nhật orchestrator để build summary từ `mainLesson`**

```ts
const explanationSummary = [
  lessonPackage.mainLesson.definition,
  lessonPackage.mainLesson.importance,
  ...lessonPackage.mainLesson.corePoints,
  ...lessonPackage.mainLesson.commonMisconceptions,
]
  .filter(Boolean)
  .join(' ');

const quiz = await this.quizService.buildQuizForConcept({
  quizId: crypto.randomUUID(),
  sessionId: input.sessionId,
  conceptId: input.conceptId,
  conceptName: concept.displayName,
  conceptDescription: concept.description,
  explanationSummary,
  technicalExample: lessonPackage.mainLesson.technicalExample,
  missingPrerequisites: prerequisites.map((item) => item.displayName),
  learnerMastery: mastery?.masteryScore ?? null,
  lessonPackage,
});
```

- [ ] **Step 6: Chạy backend unit tests cho tutor/quiz services**

Run: `cd backend && npx vitest run tests/unit/learning-graph/voice-tutor.service.test.ts tests/unit/learning-graph/quiz.service.test.ts`
Expected: PASS and assertions no longer mention `feynmanExplanation`.

- [ ] **Step 7: Commit service consumer migration**

```bash
git add backend/src/services/learning-graph/voice-tutor.service.ts \
  backend/src/services/learning-graph/quiz.service.ts \
  backend/src/services/learning-graph/quiz-generation.prompts.ts \
  backend/src/services/learning-graph/learning-orchestrator.service.ts \
  backend/tests/unit/learning-graph/voice-tutor.service.test.ts \
  backend/tests/unit/learning-graph/quiz.service.test.ts
git commit -m "feat: use academic lesson context for tutor and quiz"
```

## Task 3: Đổi lesson UI sang article học thuật và inline easy explanation

**Files:**
- Modify: `packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts`
- Modify: `packages/dashboard/src/features/learning-graph/hooks/useConceptLearning.ts`
- Modify: `packages/dashboard/src/features/learning-graph/components/ConceptLessonCard.tsx`
- Delete: `packages/dashboard/src/features/learning-graph/components/ConceptExplanationCard.tsx`
- Modify: `packages/dashboard/src/features/learning-graph/components/index.ts`
- Modify: `packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx`
- Create: `packages/dashboard/src/features/learning-graph/lib/concept-lesson-content.ts`
- Create: `packages/dashboard/src/features/learning-graph/lib/__tests__/concept-lesson-content.test.ts`

- [ ] **Step 1: Viết test fail cho lesson section builder**

```ts
import { describe, expect, it } from 'vitest';
import { buildConceptLessonSections } from '../concept-lesson-content';

describe('buildConceptLessonSections', () => {
  it('maps mainLesson into academic sections without metaphor blocks', () => {
    const result = buildConceptLessonSections({
      definition: 'Semantic HTML dùng thẻ có ý nghĩa để mô tả cấu trúc nội dung.',
      importance: 'Giúp accessibility và maintainability tốt hơn.',
      corePoints: ['header và footer có vai trò riêng.', 'main chứa nội dung chính.'],
      technicalExample: '<main><article><h1>Tiêu đề</h1></article></main>',
      commonMisconceptions: ['Semantic HTML không chỉ là đổi div thành section.'],
    });

    expect(result.map((section) => section.title)).toEqual([
      'Khái niệm là gì',
      'Vì sao quan trọng',
      'Thành phần / quy tắc cốt lõi',
      'Ví dụ kỹ thuật đúng ngữ cảnh',
      'Lỗi hiểu sai thường gặp',
    ]);
  });
});
```

- [ ] **Step 2: Chạy test lib để xác nhận helper chưa tồn tại**

Run: `cd packages/dashboard && npx vitest run src/features/learning-graph/lib/__tests__/concept-lesson-content.test.ts`
Expected: FAIL with `Cannot find module '../concept-lesson-content'`.

- [ ] **Step 3: Tạo lesson content helper và đổi client payload types**

```ts
export interface LessonPackagePayload {
  version: number;
  formatVersion: 2;
  regenerationReason:
    | 'initial'
    | 'failed_quiz'
    | 'simpler_reexplain'
    | 'prerequisite_refresh'
    | 'academic_redesign';
  mainLesson: {
    definition: string;
    importance: string;
    corePoints: string[];
    technicalExample: string;
    commonMisconceptions: string[];
  };
  prerequisiteMiniLessons: Array<{
    prerequisiteConceptId: string;
    title: string;
    content: string;
  }>;
}
```

```ts
export function buildConceptLessonSections(mainLesson: LessonPackagePayload['mainLesson']) {
  return [
    { title: 'Khái niệm là gì', paragraphs: [mainLesson.definition] },
    { title: 'Vì sao quan trọng', paragraphs: [mainLesson.importance] },
    { title: 'Thành phần / quy tắc cốt lõi', bullets: mainLesson.corePoints },
    { title: 'Ví dụ kỹ thuật đúng ngữ cảnh', paragraphs: [mainLesson.technicalExample] },
    { title: 'Lỗi hiểu sai thường gặp', bullets: mainLesson.commonMisconceptions },
  ];
}
```

- [ ] **Step 4: Viết lại ConceptLessonCard thành academic article có easy explanation inline**

```tsx
interface ConceptLessonCardProps {
  conceptName: string;
  lesson: LessonPackagePayload;
  easyExplanation: string;
  onRequestEasyExplanation: () => void | Promise<unknown>;
  isGeneratingEasyExplanation: boolean;
  onRevealQuiz: () => void | Promise<unknown>;
  isRevealingQuiz: boolean;
}
```

```tsx
<section className="space-y-5">
  <div className="space-y-2">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      Học theo cách khác
    </p>
    <h3 className="text-2xl font-semibold text-foreground">Giải thích theo cách dễ hiểu</h3>
  </div>
  {!easyExplanation ? (
    <div className="rounded-[20px] border border-dashed border-[var(--alpha-8)] px-4 py-4 text-sm leading-7 text-muted-foreground">
      Khi cần một cách diễn đạt đơn giản hơn, bấm nút bên dưới để tạo lời giải thích mới.
    </div>
  ) : (
    <div className="rounded-[24px] bg-[var(--alpha-2)] px-5 py-4">
      <p className="whitespace-pre-wrap text-base leading-8 text-foreground">{easyExplanation}</p>
    </div>
  )}
</section>
```

```tsx
<div className="flex flex-wrap gap-3">
  <Button
    type="button"
    variant="outline"
    onClick={() => void onRequestEasyExplanation()}
    disabled={isGeneratingEasyExplanation}
  >
    {isGeneratingEasyExplanation ? 'Đang tạo...' : 'Giải thích theo cách dễ hiểu'}
  </Button>
  <Button type="button" onClick={() => void onRevealQuiz()} disabled={isRevealingQuiz}>
    {isRevealingQuiz ? 'Đang mở quiz...' : 'Tôi đã hiểu, cho tôi quiz'}
  </Button>
</div>
```

- [ ] **Step 5: Gỡ explanation card cũ khỏi page wiring**

```tsx
<ConceptLessonCard
  conceptName={conceptLearning.concept.displayName}
  lesson={conceptLearning.lessonPackage}
  easyExplanation={explanation}
  onRequestEasyExplanation={generateExplanation}
  isGeneratingEasyExplanation={isGeneratingExplanation}
  onRevealQuiz={handleRevealQuiz}
  isRevealingQuiz={isRevealingQuiz}
/>
```

```tsx
const voiceTutorOpeningText = conceptLearning
  ? [
      conceptLearning.lessonPackage.mainLesson.definition,
      conceptLearning.lessonPackage.mainLesson.importance,
    ]
      .filter(Boolean)
      .join(' ')
  : '';
```

```ts
export * from './LearningPathPanel';
export * from './ConceptLessonCard';
export * from './ConceptMasteryCard';
export * from './ConceptQuizCard';
```

- [ ] **Step 6: Chạy lesson helper test và dashboard typecheck**

Run: `cd packages/dashboard && npx vitest run src/features/learning-graph/lib/__tests__/concept-lesson-content.test.ts && npm run typecheck`
Expected: PASS and dashboard typecheck succeeds without references to `feynmanExplanation`, `technicalTranslation`, or `ConceptExplanationCard`.

- [ ] **Step 7: Commit dashboard lesson redesign**

```bash
git add packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts \
  packages/dashboard/src/features/learning-graph/hooks/useConceptLearning.ts \
  packages/dashboard/src/features/learning-graph/components/ConceptLessonCard.tsx \
  packages/dashboard/src/features/learning-graph/components/index.ts \
  packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx \
  packages/dashboard/src/features/learning-graph/lib/concept-lesson-content.ts \
  packages/dashboard/src/features/learning-graph/lib/__tests__/concept-lesson-content.test.ts
git rm packages/dashboard/src/features/learning-graph/components/ConceptExplanationCard.tsx
git commit -m "feat: redesign lesson workspace around academic content"
```

## Task 4: Cập nhật integration flow và verify toàn bộ lesson experience mới

**Files:**
- Modify: `backend/tests/integration/learning-graph/session-flow.test.ts`

- [ ] **Step 1: Viết expectation mới cho lesson payload, explanation, quiz, và voice tutor**

```ts
expect(conceptLearning.lessonPackage).toMatchObject({
  version: 1,
  formatVersion: 2,
  regenerationReason: 'initial',
  mainLesson: {
    definition: expect.any(String),
    importance: expect.any(String),
    corePoints: expect.any(Array),
    technicalExample: expect.any(String),
    commonMisconceptions: expect.any(Array),
  },
  prerequisiteMiniLessons: expect.any(Array),
});
expect(conceptLearning.explanation).toBeNull();
expect(explanation.explanation.length).toBeGreaterThan(0);
expect(quiz.quiz.questions[0]).toHaveProperty('skillTag');
expect(quiz.quiz.questions[0]?.options[0]).not.toHaveProperty('isCorrect');
```

```ts
vi.spyOn(SessionService.prototype, 'getCurrentLessonPackage').mockResolvedValue({
  version: 1,
  formatVersion: 2,
  regenerationReason: 'initial',
  mainLesson: {
    definition: 'OOP tổ chức chương trình quanh object và class.',
    importance: 'Giúp mô hình hóa dữ liệu và hành vi.',
    corePoints: ['Class là khuôn mẫu.', 'Object là thực thể cụ thể.'],
    technicalExample: 'const car = new Car();',
    commonMisconceptions: ['Class không phải object cụ thể.'],
  },
  prerequisiteMiniLessons: [],
});
```

- [ ] **Step 2: Chạy integration test cho learning graph session flow**

Run: `cd backend && npx vitest run tests/integration/learning-graph/session-flow.test.ts`
Expected: PASS with updated lesson payload shape and voice tutor flow.

- [ ] **Step 3: Chạy final verification batch**

Run: `cd backend && npx vitest run tests/unit/learning-graph/tutor.service.test.ts tests/unit/learning-graph/lesson-package.service.test.ts tests/unit/learning-graph/voice-tutor.service.test.ts tests/unit/learning-graph/quiz.service.test.ts tests/integration/learning-graph/session-flow.test.ts && cd ../packages/dashboard && npm run typecheck`
Expected: PASS for all targeted backend tests and dashboard typecheck.

- [ ] **Step 4: Commit verification-aligned integration updates**

```bash
git add backend/tests/integration/learning-graph/session-flow.test.ts
git commit -m "test: update learning graph session flow for academic lessons"
```

## Self-Review

### Spec coverage

- `main lesson` học thuật mặc định: Task 1 + Task 3
- generate easy explanation lúc bấm: Task 2 + Task 3
- bỏ Feynman khỏi lesson, voice tutor, quiz: Task 1 + Task 2 + Task 4
- lazy regeneration cho payload cũ: Task 1
- bỏ ảnh khỏi flow chính: Task 3

### Placeholder scan

- Không còn `TODO`, `TBD`, hay “write tests for above”.
- Mỗi task có file, code, command, expected output, và commit message cụ thể.

### Type consistency

- Contract thống nhất dùng `formatVersion: 2` và `mainLesson`.
- Voice tutor và quiz đều dùng `technicalExample`, không dùng `exampleOrAnalogy`.
- Frontend payload và backend schema dùng cùng tên field `mainLesson`.
