# Learning Graph Concept-Specific Grounding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm `grounding` riêng cho từng concept để lesson generator, easy explanation, quiz, và tutor không còn bị lẫn nội dung của concept khác trong cùng session.

**Architecture:** Tạo một `ConceptGroundingService` nhỏ để extract `sourceExcerpt`, `sourceHighlights`, và `grounding.quality` từ `session.sourceText` sau khi graph đã được validate. `LessonPackageService` sẽ lấy sibling concepts từ session graph, gọi grounding service, rồi truyền grounding này vào `TutorService`, nơi grounded generation và bleed detection quyết định lesson nào được accept, retry, hay fallback.

**Tech Stack:** TypeScript, Zod, Vitest, backend learning-graph services, shared schema package

---

## File Structure

- Create: `backend/src/services/learning-graph/concept-grounding.service.ts`
  Responsibility: extract `sourceExcerpt`, `sourceHighlights`, và `quality` cho một concept từ `session.sourceText` và sibling concepts.
- Modify: `packages/shared-schemas/src/learning-graph-api.schema.ts`
  Responsibility: thêm `grounding` vào `lessonPackageSchema`.
- Modify: `backend/src/services/learning-graph/lesson-package.service.ts`
  Responsibility: gọi `getGraph()` để lấy sibling concepts, dùng `ConceptGroundingService`, rồi truyền grounding vào `TutorService.generateLessonPackage()`.
- Modify: `backend/src/services/learning-graph/tutor.service.ts`
  Responsibility: đổi input sang `grounding + siblingConceptNames`, thêm bleed detection, grounding-aware prompt, và fallback hierarchy mới.
- Modify: `backend/tests/unit/learning-graph/lesson-package.service.test.ts`
  Responsibility: khóa wiring `LessonPackageService -> ConceptGroundingService -> TutorService`.
- Modify: `backend/tests/unit/learning-graph/tutor.service.test.ts`
  Responsibility: khóa grounded generation, bleed rejection, và fallback hierarchy.
- Modify: `backend/tests/integration/learning-graph/session-flow.test.ts`
  Responsibility: khóa payload `grounding` và chặn regression concept bleed trong flow end-to-end.

## Task 1: Khóa contract `grounding` và extractor behavior

**Files:**
- Modify: `packages/shared-schemas/src/learning-graph-api.schema.ts`
- Create: `backend/src/services/learning-graph/concept-grounding.service.ts`
- Modify: `backend/tests/unit/learning-graph/lesson-package.service.test.ts`

- [ ] **Step 1: Viết test fail cho `grounding` contract và concept-specific excerpt**

```ts
it('extracts concept-specific grounding for component organization instead of using the full session outline', async () => {
  const groundingService = new ConceptGroundingService();

  const grounding = groundingService.extract({
    conceptName: 'Tổ chức giao diện thành component',
    conceptDescription: 'Chia giao diện thành các phần nhỏ có trách nhiệm rõ ràng.',
    siblingConceptNames: [
      'HTML semantic và cấu trúc trang',
      'CSS layout và responsive design',
      'JavaScript nền tảng',
    ],
    sourceText: `1. HTML semantic và cấu trúc trang
HTML semantic là cách dùng các thẻ có ý nghĩa như header, nav, main, section, article, aside, footer.

4. Tổ chức giao diện thành component
Giao diện nên được chia thành các phần nhỏ có trách nhiệm rõ ràng.
Mỗi component nên đại diện cho một phần UI độc lập như button, form, card, modal, navbar hoặc task item.

5. React cơ bản
Cần hiểu JSX, component, props, state.`,
  });

  expect(grounding.quality).toBe('concept_specific');
  expect(grounding.sourceExcerpt).toContain('Giao diện nên được chia thành các phần nhỏ');
  expect(grounding.sourceExcerpt).not.toContain('HTML semantic là cách dùng các thẻ');
  expect(grounding.sourceHighlights.length).toBeGreaterThan(0);
});
```

