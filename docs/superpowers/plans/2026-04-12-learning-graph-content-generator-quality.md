# Learning Graph Content Generator Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng `mainLesson` từ heuristic mỏng sang lesson học thuật được LLM sinh ra, có semantic validation, retry hữu hạn, fallback an toàn, và easy explanation bám vào lesson đã validate cộng với `sourceText`.

**Architecture:** Giữ `lessonPackage.formatVersion = 2`, nhưng mở rộng contract bằng `contentQuality` để phân biệt lesson tốt và lesson fallback. Trọng tâm thay đổi nằm ở `TutorService`: thêm schema nội bộ cho output từ model, semantic validator theo từng field, retry loop tối đa 3 attempt, và fallback builder trung tính; `LearningOrchestratorService` chỉ đổi nhẹ để truyền cả lesson summary lẫn `sourceText` vào easy explanation flow.

**Tech Stack:** TypeScript, Zod, Vitest, shared schema package, backend learning-graph services

---

## File Structure

- Modify: `packages/shared-schemas/src/learning-graph-api.schema.ts`
  Responsibility: thêm `contentQuality` vào `lessonPackageSchema` để persist và truyền xuống client trạng thái `validated | fallback`.
- Modify: `backend/src/services/learning-graph/tutor.service.ts`
  Responsibility: thay `buildAcademicLesson()` heuristic bằng pipeline `LLM output schema -> semantic validation -> retry -> fallback`, và cập nhật `generateExplanation()` để nhận `lessonSummary` cùng `sourceText`.
- Modify: `backend/src/services/learning-graph/learning-orchestrator.service.ts`
  Responsibility: truyền `buildLessonSummary(lessonPackage)` và `payload.session?.sourceText` vào `TutorService.generateExplanation()`.
- Modify: `backend/tests/unit/learning-graph/tutor.service.test.ts`
  Responsibility: khóa behavior mới cho validated lesson, retry, fallback, và easy explanation.
- Modify: `backend/tests/unit/learning-graph/lesson-package.service.test.ts`
  Responsibility: cập nhật fixtures lesson package có `contentQuality`, để service tests tiếp tục phản ánh persisted payload thật.
- Modify: `backend/tests/integration/learning-graph/session-flow.test.ts`
  Responsibility: khóa session flow với `contentQuality`, lesson summary usable, và easy explanation on-demand dựa trên lesson + source text.

## Task 1: Khóa contract `contentQuality` và TDD cho generator mới

**Files:**
- Modify: `packages/shared-schemas/src/learning-graph-api.schema.ts`
- Modify: `backend/tests/unit/learning-graph/tutor.service.test.ts`
- Modify: `backend/tests/unit/learning-graph/lesson-package.service.test.ts`

- [ ] **Step 1: Viết test fail cho `contentQuality`, retry, và fallback**

