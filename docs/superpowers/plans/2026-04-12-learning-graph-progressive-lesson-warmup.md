# Learning Graph Progressive Lesson Warmup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm cho session mới có thể học ngay 3 concept đầu, đồng thời backend warm lesson package nền cho các concept còn lại mà vẫn giữ on-demand generation làm safety net.

**Architecture:** Thêm một `LessonWarmupService` nhỏ trong backend để chia path snapshot thành 2 nhóm: warm đồng bộ 3 concept đầu và enqueue phần còn lại vào một hàng đợi in-process xử lý tuần tự. `LearningOrchestratorService.createSession()` sẽ gọi service này ngay sau khi persist graph/path để bảo đảm người dùng vào session là có nội dung học cho đoạn đầu, còn flow `getOrCreateCurrentLessonPackage()` hiện tại vẫn là source of truth cuối cùng.

**Tech Stack:** TypeScript, Vitest, InsForge backend learning-graph services, PostgreSQL-backed session state, in-process scheduling với `setTimeout`

---

## File Structure

- Create: `backend/src/services/learning-graph/lesson-warmup.service.ts`
  Responsibility: build warmup plan từ path snapshot, warm lesson cho một danh sách concept, và queue warmup nền tuần tự.
- Modify: `backend/src/services/learning-graph/lesson-package.service.ts`
  Responsibility: expose helper `hasCurrentReadyLessonPackage()` để warmup service có thể skip concept đã có lesson hợp lệ mà không duplicate logic validation.
- Modify: `backend/src/services/learning-graph/learning-orchestrator.service.ts`
  Responsibility: gọi `LessonWarmupService` trong `createSession()` để warm 3 concept đầu trước khi trả response và enqueue phần còn lại.
- Create: `backend/tests/unit/learning-graph/lesson-warmup.service.test.ts`
  Responsibility: khóa warmup plan order, skip ready lesson, và queue nền tiếp tục chạy sau lỗi.
- Modify: `backend/tests/integration/learning-graph/session-flow.test.ts`
  Responsibility: khóa orchestration `createSession() -> build warmup plan -> warm initial concepts -> schedule background concepts`, và chặn regression khi synchronous warmup fail.

## Task 1: Thêm `LessonWarmupService` và readiness helper

**Files:**
- Create: `backend/src/services/learning-graph/lesson-warmup.service.ts`
- Modify: `backend/src/services/learning-graph/lesson-package.service.ts`
- Create: `backend/tests/unit/learning-graph/lesson-warmup.service.test.ts`

- [ ] **Step 1: Viết test fail cho warmup plan và skip concept đã sẵn sàng**