```ts
const lessonPackage = {
  version: 1,
  formatVersion: 2 as const,
  contentQuality: 'validated' as const,
  regenerationReason: 'initial' as const,
  grounding: {
    sourceExcerpt:
      'Giao diện nên được chia thành các phần nhỏ có trách nhiệm rõ ràng. Mỗi component nên đại diện cho một phần UI độc lập.',
    sourceHighlights: [
      'Giao diện nên được chia thành các phần nhỏ có trách nhiệm rõ ràng.',
      'Mỗi component nên đại diện cho một phần UI độc lập.',
    ],
    quality: 'concept_specific' as const,
  },
  mainLesson: {
    definition: 'Component là cách chia giao diện thành các phần nhỏ có trách nhiệm rõ ràng.',
    importance: 'Nó giúp giao diện dễ bảo trì, tái sử dụng, và phát triển độc lập.',
    corePoints: [
      'Mỗi component nên có trách nhiệm rõ ràng.',
      'Component giúp tái sử dụng UI và tách logic theo phạm vi nhỏ hơn.',
    ],
    technicalExample: '<TaskCard title="Fix bug" status="doing" />',
    commonMisconceptions: ['Component không đồng nghĩa với một file cực nhỏ cho mọi chi tiết UI.'],
  },
  prerequisiteMiniLessons: [],
};
```

- [ ] **Step 2: Chạy test để xác nhận extractor và contract chưa tồn tại**

Run:
- `cd backend && npx vitest run tests/unit/learning-graph/lesson-package.service.test.ts`

Expected:
- FAIL vì chưa có `ConceptGroundingService`
- FAIL vì `lessonPackageSchema` chưa có field `grounding`

- [ ] **Step 3: Viết minimal implementation cho schema grounding và extractor**

```ts
const lessonGroundingSchema = z.object({
  sourceExcerpt: z.string(),
  sourceHighlights: z.array(z.string()).default([]),
  quality: z.enum(['concept_specific', 'session_level', 'weak']),
});

export const lessonPackageSchema = z.object({
  version: z.number().int().min(1),
  formatVersion: z.literal(2),
  contentQuality: z.enum(['validated', 'fallback']),
  regenerationReason: z.enum([
    'initial',
    'failed_quiz',
    'simpler_reexplain',
    'prerequisite_refresh',
    'academic_redesign',
  ]),
  grounding: lessonGroundingSchema,
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
export class ConceptGroundingService {
  extract(input: {
    conceptName: string;
    conceptDescription: string;
    siblingConceptNames: string[];
    sourceText: string | null;
  }) {
    const sourceText = input.sourceText?.trim() ?? '';
    if (!sourceText) {
      return {
        sourceExcerpt: input.conceptDescription,
        sourceHighlights: [input.conceptDescription].filter(Boolean),
        quality: 'weak' as const,
      };
    }

    const paragraphs = sourceText
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);

    const matchingParagraph = paragraphs.find((paragraph) =>
      paragraph.toLowerCase().includes(input.conceptName.toLowerCase())
    );

    if (matchingParagraph) {
      const highlights = matchingParagraph
        .split(/[.!?]\s+/)
        .map((part) => part.trim())
        .filter(Boolean)
        .filter((part) =>
          !input.siblingConceptNames.some((name) => part.toLowerCase().includes(name.toLowerCase()))
        )
        .slice(0, 3);

      return {
        sourceExcerpt: matchingParagraph,
        sourceHighlights: highlights,
        quality: 'concept_specific' as const,
      };
    }

    return {
      sourceExcerpt: sourceText,
      sourceHighlights: sourceText
        .split(/[.!?]\s+/)
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 3),
      quality: 'session_level' as const,
    };
  }
}
```

- [ ] **Step 4: Chạy lại unit test và shared schema build**

Run:
- `cd backend && npx vitest run tests/unit/learning-graph/lesson-package.service.test.ts`
- `cd packages/shared-schemas && npm run build`

Expected:
- PASS cho unit test grounding contract
- PASS cho shared schema build

- [ ] **Step 5: Commit grounding contract và extractor**

```bash
git add packages/shared-schemas/src/learning-graph-api.schema.ts \
  backend/src/services/learning-graph/concept-grounding.service.ts \
  backend/tests/unit/learning-graph/lesson-package.service.test.ts
git commit -m "feat: add concept grounding contract and extractor"
```