```ts
it('retries when the first lesson output repeats the concept title and accepts the corrected retry', async () => {
  const chat = vi
    .fn()
    .mockResolvedValueOnce({
      text: JSON.stringify({
        definition: 'HTML semantic và cấu trúc trang',
        importance: 'HTML semantic và cấu trúc trang',
        corePoints: ['HTML semantic và cấu trúc trang', 'HTML semantic và cấu trúc trang'],
        technicalExample: 'Hiểu vai trò của các thẻ như header, main, section.',
        commonMisconceptions: ['Không nên hiểu sai.'],
        prerequisiteMiniLessons: [],
      }),
    })
    .mockResolvedValueOnce({
      text: JSON.stringify({
        definition:
          'Semantic HTML là cách dùng các thẻ có ý nghĩa để mô tả đúng vai trò của từng vùng nội dung trên trang.',
        importance:
          'Nó giúp trình duyệt, công cụ hỗ trợ và lập trình viên hiểu cấu trúc trang rõ hơn khi đọc, bảo trì, và hỗ trợ accessibility.',
        corePoints: [
          'Các thẻ như header, nav, main, section, article, footer mang vai trò cấu trúc khác nhau.',
          'Nên chọn thẻ theo nghĩa của nội dung thay vì dùng div cho mọi trường hợp.',
        ],
        technicalExample:
          '<main><article><h1>Bài viết</h1><section>Nội dung chính</section></article></main>',
        commonMisconceptions: ['Semantic HTML không chỉ là đổi tên div sang thẻ khác cho đẹp mã.'],
        prerequisiteMiniLessons: [],
      }),
    });

  const service = new TutorService({
    chatService: { chat } as never,
  });

  const result = await service.generateLessonPackage({
    conceptName: 'HTML semantic và cấu trúc trang',
    conceptDescription: 'Semantic HTML mô tả đúng ý nghĩa của từng phần nội dung.',
    sourceText: 'header, nav, main, article, section, footer; accessibility; maintainability',
    masteryScore: 0,
    missingPrerequisites: [],
  });

  expect(chat).toHaveBeenCalledTimes(2);
  expect(result.contentQuality).toBe('validated');
  expect(result.mainLesson.definition).toContain('Semantic HTML');
});

it('falls back to safe minimum content when every model attempt fails semantic validation', async () => {
  const chat = vi.fn().mockResolvedValue({
    text: JSON.stringify({
      definition: 'HTML semantic và cấu trúc trang',
      importance: 'HTML semantic và cấu trúc trang',
      corePoints: ['HTML semantic và cấu trúc trang', 'HTML semantic và cấu trúc trang'],
      technicalExample: 'Hiểu vai trò của các thẻ như header, main, section.',
      commonMisconceptions: ['Không nên hiểu sai.'],
      prerequisiteMiniLessons: [],
    }),
  });

  const service = new TutorService({
    chatService: { chat } as never,
  });

  const result = await service.generateLessonPackage({
    conceptName: 'HTML semantic và cấu trúc trang',
    conceptDescription: 'Semantic HTML mô tả đúng ý nghĩa của từng phần nội dung.',
    sourceText: 'header, nav, main, article, section, footer; accessibility; maintainability',
    masteryScore: 0,
    missingPrerequisites: [],
  });

  expect(chat).toHaveBeenCalledTimes(3);
  expect(result.contentQuality).toBe('fallback');
  expect(result.mainLesson.technicalExample).toContain('chưa được trích rõ');
});
```

```ts
const persistedLessonPackage = {
  version: 1,
  formatVersion: 2 as const,
  contentQuality: 'validated' as const,
  regenerationReason: 'initial' as const,
  mainLesson: {
    definition: 'Backpropagation là quá trình lan truyền sai số từ output về các tầng trước đó.',
    importance: 'Nó cho phép mạng nơ-ron tính gradient để cập nhật trọng số.',
    corePoints: [
      'Sai số được lan truyền ngược qua từng tầng.',
      'Chain rule được dùng để tính gradient của từng tham số.',
    ],
    technicalExample:
      'Sau khi tính loss ở output, mạng dùng chain rule để suy ra gradient của từng trọng số.',
    commonMisconceptions: [
      'Backpropagation không phải là bước cập nhật tham số; nó là bước tính gradient.',
    ],
  },
  prerequisiteMiniLessons: [],
};
```

- [ ] **Step 2: Chạy unit tests để xác nhận contract mới chưa tồn tại**

Run: `cd backend && npx vitest run tests/unit/learning-graph/tutor.service.test.ts tests/unit/learning-graph/lesson-package.service.test.ts`

Expected:
- FAIL vì `TutorService` chưa nhận dependency injection cho `chatService`
- FAIL vì `lessonPackageSchema` chưa có `contentQuality`
- FAIL vì `generateLessonPackage()` vẫn đang dùng heuristic và không retry

- [ ] **Step 3: Đổi shared schema để persist chất lượng lesson**

```ts
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
  mainLesson: academicLessonSchema,
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
```

- [ ] **Step 4: Rerun unit tests và shared schema build để khóa contract mới**

Run:
- `cd backend && npx vitest run tests/unit/learning-graph/tutor.service.test.ts tests/unit/learning-graph/lesson-package.service.test.ts`
- `cd packages/shared-schemas && npm run build`

Expected:
- `lesson-package.service.test.ts` vẫn còn FAIL vì `TutorService` chưa trả `contentQuality`
- shared schema build PASS với field mới

- [ ] **Step 5: Commit contract + failing test harness**

```bash
git add packages/shared-schemas/src/learning-graph-api.schema.ts \
  backend/tests/unit/learning-graph/tutor.service.test.ts \
  backend/tests/unit/learning-graph/lesson-package.service.test.ts
git commit -m "test: lock lesson content quality contract"
```