```ts
import { describe, expect, it, vi, afterEach } from 'vitest';
import { LessonWarmupService } from '@/services/learning-graph/lesson-warmup.service.js';
import { SessionService } from '@/services/learning-graph/session.service.js';
import { LessonPackageService } from '@/services/learning-graph/lesson-package.service.js';

describe('LessonWarmupService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds a warmup plan from the persisted path snapshot order', async () => {
    vi.spyOn(SessionService.prototype, 'getCurrentPathSnapshot').mockResolvedValue([
      { conceptId: 'c1', position: 0, pathState: 'current', pathVersion: 1, isCurrent: true },
      { conceptId: 'c2', position: 1, pathState: 'next', pathVersion: 1, isCurrent: true },
      { conceptId: 'c3', position: 2, pathState: 'upcoming', pathVersion: 1, isCurrent: true },
      { conceptId: 'c4', position: 3, pathState: 'upcoming', pathVersion: 1, isCurrent: true },
      { conceptId: 'c5', position: 4, pathState: 'upcoming', pathVersion: 1, isCurrent: true },
    ] as Awaited<ReturnType<SessionService['getCurrentPathSnapshot']>>);

    const service = new LessonWarmupService();
    const plan = await service.buildWarmupPlan('session-1');

    expect(plan).toEqual({
      initialConceptIds: ['c1', 'c2', 'c3'],
      backgroundConceptIds: ['c4', 'c5'],
    });
  });

  it('warms concepts sequentially and skips concepts that already have a ready lesson package', async () => {
    vi.spyOn(LessonPackageService.prototype, 'hasCurrentReadyLessonPackage')
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    vi.spyOn(SessionService.prototype, 'findSessionById').mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      goal_title: 'Kinh tế học',
      source_topic: 'Kinh tế học',
      source_text: 'Cầu và cung',
      status: 'ready',
      current_concept_id: 'c1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    vi.spyOn(SessionService.prototype, 'findConceptById').mockResolvedValue({
      id: 'c2',
      session_id: 'session-1',
      canonical_name: 'supply',
      display_name: 'Cung',
      description: 'Cung là lượng hàng người bán sẵn sàng bán.',
      difficulty: 0.2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    vi.spyOn(SessionService.prototype, 'getConceptMastery').mockResolvedValue(null);
    vi.spyOn(SessionService.prototype, 'listPrerequisites').mockResolvedValue([]);
    const getOrCreateCurrentLessonPackage = vi
      .spyOn(LessonPackageService.prototype, 'getOrCreateCurrentLessonPackage')
      .mockResolvedValue({
        version: 1,
        formatVersion: 2,
        contentQuality: 'validated',
        regenerationReason: 'initial',
        grounding: {
          sourceExcerpt: 'Cung là lượng hàng người bán sẵn sàng bán.',
          sourceHighlights: ['Cung là lượng hàng người bán sẵn sàng bán.'],
          quality: 'concept_specific',
        },
        mainLesson: {
          definition: 'Cung là lượng hàng người bán sẵn sàng bán.',
          importance: 'Giúp hiểu phản ứng của người bán trước thay đổi giá.',
          corePoints: ['Cung gắn với mức giá.', 'Giá tăng thường làm lượng cung tăng.'],
          technicalExample: 'Khi giá xoài tăng, nhiều nhà vườn bán ra nhiều hơn.',
          commonMisconceptions: ['Cung không chỉ là khả năng sản xuất.'],
        },
        prerequisiteMiniLessons: [],
      });

    const service = new LessonWarmupService();
    await service.warmConcepts({
      sessionId: 'session-1',
      conceptIds: ['c1', 'c2'],
    });

    expect(getOrCreateCurrentLessonPackage).toHaveBeenCalledTimes(1);
    expect(getOrCreateCurrentLessonPackage).toHaveBeenCalledWith({
      sessionId: 'session-1',
      conceptId: 'c2',
      conceptName: 'Cung',
      conceptDescription: 'Cung là lượng hàng người bán sẵn sàng bán.',
      sourceText: 'Cầu và cung',
      masteryScore: 0,
      prerequisites: [],
    });
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận service và helper chưa tồn tại**

Run:
- `cd backend && npx vitest run tests/unit/learning-graph/lesson-warmup.service.test.ts`

Expected:
- FAIL vì chưa có `LessonWarmupService`
- FAIL vì `LessonPackageService` chưa có `hasCurrentReadyLessonPackage`

- [ ] **Step 3: Viết minimal implementation cho helper readiness và warmup service**

```ts
// backend/src/services/learning-graph/lesson-package.service.ts
async hasCurrentReadyLessonPackage(sessionId: string, conceptId: string) {
  const currentLessonPackage = await this.sessionService.getCurrentLessonPackage(sessionId, conceptId);

  return (
    this.isAcademicLessonPackage(currentLessonPackage) &&
    !this.shouldRegenerateLessonPackage(currentLessonPackage)
  );
}
```

```ts
// backend/src/services/learning-graph/lesson-warmup.service.ts
import { AppError } from '@/api/middlewares/error.js';
import { ERROR_CODES } from '@/types/error-constants.js';
import { LessonPackageService } from './lesson-package.service.js';
import { SessionService } from './session.service.js';