## Task 2: Wire `LessonPackageService` to concept grounding

**Files:**
- Modify: `backend/src/services/learning-graph/lesson-package.service.ts`
- Modify: `backend/tests/unit/learning-graph/lesson-package.service.test.ts`

- [ ] **Step 1: Viết test fail cho wiring `LessonPackageService -> ConceptGroundingService`**

```ts
it('passes concept-specific grounding and sibling concepts into TutorService.generateLessonPackage', async () => {
  vi.spyOn(SessionService.prototype, 'getCurrentLessonPackage').mockResolvedValue(null);
  vi.spyOn(SessionService.prototype, 'getGraph').mockResolvedValue({
    concepts: [
      {
        id: 'c1',
        sessionId: 's1',
        canonicalName: 'html-semantic',
        displayName: 'HTML semantic và cấu trúc trang',
        description: 'Semantic HTML mô tả vai trò nội dung.',
        difficulty: 0.2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'c2',
        sessionId: 's1',
        canonicalName: 'component-organization',
        displayName: 'Tổ chức giao diện thành component',
        description: 'Chia giao diện thành các phần nhỏ có trách nhiệm rõ ràng.',
        difficulty: 0.4,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    edges: [],
  });
  vi.spyOn(SessionService.prototype, 'insertLessonPackage').mockResolvedValue(true);

  const generateLessonPackage = vi
    .spyOn(TutorService.prototype, 'generateLessonPackage')
    .mockResolvedValue({
      version: 1,
      formatVersion: 2,
      contentQuality: 'validated',
      regenerationReason: 'initial',
      grounding: {
        sourceExcerpt: 'Giao diện nên được chia thành các phần nhỏ có trách nhiệm rõ ràng.',
        sourceHighlights: ['Giao diện nên được chia thành các phần nhỏ có trách nhiệm rõ ràng.'],
        quality: 'concept_specific',
      },
      mainLesson: {
        definition: 'Component chia UI thành phần nhỏ có trách nhiệm rõ ràng.',
        importance: 'Nó giúp tái sử dụng và bảo trì giao diện.',
        corePoints: ['Mỗi component có trách nhiệm rõ ràng.', 'Component giúp tái sử dụng UI.'],
        technicalExample: '<TaskCard title=\"Fix bug\" />',
        commonMisconceptions: [],
      },
      prerequisiteMiniLessons: [],
    });

  const service = new LessonPackageService();
  await service.getOrCreateCurrentLessonPackage({
    sessionId: 's1',
    conceptId: 'c2',
    conceptName: 'Tổ chức giao diện thành component',
    conceptDescription: 'Chia giao diện thành các phần nhỏ có trách nhiệm rõ ràng.',
    sourceText: '...',
    masteryScore: 0,
    prerequisites: [],
  });

  expect(generateLessonPackage).toHaveBeenCalledWith(
    expect.objectContaining({
      grounding: expect.objectContaining({
        quality: 'concept_specific',
      }),
      siblingConceptNames: ['HTML semantic và cấu trúc trang'],
    })
  );
});
```

- [ ] **Step 2: Chạy test để xác nhận service chưa truyền grounding**

Run:
- `cd backend && npx vitest run tests/unit/learning-graph/lesson-package.service.test.ts`

Expected:
- FAIL vì `generateLessonPackage()` chưa nhận `grounding`
- FAIL vì `LessonPackageService` chưa gọi `getGraph()`

- [ ] **Step 3: Viết minimal implementation cho grounding wiring**

```ts
export class LessonPackageService {
  private sessionService = new SessionService();
  private tutorService = new TutorService();
  private conceptGroundingService = new ConceptGroundingService();

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

    const graph = await this.sessionService.getGraph(input.sessionId);
    const siblingConceptNames = graph.concepts
      .filter((concept) => concept.id !== input.conceptId)
      .map((concept) => concept.displayName);

    const grounding = this.conceptGroundingService.extract({
      conceptName: input.conceptName,
      conceptDescription: input.conceptDescription,
      siblingConceptNames,
      sourceText: input.sourceText,
    });

    const lessonPackage = await this.tutorService.generateLessonPackage({
      conceptName: input.conceptName,
      conceptDescription: input.conceptDescription,
      grounding,
      sourceText: input.sourceText,
      siblingConceptNames,
      masteryScore: input.masteryScore,
      missingPrerequisites: input.prerequisites,
      regenerationReason: currentLessonPackage ? 'academic_redesign' : 'initial',
    });
```