## Task 2: Thay heuristic lesson builder bằng LLM + semantic validation + retry + fallback

**Files:**
- Modify: `backend/src/services/learning-graph/tutor.service.ts`
- Modify: `backend/tests/unit/learning-graph/tutor.service.test.ts`
- Modify: `backend/tests/unit/learning-graph/lesson-package.service.test.ts`

- [ ] **Step 1: Bổ sung unit test cho semantic validator chặn pseudo-example**

```ts
it('rejects descriptive technicalExample text that is not a concrete example', async () => {
  const chat = vi
    .fn()
    .mockResolvedValueOnce({
      text: JSON.stringify({
        definition:
          'Semantic HTML là cách dùng các thẻ có ý nghĩa để mô tả vai trò của từng phần nội dung.',
        importance:
          'Nó giúp trình duyệt và công cụ hỗ trợ hiểu cấu trúc trang tốt hơn.',
        corePoints: [
          'header, main, article, section, footer mang vai trò khác nhau.',
          'Nên chọn thẻ theo nghĩa nội dung thay vì dùng div cho mọi thứ.',
        ],
        technicalExample: 'Hiểu vai trò của các thẻ như header, main, section, article, nav, footer.',
        commonMisconceptions: ['Semantic HTML không chỉ là đổi tên div.'],
        prerequisiteMiniLessons: [],
      }),
    })
    .mockResolvedValueOnce({
      text: JSON.stringify({
        definition:
          'Semantic HTML là cách dùng các thẻ có ý nghĩa để mô tả vai trò của từng phần nội dung.',
        importance:
          'Nó giúp trình duyệt và công cụ hỗ trợ hiểu cấu trúc trang tốt hơn.',
        corePoints: [
          'header, main, article, section, footer mang vai trò khác nhau.',
          'Nên chọn thẻ theo nghĩa nội dung thay vì dùng div cho mọi thứ.',
        ],
        technicalExample:
          '<header>...menu...</header><main><article><h1>Bài viết</h1></article></main>',
        commonMisconceptions: ['Semantic HTML không chỉ là đổi tên div.'],
        prerequisiteMiniLessons: [],
      }),
    });

  const service = new TutorService({
    chatService: { chat } as never,
  });

  const result = await service.generateLessonPackage({
    conceptName: 'HTML semantic và cấu trúc trang',
    conceptDescription: 'Semantic HTML mô tả đúng ý nghĩa của từng phần nội dung.',
    sourceText: 'header, nav, main, article, section, footer; accessibility; maintainability',
    masteryScore: 0,
    missingPrerequisites: [],
  });

  expect(chat).toHaveBeenCalledTimes(2);
  expect(result.mainLesson.technicalExample).toContain('<header>');
});
```

- [ ] **Step 2: Chạy unit tests để xác nhận validator mới chưa được cài**

Run: `cd backend && npx vitest run tests/unit/learning-graph/tutor.service.test.ts`

Expected:
- FAIL vì `technicalExample` descriptive text vẫn được accept
- FAIL vì service chưa gọi model và chưa có retry loop

- [ ] **Step 3: Viết minimal implementation cho pipeline LLM-first**

```ts
const llmAcademicLessonSchema = z.object({
  definition: z.string(),
  importance: z.string(),
  corePoints: z.array(z.string()).min(2),
  technicalExample: z.string(),
  commonMisconceptions: z.array(z.string()).default([]),
  prerequisiteMiniLessons: z.array(
    z.object({
      prerequisiteConceptId: z.string().uuid(),
      title: z.string(),
      content: z.string(),
    })
  ).default([]),
});

type TutorServiceDependencies = {
  chatService?: Pick<ChatCompletionService, 'chat'>;
};

export class TutorService {
  constructor(dependencies: TutorServiceDependencies = {}) {
    this.chatService = dependencies.chatService ?? ChatCompletionService.getInstance();
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

  private validateAcademicLesson(input: {
    conceptName: string;
    lesson: z.infer<typeof llmAcademicLessonSchema>;
  }) {
    const failures: string[] = [];

    if (this.normalize(input.lesson.definition) === this.normalize(input.conceptName)) {
      failures.push('definition is too close to concept title');
    }
    if (input.lesson.corePoints.length < 2) {
      failures.push('corePoints must contain at least two distinct ideas');
    }
    if (!/[<>{}=()]/.test(input.lesson.technicalExample) &&
        !/\bví dụ\b/i.test(input.lesson.technicalExample) &&
        !/\bfor\b|\bconst\b|\bfunction\b/i.test(input.lesson.technicalExample)) {
      failures.push('technicalExample is descriptive but not an example');
    }

    return failures;
  }
```