export class LessonWarmupService {
  static readonly DEFAULT_WARMUP_COUNT = 3;

  constructor(
    private sessionService = new SessionService(),
    private lessonPackageService = new LessonPackageService()
  ) {}

  async buildWarmupPlan(
    sessionId: string,
    warmupCount = LessonWarmupService.DEFAULT_WARMUP_COUNT
  ) {
    const pathSnapshot = await this.sessionService.getCurrentPathSnapshot(sessionId);
    const orderedConceptIds = [...pathSnapshot]
      .sort((left, right) => left.position - right.position)
      .map((item) => item.conceptId);

    return {
      initialConceptIds: orderedConceptIds.slice(0, warmupCount),
      backgroundConceptIds: orderedConceptIds.slice(warmupCount),
    };
  }

  async warmConcepts(input: { sessionId: string; conceptIds: string[] }) {
    for (const conceptId of input.conceptIds) {
      if (await this.lessonPackageService.hasCurrentReadyLessonPackage(input.sessionId, conceptId)) {
        continue;
      }

      const session = await this.sessionService.findSessionById(input.sessionId);
      const concept = await this.sessionService.findConceptById(input.sessionId, conceptId);

      if (!session || !concept) {
        throw new AppError(
          'Không thể chuẩn bị lesson package cho concept hiện tại.',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      const mastery = await this.sessionService.getConceptMastery(input.sessionId, conceptId);
      const prerequisites = await this.sessionService.listPrerequisites(input.sessionId, conceptId);

      await this.lessonPackageService.getOrCreateCurrentLessonPackage({
        sessionId: input.sessionId,
        conceptId,
        conceptName: concept.display_name,
        conceptDescription: concept.description,
        sourceText: session.source_text,
        masteryScore: mastery?.masteryScore ?? 0,
        prerequisites: prerequisites.map((item) => ({
          id: item.id,
          displayName: item.display_name,
          description: item.description,
        })),
      });
    }
  }
}
```

- [ ] **Step 4: Chạy lại unit test để xác nhận warmup service hoạt động**

Run:
- `cd backend && npx vitest run tests/unit/learning-graph/lesson-warmup.service.test.ts`

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/learning-graph/lesson-package.service.ts \
  backend/src/services/learning-graph/lesson-warmup.service.ts \
  backend/tests/unit/learning-graph/lesson-warmup.service.test.ts
git commit -m "feat: add learning graph lesson warmup service"
```

## Task 2: Wire synchronous warmup and background scheduling into `createSession()`

**Files:**
- Modify: `backend/src/services/learning-graph/learning-orchestrator.service.ts`
- Modify: `backend/tests/integration/learning-graph/session-flow.test.ts`

- [ ] **Step 1: Viết test fail cho `createSession()` warm 3 concept đầu trước khi trả response**

```ts
import { LessonWarmupService } from '@/services/learning-graph/lesson-warmup.service.js';

it('warms the first three concepts before returning a new session and schedules the remaining concepts in background', async () => {
  vi.spyOn(SessionService.prototype, 'createLearningSession').mockResolvedValue({
    id: '11111111-1111-1111-1111-111111111111',
    user_id: '11111111-1111-1111-1111-111111111111',
    goal_title: 'Kinh tế học',
    source_topic: 'Kinh tế học',
    source_text: 'Cầu, cung, cân bằng, dư cung',
    status: 'initializing',
    current_concept_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  vi.spyOn(GraphGenerationService.prototype, 'generate').mockResolvedValue({
    sessionGoal: 'Kinh tế học',
    concepts: [
      { tempId: 'c1', displayName: 'Cầu', canonicalName: 'demand', description: 'desc', difficulty: 0.1 },
      { tempId: 'c2', displayName: 'Cung', canonicalName: 'supply', description: 'desc', difficulty: 0.2 },
      { tempId: 'c3', displayName: 'Cân bằng thị trường', canonicalName: 'equilibrium', description: 'desc', difficulty: 0.3 },
      { tempId: 'c4', displayName: 'Dư cung', canonicalName: 'surplus', description: 'desc', difficulty: 0.4 },
    ],
    edges: [],
  });
  vi.spyOn(SessionService.prototype, 'persistValidatedGraph').mockResolvedValue({
    conceptIdByTempId: new Map([
      ['c1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
      ['c2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'],
      ['c3', 'cccccccc-cccc-cccc-cccc-cccccccccccc'],
      ['c4', 'dddddddd-dddd-dddd-dddd-dddddddddddd'],
    ]),
  });
  vi.spyOn(SessionService.prototype, 'persistPathSnapshot').mockResolvedValue();
  vi.spyOn(SessionService.prototype, 'markSessionReady').mockResolvedValue(undefined);
  const buildWarmupPlan = vi.spyOn(LessonWarmupService.prototype, 'buildWarmupPlan').mockResolvedValue({
    initialConceptIds: [
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
    ],
    backgroundConceptIds: ['dddddddd-dddd-dddd-dddd-dddddddddddd'],
  });
  const warmConcepts = vi
    .spyOn(LessonWarmupService.prototype, 'warmConcepts')
    .mockResolvedValue(undefined);
  const scheduleConcepts = vi
    .spyOn(LessonWarmupService.prototype, 'scheduleConcepts')
    .mockImplementation(() => {});

  const service = new LearningOrchestratorService();
  const result = await service.createSession({
    userId: '11111111-1111-1111-1111-111111111111',
    topic: 'Kinh tế học',
    sourceText: 'Cầu, cung, cân bằng, dư cung',
  });

  expect(buildWarmupPlan).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111');
  expect(warmConcepts).toHaveBeenCalledWith({
    sessionId: '11111111-1111-1111-1111-111111111111',
    conceptIds: [
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
    ],
  });
  expect(scheduleConcepts).toHaveBeenCalledWith({
    sessionId: '11111111-1111-1111-1111-111111111111',
    conceptIds: ['dddddddd-dddd-dddd-dddd-dddddddddddd'],
  });
  expect(result.session.status).toBe('ready');
});

it('fails session creation when synchronous lesson warmup for the first concepts fails', async () => {
  vi.spyOn(SessionService.prototype, 'createLearningSession').mockResolvedValue({
    id: '11111111-1111-1111-1111-111111111111',
    user_id: '11111111-1111-1111-1111-111111111111',
    goal_title: 'Kinh tế học',
    source_topic: 'Kinh tế học',
    source_text: 'Cầu, cung, cân bằng, dư cung',
    status: 'initializing',
    current_concept_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  vi.spyOn(GraphGenerationService.prototype, 'generate').mockResolvedValue({
    sessionGoal: 'Kinh tế học',
    concepts: [
      { tempId: 'c1', displayName: 'Cầu', canonicalName: 'demand', description: 'desc', difficulty: 0.1 },
    ],
    edges: [],
  });
  vi.spyOn(SessionService.prototype, 'persistValidatedGraph').mockResolvedValue({
    conceptIdByTempId: new Map([['c1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']]),
  });
  vi.spyOn(SessionService.prototype, 'persistPathSnapshot').mockResolvedValue();
  vi.spyOn(SessionService.prototype, 'markSessionReady').mockResolvedValue(undefined);
  vi.spyOn(LessonWarmupService.prototype, 'buildWarmupPlan').mockResolvedValue({
    initialConceptIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
    backgroundConceptIds: [],
  });
  vi.spyOn(LessonWarmupService.prototype, 'warmConcepts').mockRejectedValue(
    new Error('warmup failed')
  );
  const scheduleConcepts = vi
    .spyOn(LessonWarmupService.prototype, 'scheduleConcepts')
    .mockImplementation(() => {});

  const service = new LearningOrchestratorService();

  await expect(
    service.createSession({
      userId: '11111111-1111-1111-1111-111111111111',
      topic: 'Kinh tế học',
      sourceText: 'Cầu, cung, cân bằng, dư cung',
    })
  ).rejects.toThrow('warmup failed');
  expect(scheduleConcepts).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Chạy integration test để xác nhận orchestration mới chưa tồn tại**

Run:
- `cd backend && npx vitest run tests/integration/learning-graph/session-flow.test.ts --testNamePattern "warms the first three concepts|fails session creation when synchronous lesson warmup"`

Expected:
- FAIL vì `LearningOrchestratorService` chưa gọi `LessonWarmupService`

- [ ] **Step 3: Wire `LessonWarmupService` vào `createSession()`**

```ts
// backend/src/services/learning-graph/learning-orchestrator.service.ts
import { LessonWarmupService } from './lesson-warmup.service.js';

export class LearningOrchestratorService {
  private lessonWarmupService = new LessonWarmupService();

  async createSession(input: { userId: string; topic: string; sourceText?: string }) {
    const normalized = this.inputNormalization.normalize(input.topic, input.sourceText);
    const session = await this.sessionService.createLearningSession({
      userId: input.userId,
      goalTitle: input.topic,
      sourceTopic: input.topic,
      sourceText: normalized.sourceText,
    });
    const rawGraph = await this.graphGeneration.generate(normalized.rawText);
    const validatedGraph = this.graphValidation.validate(rawGraph);
    const pathSnapshot = this.pathEngine.buildSnapshot({
      concepts: validatedGraph.concepts.map((concept: DraftConcept) => ({
        id: concept.tempId,
        difficulty: concept.difficulty,
      })),
      masteryByConceptId: {},
      prerequisiteMap: {},
      nextPathVersion: 1,
    });
    const currentItem = pathSnapshot.items.find((item) => item.pathState === 'current');
    const currentConcept =
      validatedGraph.concepts.find((concept) => concept.tempId === currentItem?.conceptId) ??
      validatedGraph.concepts[0] ??
      null;
    const persistedGraph = await this.sessionService.persistValidatedGraph({
      sessionId: session.id,
      concepts: validatedGraph.concepts,
      edges: validatedGraph.edges,
    });
    const persistedPathItems = pathSnapshot.items
      .map((item) => {
        const conceptId = persistedGraph.conceptIdByTempId.get(item.conceptId);
        if (!conceptId) {
          return null;
        }

        return {
          conceptId,
          position: item.position,
          pathState: item.pathState,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    const persistedCurrentConceptId = currentConcept
      ? persistedGraph.conceptIdByTempId.get(currentConcept.tempId) ?? null
      : null;

    await this.sessionService.persistPathSnapshot({
      sessionId: session.id,
      pathVersion: pathSnapshot.pathVersion,
      items: persistedPathItems,
    });

    await this.sessionService.markSessionReady({
      sessionId: session.id,
      currentConceptId: persistedCurrentConceptId,
    });

    const warmupPlan = await this.lessonWarmupService.buildWarmupPlan(session.id);
    await this.lessonWarmupService.warmConcepts({
      sessionId: session.id,
      conceptIds: warmupPlan.initialConceptIds,
    });
    this.lessonWarmupService.scheduleConcepts({
      sessionId: session.id,
      conceptIds: warmupPlan.backgroundConceptIds,
    });

    return {
      session: {
        id: session.id,
        userId: session.user_id,
        goalTitle: session.goal_title,
        sourceTopic: session.source_topic,
        sourceText: session.source_text,
        status: 'ready' as const,
        currentConceptId: persistedCurrentConceptId,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      },
      pathSnapshot: persistedPathItems.map((item) => ({
        id: crypto.randomUUID(),
        sessionId: session.id,
        conceptId: item.conceptId,
        pathVersion: pathSnapshot.pathVersion,
        position: item.position,
        pathState: item.pathState,
        isCurrent: item.pathState === 'current',
        supersededAt: null,
        createdAt: session.created_at,
      })),
      currentConcept: currentConcept
        ? {
            id: persistedCurrentConceptId ?? currentConcept.tempId,
            sessionId: session.id,
            canonicalName: currentConcept.canonicalName,
            displayName: currentConcept.displayName,
            description: currentConcept.description,
            difficulty: currentConcept.difficulty,
            createdAt: session.created_at,
            updatedAt: session.updated_at,
          }
        : null,
    };
  }
}
```

- [ ] **Step 4: Chạy lại integration test để xác nhận create session đã warm đúng flow**

Run:
- `cd backend && npx vitest run tests/integration/learning-graph/session-flow.test.ts --testNamePattern "warms the first three concepts|fails session creation when synchronous lesson warmup"`

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/learning-graph/learning-orchestrator.service.ts \
  backend/tests/integration/learning-graph/session-flow.test.ts
git commit -m "feat: prewarm first lessons for new learning sessions"
```

## Task 3: Thêm queue warmup nền tuần tự và kiểm tra resilience

**Files:**
- Modify: `backend/src/services/learning-graph/lesson-warmup.service.ts`
- Modify: `backend/tests/unit/learning-graph/lesson-warmup.service.test.ts`

- [ ] **Step 1: Viết test fail cho queue nền tiếp tục chạy khi một concept fail**

```ts
it('schedules background warmup sequentially and continues after a concept fails', async () => {
  vi.useFakeTimers();

  vi.spyOn(LessonPackageService.prototype, 'hasCurrentReadyLessonPackage').mockResolvedValue(false);
  vi.spyOn(SessionService.prototype, 'findSessionById').mockResolvedValue({
    id: 'session-1',
    user_id: 'user-1',
    goal_title: 'Kinh tế học',
    source_topic: 'Kinh tế học',
    source_text: 'Cầu và cung',
    status: 'ready',
    current_concept_id: 'c1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  vi.spyOn(SessionService.prototype, 'findConceptById').mockImplementation(async (_sessionId, conceptId) => ({
    id: conceptId,
    session_id: 'session-1',
    canonical_name: conceptId,
    display_name: conceptId.toUpperCase(),
    description: `Description for ${conceptId}`,
    difficulty: 0.2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
  vi.spyOn(SessionService.prototype, 'getConceptMastery').mockResolvedValue(null);
  vi.spyOn(SessionService.prototype, 'listPrerequisites').mockResolvedValue([]);
  const getOrCreateCurrentLessonPackage = vi
    .spyOn(LessonPackageService.prototype, 'getOrCreateCurrentLessonPackage')
    .mockRejectedValueOnce(new Error('boom'))
    .mockResolvedValueOnce({
      version: 1,
      formatVersion: 2,
      contentQuality: 'validated',
      regenerationReason: 'initial',
      grounding: {
        sourceExcerpt: 'ok',
        sourceHighlights: ['ok'],
        quality: 'concept_specific',
      },
      mainLesson: {
        definition: 'ok',
        importance: 'Một câu importance đủ dài để pass validation.',
        corePoints: ['Ý 1 đủ dài để hợp lệ.', 'Ý 2 đủ dài để hợp lệ.'],
        technicalExample: 'Ví dụ rõ ràng theo ngữ cảnh.',
        commonMisconceptions: [],
      },
      prerequisiteMiniLessons: [],
    });

  const service = new LessonWarmupService();
  service.scheduleConcepts({
    sessionId: 'session-1',
    conceptIds: ['c1', 'c2'],
  });

  await vi.runAllTimersAsync();

  expect(getOrCreateCurrentLessonPackage).toHaveBeenCalledTimes(2);
  expect(getOrCreateCurrentLessonPackage).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ conceptId: 'c1' })
  );
  expect(getOrCreateCurrentLessonPackage).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ conceptId: 'c2' })
  );

  vi.useRealTimers();
});
```

- [ ] **Step 2: Chạy unit test để xác nhận queue nền chưa tồn tại**

Run:
- `cd backend && npx vitest run tests/unit/learning-graph/lesson-warmup.service.test.ts`

Expected:
- FAIL vì `scheduleConcepts()` chưa có queue/drain behavior

- [ ] **Step 3: Implement queue nền và logging không chặn flow**

```ts
// backend/src/services/learning-graph/lesson-warmup.service.ts
import logger from '@/utils/logger.js';

export class LessonWarmupService {
  static readonly DEFAULT_WARMUP_COUNT = 3;

  private queue: Array<{ sessionId: string; conceptId: string }> = [];
  private processing = false;
  private drainTimer: ReturnType<typeof setTimeout> | null = null;

  scheduleConcepts(input: { sessionId: string; conceptIds: string[] }) {
    for (const conceptId of input.conceptIds) {
      this.queue.push({ sessionId: input.sessionId, conceptId });
    }

    if (this.processing || this.drainTimer || this.queue.length === 0) {
      return;
    }

    this.drainTimer = setTimeout(() => {
      this.drainTimer = null;
      void this.drainQueue();
    }, 0);
  }

  private async drainQueue() {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const next = this.queue.shift();
        if (!next) {
          continue;
        }

        try {
          await this.warmConcepts({
            sessionId: next.sessionId,
            conceptIds: [next.conceptId],
          });
        } catch (error) {
          logger.warn('Learning graph background lesson warmup failed', {
            sessionId: next.sessionId,
            conceptId: next.conceptId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } finally {
      this.processing = false;
    }
  }
}
```

- [ ] **Step 4: Chạy targeted test và backend build**

Run:
- `cd backend && npx vitest run tests/unit/learning-graph/lesson-warmup.service.test.ts tests/integration/learning-graph/session-flow.test.ts`
- `cd backend && npm run build`

Expected:
- PASS cho unit test warmup service
- PASS cho integration learning-session flow
- PASS cho backend build

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/learning-graph/lesson-warmup.service.ts \
  backend/tests/unit/learning-graph/lesson-warmup.service.test.ts
git commit -m "feat: add background lesson warmup queue"
```

## Task 4: Final verification and manual session smoke test

**Files:**
- No code changes expected if all previous tasks are green

- [ ] **Step 1: Run focused regression suite for learning-graph lesson generation**

Run:
- `cd backend && npx vitest run tests/unit/learning-graph/lesson-package.service.test.ts tests/unit/learning-graph/tutor.service.test.ts tests/unit/learning-graph/voice-audio.service.test.ts tests/unit/learning-graph/voice-tutor.service.test.ts tests/unit/learning-graph/lesson-warmup.service.test.ts tests/integration/learning-graph/session-flow.test.ts`

Expected:
- PASS

- [ ] **Step 2: Run backend build one more time on the final diff**

Run:
- `cd backend && npm run build`

Expected:
- PASS

- [ ] **Step 3: Manual smoke test**

1. Tạo session mới với 8-10 concept.
2. Mở ngay concept 1, 2, 3 để xác nhận lesson vào tức thì.
3. Mở concept 4 sau vài giây để xác nhận đa số trường hợp đã có lesson sẵn.
4. Nếu cố tình làm background queue fail trong local debug, mở concept chưa warm để xác nhận on-demand generation vẫn hoạt động đúng concept.

- [ ] **Step 4: Record outcome in the PR or task notes**

```md
- Backend warmup count: 3
- Background queue: in-process, sequential
- On-demand fallback: preserved
- Verification: vitest targeted suite + backend build + manual smoke test
```