- [ ] **Step 4: Chạy lại unit test để khóa service wiring**

Run:
- `cd backend && npx vitest run tests/unit/learning-graph/lesson-package.service.test.ts`

Expected:
- PASS cho service wiring test
- PASS cho các case persisted lesson, initial lesson, legacy regeneration

- [ ] **Step 5: Commit lesson-package grounding wiring**

```bash
git add backend/src/services/learning-graph/lesson-package.service.ts \
  backend/tests/unit/learning-graph/lesson-package.service.test.ts
git commit -m "feat: wire lesson packages to concept grounding"
```

## Task 3: Add grounded generation and bleed detection in `TutorService`

**Files:**
- Modify: `backend/src/services/learning-graph/tutor.service.ts`
- Modify: `backend/tests/unit/learning-graph/tutor.service.test.ts`

- [ ] **Step 1: Viết test fail cho bleed detection và fallback hierarchy**

```ts
it('rejects a lesson for component organization when the output centers on HTML semantic instead', async () => {
  const chat = vi
    .fn()
    .mockResolvedValueOnce({
      text: JSON.stringify({
        definition: 'Component là cách chia giao diện thành phần nhỏ.',
        importance: 'HTML semantic giúp trình duyệt hiểu cấu trúc trang tốt hơn.',
        corePoints: [
          'HTML semantic và cấu trúc trang.',
          'CSS layout và responsive design.',
        ],
        technicalExample: '<header><nav>...</nav></header>',
        commonMisconceptions: [],
        prerequisiteMiniLessons: [],
      }),
    })
    .mockResolvedValueOnce({
      text: JSON.stringify({
        definition: 'Component là cách chia giao diện thành phần nhỏ có trách nhiệm rõ ràng.',
        importance: 'Nó giúp giao diện dễ tái sử dụng, bảo trì, và tách logic theo từng phần UI.',
        corePoints: [
          'Mỗi component nên có trách nhiệm rõ ràng.',
          'Component giúp tái sử dụng UI và cô lập thay đổi.',
        ],
        technicalExample: '<TaskCard title=\"Fix bug\" status=\"doing\" />',
        commonMisconceptions: ['Component không đồng nghĩa với việc mọi phần tử nhỏ đều phải tách file riêng.'],
        prerequisiteMiniLessons: [],
      }),
    });

  const service = new TutorService({
    chatService: { chat } as never,
  });

  const result = await service.generateLessonPackage({
    conceptName: 'Tổ chức giao diện thành component',
    conceptDescription: 'Chia giao diện thành các phần nhỏ có trách nhiệm rõ ràng.',
    grounding: {
      sourceExcerpt:
        'Giao diện nên được chia thành các phần nhỏ có trách nhiệm rõ ràng. Mỗi component nên đại diện cho một phần UI độc lập.',
      sourceHighlights: [
        'Giao diện nên được chia thành các phần nhỏ có trách nhiệm rõ ràng.',
        'Mỗi component nên đại diện cho một phần UI độc lập.',
      ],
      quality: 'concept_specific',
    },
    sourceText: 'outline toàn session',
    siblingConceptNames: [
      'HTML semantic và cấu trúc trang',
      'CSS layout và responsive design',
      'JavaScript nền tảng',
    ],
    masteryScore: 0,
    missingPrerequisites: [],
  });

  expect(chat).toHaveBeenCalledTimes(2);
  expect(result.mainLesson.importance).toContain('tái sử dụng');
});
```