```ts
private async generateAcademicLessonWithRetry(input: {
  conceptName: string;
  conceptDescription: string;
  sourceText: string;
  missingPrerequisites: LessonPackagePrerequisiteInput[];
}) {
  let validationFeedback: string[] = [];

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await this.chatService.chat(
      this.buildLessonMessages({ ...input, validationFeedback }),
      {
        model: 'google/gemini-2.0-flash-lite-001',
        temperature: attempt === 0 ? 0.2 : 0.1,
      }
    );

    const parsed = llmAcademicLessonSchema.parse(JSON.parse(result.text || '{}'));
    const failures = this.validateAcademicLesson({
      conceptName: input.conceptName,
      lesson: parsed,
    });

    if (failures.length === 0) {
      return {
        contentQuality: 'validated' as const,
        lesson: {
          definition: parsed.definition,
          importance: parsed.importance,
          corePoints: parsed.corePoints,
          technicalExample: parsed.technicalExample,
          commonMisconceptions: parsed.commonMisconceptions,
        },
        prerequisiteMiniLessons: parsed.prerequisiteMiniLessons,
      };
    }

    validationFeedback = failures;
  }

  return {
    contentQuality: 'fallback' as const,
    lesson: this.buildFallbackAcademicLesson(input),
    prerequisiteMiniLessons: input.missingPrerequisites.map((item) => ({
      prerequisiteConceptId: item.id,
      title: `Ôn lại ${item.displayName}`,
      content: `${item.displayName}: ${item.description}`,
    })),
  };
}
```

```ts
const lessonDraft = await this.generateAcademicLessonWithRetry({
  conceptName,
  conceptDescription,
  sourceText,
  missingPrerequisites: input.missingPrerequisites,
});

return lessonPackageSchema.parse({
  version: input.version ?? 1,
  formatVersion: 2,
  contentQuality: lessonDraft.contentQuality,
  regenerationReason: input.regenerationReason ?? 'initial',
  mainLesson: lessonDraft.lesson,
  prerequisiteMiniLessons: lessonDraft.prerequisiteMiniLessons,
});
```

- [ ] **Step 4: Chạy lại unit tests để xác nhận lesson generator mới hoạt động**

Run: `cd backend && npx vitest run tests/unit/learning-graph/tutor.service.test.ts tests/unit/learning-graph/lesson-package.service.test.ts`

Expected:
- PASS cho retry case
- PASS cho fallback case
- PASS cho fixtures `contentQuality`

- [ ] **Step 5: Commit generator pipeline**

```bash
git add backend/src/services/learning-graph/tutor.service.ts \
  backend/tests/unit/learning-graph/tutor.service.test.ts \
  backend/tests/unit/learning-graph/lesson-package.service.test.ts
git commit -m "feat: add validated lesson generation pipeline"
```

## Task 3: Nối easy explanation vào lesson summary + `sourceText` và khóa integration flow

**Files:**
- Modify: `backend/src/services/learning-graph/tutor.service.ts`
- Modify: `backend/src/services/learning-graph/learning-orchestrator.service.ts`
- Modify: `backend/tests/unit/learning-graph/tutor.service.test.ts`
- Modify: `backend/tests/integration/learning-graph/session-flow.test.ts`

- [ ] **Step 1: Viết test fail cho explanation source priority và session flow**

```ts
it('builds easy explanation from lesson summary first and source text second', async () => {
  const chat = vi.fn().mockResolvedValue({
    text: 'Semantic HTML giúp người học hiểu vì sao mỗi vùng nội dung nên dùng đúng thẻ thay vì div chung chung.',
  });

  const service = new TutorService({
    chatService: { chat } as never,
  });

  await service.generateExplanation({
    conceptName: 'HTML semantic và cấu trúc trang',
    lessonSummary:
      'Semantic HTML dùng thẻ có ý nghĩa để mô tả cấu trúc. Điều này giúp accessibility và maintainability tốt hơn.',
    sourceText:
      'header, nav, main, article, section, footer là các thẻ semantic phổ biến trong layout trang.',
    masteryScore: 0,
    missingPrerequisites: [],
  });

  expect(chat).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({
        content: expect.stringContaining('Nguồn chính: Semantic HTML dùng thẻ có ý nghĩa'),
      }),
      expect.objectContaining({
        content: expect.stringContaining('Nguồn phụ: header, nav, main, article'),
      }),
    ]),
    expect.any(Object)
  );
});
```