```ts
it('falls back to grounding excerpt before full session source when grounded generation keeps failing', async () => {
  const chat = vi.fn().mockRejectedValue(new Error('upstream failure'));
  const service = new TutorService({
    chatService: { chat } as never,
  });

  const result = await service.generateLessonPackage({
    conceptName: 'Tổ chức giao diện thành component',
    conceptDescription: 'Chia giao diện thành các phần nhỏ có trách nhiệm rõ ràng.',
    grounding: {
      sourceExcerpt:
        'Giao diện nên được chia thành các phần nhỏ có trách nhiệm rõ ràng. Mỗi component nên đại diện cho một phần UI độc lập.',
      sourceHighlights: ['Mỗi component nên đại diện cho một phần UI độc lập.'],
      quality: 'concept_specific',
    },
    sourceText: 'outline toàn session có HTML semantic và CSS layout',
    siblingConceptNames: ['HTML semantic và cấu trúc trang'],
    masteryScore: 0,
    missingPrerequisites: [],
  });

  expect(result.contentQuality).toBe('fallback');
  expect(result.grounding.quality).toBe('concept_specific');
  expect(result.mainLesson.definition).toContain('Chia giao diện');
  expect(result.mainLesson.corePoints.join(' ')).not.toContain('HTML semantic');
});
```

- [ ] **Step 2: Chạy tutor unit tests để xác nhận bleed detection chưa tồn tại**

Run:
- `cd backend && npx vitest run tests/unit/learning-graph/tutor.service.test.ts`

Expected:
- FAIL vì `generateLessonPackage()` chưa nhận `grounding`
- FAIL vì validator chưa reject case bleed sang sibling concepts

- [ ] **Step 3: Viết minimal implementation cho grounded prompt và bleed detection**

```ts
async generateLessonPackage(input: {
  conceptName: string;
  conceptDescription: string;
  grounding: {
    sourceExcerpt: string;
    sourceHighlights: string[];
    quality: 'concept_specific' | 'session_level' | 'weak';
  };
  sourceText: string | null;
  siblingConceptNames: string[];
  masteryScore: number;
  missingPrerequisites: LessonPackagePrerequisiteInput[];
  regenerationReason?: LessonPackageSchema['regenerationReason'];
  version?: number;
}): Promise<LessonPackageSchema> {
  const lessonDraft = await this.generateAcademicLessonWithRetry({
    conceptName: input.conceptName,
    conceptDescription: input.conceptDescription,
    grounding: input.grounding,
    sourceText: input.sourceText?.trim() || '',
    siblingConceptNames: input.siblingConceptNames,
    missingPrerequisites: input.missingPrerequisites,
  });

  return lessonPackageSchema.parse({
    version: input.version ?? 1,
    formatVersion: 2,
    contentQuality: lessonDraft.contentQuality,
    regenerationReason: input.regenerationReason ?? 'initial',
    grounding: input.grounding,
    mainLesson: lessonDraft.lesson,
    prerequisiteMiniLessons: lessonDraft.prerequisiteMiniLessons,
  });
}
```

```ts
private validateConceptBleed(input: {
  conceptName: string;
  siblingConceptNames: string[];
  grounding: { sourceHighlights: string[]; sourceExcerpt: string };
  lesson: {
    definition: string;
    importance: string;
    corePoints: string[];
    technicalExample: string;
    commonMisconceptions: string[];
  };
}) {
  const combinedLesson = [
    input.lesson.definition,
    input.lesson.importance,
    ...input.lesson.corePoints,
    input.lesson.technicalExample,
    ...input.lesson.commonMisconceptions,
  ]
    .join(' ')
    .toLowerCase();

  const siblingMentions = input.siblingConceptNames.filter((name) =>
    combinedLesson.includes(name.toLowerCase())
  );

  const groundingOverlap = input.grounding.sourceHighlights.some((highlight) =>
    combinedLesson.includes(highlight.toLowerCase().slice(0, 24))
  );

  if (siblingMentions.length > 0 && !groundingOverlap) {
    return ['lesson content appears grounded in sibling concepts instead of the current concept'];
  }

  return [];
}
```

- [ ] **Step 4: Chạy lại tutor unit tests**

Run:
- `cd backend && npx vitest run tests/unit/learning-graph/tutor.service.test.ts`

Expected:
- PASS cho bleed rejection case
- PASS cho fallback hierarchy case
- PASS cho existing retry/fallback/explanation tests

- [ ] **Step 5: Commit grounded generation và bleed detection**

```bash
git add backend/src/services/learning-graph/tutor.service.ts \
  backend/tests/unit/learning-graph/tutor.service.test.ts
git commit -m "feat: ground lesson generation per concept"
```

## Task 4: Lock session flow with grounded payloads and regressions

**Files:**
- Modify: `backend/tests/integration/learning-graph/session-flow.test.ts`

- [ ] **Step 1: Viết integration expectation cho payload `grounding`**

```ts
expect(conceptLearning.lessonPackage).toMatchObject({
  version: 1,
  formatVersion: 2,
  contentQuality: expect.stringMatching(/validated|fallback/),
  grounding: {
    sourceExcerpt: expect.any(String),
    sourceHighlights: expect.any(Array),
    quality: expect.stringMatching(/concept_specific|session_level|weak/),
  },
  mainLesson: {
    definition: expect.any(String),
    importance: expect.any(String),
    corePoints: expect.any(Array),
    technicalExample: expect.any(String),
    commonMisconceptions: expect.any(Array),
  },
});
```

```ts
expect(conceptLearning.lessonPackage.mainLesson.corePoints.join(' ')).not.toContain(
  'HTML semantic và cấu trúc trang'
);
```

- [ ] **Step 2: Chạy integration test để xác nhận payload grounding chưa được khóa**

Run:
- `cd backend && npx vitest run tests/integration/learning-graph/session-flow.test.ts`

Expected:
- FAIL vì lesson payload chưa có `grounding`
- hoặc FAIL vì concept bleed assertion chưa pass

- [ ] **Step 3: Cập nhật fixtures integration để phản ánh grounded payload**

```ts
vi.spyOn(SessionService.prototype, 'getCurrentLessonPackage').mockResolvedValue({
  version: 1,
  formatVersion: 2,
  contentQuality: 'validated',
  regenerationReason: 'initial',
  grounding: {
    sourceExcerpt:
      'Giao diện nên được chia thành các phần nhỏ có trách nhiệm rõ ràng. Mỗi component nên đại diện cho một phần UI độc lập.',
    sourceHighlights: [
      'Giao diện nên được chia thành các phần nhỏ có trách nhiệm rõ ràng.',
      'Mỗi component nên đại diện cho một phần UI độc lập.',
    ],
    quality: 'concept_specific',
  },
  mainLesson: {
    definition: 'Component là cách chia UI thành phần nhỏ có trách nhiệm rõ ràng.',
    importance: 'Nó giúp giao diện dễ tái sử dụng và bảo trì.',
    corePoints: [
      'Mỗi component nên có trách nhiệm rõ ràng.',
      'Component giúp tái sử dụng UI.',
    ],
    technicalExample: '<TaskCard title="Fix bug" />',
    commonMisconceptions: [],
  },
  prerequisiteMiniLessons: [],
});
```

- [ ] **Step 4: Chạy regression suite**

Run:
- `cd backend && npx vitest run tests/unit/learning-graph/tutor.service.test.ts tests/unit/learning-graph/lesson-package.service.test.ts tests/integration/learning-graph/session-flow.test.ts`
- `cd backend && npx tsc --noEmit`
- `cd packages/shared-schemas && npm run build`

Expected:
- all targeted tests PASS
- backend typecheck PASS
- shared schema build PASS

- [ ] **Step 5: Commit grounded session-flow coverage**

```bash
git add backend/tests/integration/learning-graph/session-flow.test.ts \
  backend/tests/unit/learning-graph/tutor.service.test.ts \
  backend/tests/unit/learning-graph/lesson-package.service.test.ts \
  backend/src/services/learning-graph/concept-grounding.service.ts \
  backend/src/services/learning-graph/lesson-package.service.ts \
  backend/src/services/learning-graph/tutor.service.ts \
  packages/shared-schemas/src/learning-graph-api.schema.ts
git commit -m "test: cover concept grounding session flow"
```