```ts
expect(conceptLearning.lessonPackage).toMatchObject({
  formatVersion: 2,
  contentQuality: expect.stringMatching(/validated|fallback/),
  mainLesson: {
    definition: expect.any(String),
    importance: expect.any(String),
    corePoints: expect.any(Array),
    technicalExample: expect.any(String),
    commonMisconceptions: expect.any(Array),
  },
});
expect(explanation.explanation).toBe('Giai thich bang tieng Viet');
expect(upsertPersistedExplanation).toHaveBeenCalledWith({
  sessionId: '55555555-5555-5555-5555-555555555555',
  conceptId: '66666666-6666-6666-6666-666666666666',
  explanation: 'Giai thich bang tieng Viet',
});
```

- [ ] **Step 2: Chạy unit + integration tests để xác nhận explanation flow chưa đủ context**

Run: `cd backend && npx vitest run tests/unit/learning-graph/tutor.service.test.ts tests/integration/learning-graph/session-flow.test.ts`

Expected:
- FAIL vì `generateExplanation()` hiện chỉ nhận `conceptDescription`
- FAIL vì orchestrator chưa truyền `sourceText` và lesson summary riêng biệt

- [ ] **Step 3: Viết minimal implementation cho explanation flow mới**

```ts
async generateExplanation(input: {
  conceptName: string;
  lessonSummary: string;
  sourceText: string | null;
  masteryScore: number;
  missingPrerequisites: string[];
}) {
  const messages: ChatMessageSchema[] = [
    {
      role: 'user',
      content: `Hãy giải thích dễ hiểu bằng tiếng Việt về khái niệm "${input.conceptName}".

Yêu cầu bắt buộc:
- Nguồn chính: ${input.lessonSummary}
- Nguồn phụ: ${input.sourceText?.trim() || 'không có'}
- Không mâu thuẫn với nguồn chính
- Chỉ dùng nguồn phụ để diễn đạt mềm hơn hoặc thêm ví dụ gần gũi khi cần
- Không mở đầu kiểu chatbot, không viết lời động viên, không lặp ý

Mức mastery hiện tại: ${input.masteryScore}.
Prerequisite còn thiếu: ${input.missingPrerequisites.join(', ') || 'không có'}.`,
    },
  ];

  const result = await this.chatService.chat(messages, {
    model: 'google/gemini-2.0-flash-lite-001',
    temperature: 0.4,
  });

  return this.cleanExplanationOutput(result.text || '');
}
```

```ts
const explanation = await this.tutorService.generateExplanation({
  conceptName: payload.concept?.displayName ?? 'Khái niệm hiện tại',
  lessonSummary: this.buildLessonSummary(lessonPackage),
  sourceText: payload.session?.sourceText ?? null,
  masteryScore: payload.mastery?.masteryScore ?? 0,
  missingPrerequisites: payload.prerequisites.map((item) => item.displayName),
});
```

- [ ] **Step 4: Chạy regression suite cho generator quality**

Run: `cd backend && npx vitest run tests/unit/learning-graph/tutor.service.test.ts tests/unit/learning-graph/lesson-package.service.test.ts tests/integration/learning-graph/session-flow.test.ts && npx tsc --noEmit && cd ../packages/shared-schemas && npm run build`

Expected:
- All targeted tests PASS
- backend typecheck PASS
- shared schema build PASS

- [ ] **Step 5: Commit explanation wiring và regression coverage**

```bash
git add backend/src/services/learning-graph/tutor.service.ts \
  backend/src/services/learning-graph/learning-orchestrator.service.ts \
  backend/tests/unit/learning-graph/tutor.service.test.ts \
  backend/tests/integration/learning-graph/session-flow.test.ts \
  packages/shared-schemas/src/learning-graph-api.schema.ts
git commit -m "feat: improve lesson generator quality and explanation context"
```
