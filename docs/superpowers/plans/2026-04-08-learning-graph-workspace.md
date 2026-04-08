# Learning Graph Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `learning-graph` from a create-first page into a multi-session workspace with a session shell, a create-session side drawer, and predictable navigation into overview, learn, and graph screens.

**Architecture:** Keep the existing learning-session detail APIs and concept-learning loop, add a library read model for the workspace root, then restructure dashboard routes into a root workspace plus a session-scoped shell. In the dashboard package, keep the existing `service -> hook -> UI` flow by adding a library hook, session-routing helpers, and focused UI components instead of overloading the current `LearningSessionsPage`.

**Tech Stack:** React 19, React Router, TanStack Query, TypeScript, Vitest, Express, PostgreSQL, Zod shared schemas, `@insforge/ui`

**Spec:** `docs/superpowers/specs/2026-04-08-learning-graph-workspace-design.md`

---

## File Map

### New Files

- `packages/dashboard/src/features/learning-graph/components/CreateLearningSessionDialog.tsx` — create-session drawer built on `Dialog`
- `packages/dashboard/src/features/learning-graph/components/LearningSessionCard.tsx` — session card for the workspace library
- `packages/dashboard/src/features/learning-graph/components/LearningSessionShell.tsx` — session-scoped shell with `Overview`, `Learn`, `Graph`
- `packages/dashboard/src/features/learning-graph/components/LearningSessionSpotlight.tsx` — highlighted “continue learning” card
- `packages/dashboard/src/features/learning-graph/hooks/useLearningSessionLibrary.ts` — root workspace query + create mutation
- `packages/dashboard/src/features/learning-graph/lib/__tests__/session-workspace.test.ts` — pure helper tests for sort + navigation
- `packages/dashboard/src/features/learning-graph/lib/session-workspace.ts` — route + spotlight helpers
- `packages/dashboard/src/features/learning-graph/pages/LearningGraphWorkspacePage.tsx` — new workspace root page
- `packages/dashboard/src/features/learning-graph/pages/LearningSessionLearnRedirectPage.tsx` — `/learn` resolver route
- `packages/dashboard/src/features/learning-graph/pages/LearningSessionOverviewPage.tsx` — overview page inside the session shell

### Modified Files

- `packages/shared-schemas/src/learning-graph-api.schema.ts` — add session-library response contracts
- `packages/shared-schemas/src/index.ts` — export the new contracts
- `backend/src/api/routes/learning-graph/index.routes.ts` — add `GET /learning-sessions` and pass `userId` into session-scoped reads
- `backend/src/services/learning-graph/learning-orchestrator.service.ts` — add library read method and user-scoped access checks
- `backend/src/services/learning-graph/session.service.ts` — add session-library queries and user-scoped lookup
- `backend/tests/integration/learning-graph/session-flow.test.ts` — add coverage for the workspace library payload and access guard
- `packages/dashboard/src/features/learning-graph/components/index.ts` — export new workspace components
- `packages/dashboard/src/features/learning-graph/hooks/useConceptLearning.ts` — invalidate library cache after quiz submission
- `packages/dashboard/src/features/learning-graph/hooks/useLearningSessions.ts` — keep this as session-detail hook only
- `packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx` — move to session-shell navigation and `params.sessionId`
- `packages/dashboard/src/features/learning-graph/pages/KnowledgeGraphPage.tsx` — move to session-shell navigation and `params.sessionId`
- `packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts` — add `listSessions()`
- `packages/dashboard/src/router/AppRoutes.tsx` — split root workspace and session-shell routes

## Task 1: Add session-library contracts and backend read model

**Files:**
- Modify: `packages/shared-schemas/src/learning-graph-api.schema.ts`
- Modify: `packages/shared-schemas/src/index.ts`
- Modify: `backend/src/services/learning-graph/session.service.ts`
- Modify: `backend/src/services/learning-graph/learning-orchestrator.service.ts`
- Modify: `backend/src/api/routes/learning-graph/index.routes.ts`
- Modify: `backend/tests/integration/learning-graph/session-flow.test.ts`
- Test: `cd packages/shared-schemas && npm run build`
- Test: `cd backend && npx vitest run tests/integration/learning-graph/session-flow.test.ts`

- [ ] **Step 1: Write the failing backend tests for library ordering and user-scoped access**

Add these tests to `backend/tests/integration/learning-graph/session-flow.test.ts`:

```ts
it('returns a most-recent-first session library with a spotlight session', async () => {
  vi.spyOn(SessionService.prototype, 'listSessionLibraryItemsForUser').mockResolvedValue([
    {
      session: {
        id: 'older-session',
        userId: '11111111-1111-1111-1111-111111111111',
        goalTitle: 'Linear Algebra',
        sourceTopic: 'Linear Algebra',
        sourceText: null,
        status: 'ready',
        currentConceptId: 'concept-a',
        createdAt: '2026-04-08T09:00:00.000Z',
        updatedAt: '2026-04-08T09:30:00.000Z',
      },
      progress: { completedCount: 1, totalCount: 4 },
      currentConcept: null,
    },
    {
      session: {
        id: 'newer-session',
        userId: '11111111-1111-1111-1111-111111111111',
        goalTitle: 'Deep Learning',
        sourceTopic: 'Deep Learning',
        sourceText: null,
        status: 'completed',
        currentConceptId: null,
        createdAt: '2026-04-08T10:00:00.000Z',
        updatedAt: '2026-04-08T12:00:00.000Z',
      },
      progress: { completedCount: 5, totalCount: 5 },
      currentConcept: null,
    },
  ]);

  const service = new LearningOrchestratorService();
  const result = await service.getSessionLibrary({
    userId: '11111111-1111-1111-1111-111111111111',
  });

  expect(result.sessions.map((item) => item.session.id)).toEqual([
    'newer-session',
    'older-session',
  ]);
  expect(result.spotlightSession?.session.id).toBe('newer-session');
});

it('rejects session overview reads for sessions outside the current user scope', async () => {
  vi.spyOn(SessionService.prototype, 'findSessionByIdForUser').mockResolvedValue(null);

  const service = new LearningOrchestratorService();

  await expect(
    service.getSessionOverview({
      userId: '11111111-1111-1111-1111-111111111111',
      sessionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    })
  ).rejects.toMatchObject<AppError>({
    code: ERROR_CODES.LEARNING_SESSION_NOT_FOUND,
    statusCode: 404,
  });
});
```

- [ ] **Step 2: Run the backend test to verify it fails**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/backend
npx vitest run tests/integration/learning-graph/session-flow.test.ts
```

Expected: FAIL with missing methods such as `listSessionLibraryItemsForUser`, `findSessionByIdForUser`, or `getSessionLibrary`.

- [ ] **Step 3: Add the shared schema contracts for the workspace library**

Extend `packages/shared-schemas/src/learning-graph-api.schema.ts` with:

```ts
export const learningSessionLibraryItemSchema = z.object({
  session: learningSessionSchema,
  progress: z.object({
    completedCount: z.number().int().min(0),
    totalCount: z.number().int().min(0),
  }),
  currentConcept: sessionConceptSchema.nullable(),
});

export const getLearningSessionLibraryResponseSchema = z.object({
  sessions: z.array(learningSessionLibraryItemSchema),
  spotlightSession: learningSessionLibraryItemSchema.nullable(),
});

export type LearningSessionLibraryItemSchema = z.infer<typeof learningSessionLibraryItemSchema>;
export type GetLearningSessionLibraryResponseSchema = z.infer<
  typeof getLearningSessionLibraryResponseSchema
>;
```

Export them from `packages/shared-schemas/src/index.ts`:

```ts
export * from './learning-graph.schema.js';
export * from './learning-graph-api.schema.js';
```

- [ ] **Step 4: Implement the backend read model and access guard**

In `backend/src/services/learning-graph/session.service.ts`, add:

```ts
async findSessionByIdForUser(userId: string, sessionId: string): Promise<LearningSessionRecord | null> {
  const result = await this.db.getPool().query<LearningSessionRecord>(
    `SELECT *
     FROM public.learning_sessions
     WHERE user_id = $1 AND id = $2`,
    [userId, sessionId]
  );

  return result.rows[0] ?? null;
}

async listSessionLibraryItemsForUser(userId: string) {
  const result = await this.db.getPool().query<LearningSessionRecord>(
    `SELECT *
     FROM public.learning_sessions
     WHERE user_id = $1
     ORDER BY updated_at DESC`,
    [userId]
  );

  const items = await Promise.all(
    result.rows.map(async (record) => ({
      session: this.mapSession(record)!,
      progress: await this.getProgressSummary(record.id),
      currentConcept: this.mapConcept(await this.getCurrentConcept(record.id)),
    }))
  );

  return items.sort(
    (left, right) =>
      Date.parse(right.session.updatedAt) - Date.parse(left.session.updatedAt)
  );
}
```

In `backend/src/services/learning-graph/learning-orchestrator.service.ts`, add:

```ts
private async assertSessionAccess(userId: string, sessionId: string) {
  const session = await this.sessionService.findSessionByIdForUser(userId, sessionId);
  if (!session) {
    throw new AppError(
      'Không tìm thấy phiên học.',
      404,
      ERROR_CODES.LEARNING_SESSION_NOT_FOUND
    );
  }

  return session;
}

async getSessionLibrary(input: { userId: string }) {
  const sessions = await this.sessionService.listSessionLibraryItemsForUser(input.userId);
  return {
    sessions,
    spotlightSession: sessions[0] ?? null,
  };
}
```

Update all session-scoped orchestrator methods to accept `userId` and call `assertSessionAccess(...)` before reading:

```ts
async getSessionOverview(input: { userId: string; sessionId: string }) {
  await this.assertSessionAccess(input.userId, input.sessionId);
  return this.sessionService.getSessionOverview(input.sessionId);
}
```

Apply the same shape to `getConceptLearning`, `generateExplanation`, `getOrCreateQuiz`, and `getGraph`.

In `backend/src/api/routes/learning-graph/index.routes.ts`, add the root library route before `/:sessionId`:

```ts
router.get('/', verifyUser, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await orchestrator.getSessionLibrary({
      userId: req.user!.id,
    });

    successResponse(res, result);
  } catch (error) {
    next(error);
  }
});
```

Update every existing session-scoped route call to pass `userId: req.user!.id`.

- [ ] **Step 5: Run the shared-schema build and backend tests**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/packages/shared-schemas
npm run build

cd /home/phan-duong-quoc-nhat/workspace/InsForge/backend
npx vitest run tests/integration/learning-graph/session-flow.test.ts
```

Expected: PASS for the new integration tests and no schema export errors.

- [ ] **Step 6: Commit**

```bash
git add \
  packages/shared-schemas/src/learning-graph-api.schema.ts \
  packages/shared-schemas/src/index.ts \
  backend/src/services/learning-graph/session.service.ts \
  backend/src/services/learning-graph/learning-orchestrator.service.ts \
  backend/src/api/routes/learning-graph/index.routes.ts \
  backend/tests/integration/learning-graph/session-flow.test.ts
git commit -m "feat: add learning graph session library api"
```

## Task 2: Add dashboard library hook and session-routing helpers

**Files:**
- Create: `packages/dashboard/src/features/learning-graph/lib/session-workspace.ts`
- Create: `packages/dashboard/src/features/learning-graph/lib/__tests__/session-workspace.test.ts`
- Create: `packages/dashboard/src/features/learning-graph/hooks/useLearningSessionLibrary.ts`
- Modify: `packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts`
- Modify: `packages/dashboard/src/features/learning-graph/hooks/useLearningSessions.ts`
- Test: `cd packages/dashboard && npx vitest run src/features/learning-graph/lib/__tests__/session-workspace.test.ts`
- Test: `cd packages/dashboard && npm run typecheck`

- [ ] **Step 1: Write the failing pure tests for spotlight selection and primary route resolution**

Create `packages/dashboard/src/features/learning-graph/lib/__tests__/session-workspace.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  getSessionPrimaryHref,
  pickSpotlightSession,
  type LearningSessionLibraryItem,
} from '../session-workspace';

function buildItem(
  id: string,
  status: 'ready' | 'completed',
  updatedAt: string
): LearningSessionLibraryItem {
  return {
    session: {
      id,
      userId: '11111111-1111-1111-1111-111111111111',
      goalTitle: id,
      sourceTopic: id,
      sourceText: null,
      status,
      currentConceptId: status === 'completed' ? null : 'concept-id',
      createdAt: updatedAt,
      updatedAt,
    },
    progress: { completedCount: status === 'completed' ? 3 : 1, totalCount: 3 },
    currentConcept:
      status === 'completed'
        ? null
        : {
            id: 'concept-id',
            sessionId: id,
            canonicalName: 'gradient-descent',
            displayName: 'Gradient Descent',
            description: 'desc',
            difficulty: 0.4,
            createdAt: updatedAt,
            updatedAt,
          },
  };
}

describe('getSessionPrimaryHref', () => {
  it('routes incomplete sessions to the learn route', () => {
    expect(getSessionPrimaryHref(buildItem('ready-session', 'ready', '2026-04-08T12:00:00.000Z'))).toBe(
      '/dashboard/learning-graph/sessions/ready-session/learn'
    );
  });

  it('routes completed sessions to the overview route', () => {
    expect(
      getSessionPrimaryHref(buildItem('completed-session', 'completed', '2026-04-08T12:00:00.000Z'))
    ).toBe('/dashboard/learning-graph/sessions/completed-session/overview');
  });
});

describe('pickSpotlightSession', () => {
  it('returns the most recently updated session', () => {
    const result = pickSpotlightSession([
      buildItem('older', 'ready', '2026-04-08T09:00:00.000Z'),
      buildItem('newer', 'ready', '2026-04-08T12:00:00.000Z'),
    ]);

    expect(result?.session.id).toBe('newer');
  });
});
```

- [ ] **Step 2: Run the dashboard helper test to verify it fails**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/packages/dashboard
npx vitest run src/features/learning-graph/lib/__tests__/session-workspace.test.ts
```

Expected: FAIL because `session-workspace.ts` does not exist yet.

- [ ] **Step 3: Implement the pure helpers and library hook**

Create `packages/dashboard/src/features/learning-graph/lib/session-workspace.ts`:

```ts
import type { GetLearningSessionLibraryResponseSchema } from '@insforge/shared-schemas';

export type LearningSessionLibraryItem =
  GetLearningSessionLibraryResponseSchema['sessions'][number];

export function getSessionPrimaryHref(item: LearningSessionLibraryItem) {
  return item.session.status === 'completed'
    ? `/dashboard/learning-graph/sessions/${item.session.id}/overview`
    : `/dashboard/learning-graph/sessions/${item.session.id}/learn`;
}

export function pickSpotlightSession(items: LearningSessionLibraryItem[]) {
  return [...items].sort(
    (left, right) =>
      Date.parse(right.session.updatedAt) - Date.parse(left.session.updatedAt)
  )[0] ?? null;
}
```

Extend `packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts`:

```ts
import type { GetLearningSessionLibraryResponseSchema } from '@insforge/shared-schemas';

async listSessions(): Promise<GetLearningSessionLibraryResponseSchema> {
  return apiClient.request('/learning-sessions', {
    headers: apiClient.withAccessToken(),
  });
}
```

Create `packages/dashboard/src/features/learning-graph/hooks/useLearningSessionLibrary.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateLearningSessionRequestSchema } from '@insforge/shared-schemas';
import { learningGraphService } from '../services/learning-graph.service';
import { useToast } from '../../../lib/hooks/useToast';

export function useLearningSessionLibrary() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const libraryQuery = useQuery({
    queryKey: ['learning-graph', 'library'],
    queryFn: () => learningGraphService.listSessions(),
  });

  const createSessionMutation = useMutation({
    mutationFn: (input: CreateLearningSessionRequestSchema) =>
      learningGraphService.createSession(input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['learning-graph', 'library'] });
      queryClient.setQueryData(['learning-graph', 'session', result.session.id], {
        session: result.session,
        pathSnapshot: result.pathSnapshot,
        progress: {
          completedCount: result.pathSnapshot.filter((item) => item.pathState === 'completed').length,
          totalCount: result.pathSnapshot.length,
        },
        currentConcept: result.currentConcept,
      });
      showToast('Đã tạo phiên học thành công', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Không thể tạo phiên học', 'error');
    },
  });

  return {
    sessions: libraryQuery.data?.sessions ?? [],
    spotlightSession: libraryQuery.data?.spotlightSession ?? null,
    isLoading: libraryQuery.isLoading,
    error: libraryQuery.error,
    refetch: libraryQuery.refetch,
    createSession: createSessionMutation.mutateAsync,
    isCreatingSession: createSessionMutation.isPending,
  };
}
```

- [ ] **Step 4: Narrow `useLearningSessions.ts` to session-detail responsibilities**

Refactor `packages/dashboard/src/features/learning-graph/hooks/useLearningSessions.ts` so it no longer owns session-library state:

```ts
export function useLearningSessions(sessionId?: string) {
  const sessionOverviewQuery = useQuery<GetLearningSessionResponseSchema>({
    queryKey: ['learning-graph', 'session', sessionId],
    queryFn: () => learningGraphService.getSessionOverview(sessionId!),
    enabled: Boolean(sessionId),
  });

  return {
    session: sessionOverviewQuery.data?.session ?? null,
    pathSnapshot: sessionOverviewQuery.data?.pathSnapshot ?? [],
    progress: sessionOverviewQuery.data?.progress ?? { completedCount: 0, totalCount: 0 },
    currentConcept: sessionOverviewQuery.data?.currentConcept ?? null,
    isLoading: sessionOverviewQuery.isLoading,
    error: sessionOverviewQuery.error,
    refetch: sessionOverviewQuery.refetch,
  };
}
```

- [ ] **Step 5: Run the helper tests and dashboard typecheck**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/packages/dashboard
npx vitest run src/features/learning-graph/lib/__tests__/session-workspace.test.ts
npm run typecheck
```

Expected: PASS for the helper tests and no type errors from the new hook/service split.

- [ ] **Step 6: Commit**

```bash
git add \
  packages/dashboard/src/features/learning-graph/lib/session-workspace.ts \
  packages/dashboard/src/features/learning-graph/lib/__tests__/session-workspace.test.ts \
  packages/dashboard/src/features/learning-graph/hooks/useLearningSessionLibrary.ts \
  packages/dashboard/src/features/learning-graph/hooks/useLearningSessions.ts \
  packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts
git commit -m "feat: add learning graph workspace data layer"
```

## Task 3: Restructure routes into workspace root and session shell

**Files:**
- Create: `packages/dashboard/src/features/learning-graph/components/LearningSessionShell.tsx`
- Create: `packages/dashboard/src/features/learning-graph/pages/LearningSessionLearnRedirectPage.tsx`
- Modify: `packages/dashboard/src/router/AppRoutes.tsx`
- Modify: `packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx`
- Modify: `packages/dashboard/src/features/learning-graph/pages/KnowledgeGraphPage.tsx`
- Test: `cd packages/dashboard && npm run typecheck`

- [ ] **Step 1: Replace the flat route tree with a session-scoped shell**

Update `packages/dashboard/src/router/AppRoutes.tsx`:

```tsx
import LearningGraphWorkspacePage from '../features/learning-graph/pages/LearningGraphWorkspacePage';
import LearningSessionOverviewPage from '../features/learning-graph/pages/LearningSessionOverviewPage';
import LearningSessionLearnRedirectPage from '../features/learning-graph/pages/LearningSessionLearnRedirectPage';
import LearningSessionShell from '../features/learning-graph/components/LearningSessionShell';

<Route path="/dashboard/learning-graph" element={<LearningGraphLayout />}>
  <Route index element={<LearningGraphWorkspacePage />} />
  <Route path="sessions/:sessionId" element={<LearningSessionShell />}>
    <Route index element={<Navigate to="overview" replace />} />
    <Route path="overview" element={<LearningSessionOverviewPage />} />
    <Route path="learn" element={<LearningSessionLearnRedirectPage />} />
    <Route path="graph" element={<KnowledgeGraphPage />} />
    <Route path="concepts/:conceptId" element={<ConceptLearningPage />} />
  </Route>
</Route>
```

- [ ] **Step 2: Implement the session shell with stable tab navigation**

Create `packages/dashboard/src/features/learning-graph/components/LearningSessionShell.tsx`:

```tsx
import { Tabs, Tab } from '@insforge/ui';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLearningSessions } from '../hooks/useLearningSessions';

function getActiveTab(pathname: string) {
  if (pathname.endsWith('/graph')) return 'graph';
  if (pathname.includes('/concepts/') || pathname.endsWith('/learn')) return 'learn';
  return 'overview';
}

export default function LearningSessionShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { session, progress } = useLearningSessions(sessionId);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-8 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Learning Graph Workspace
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">
            {session?.goalTitle ?? 'Đang tải phiên học...'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {progress.completedCount}/{progress.totalCount} khái niệm đã hoàn thành
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/dashboard/learning-graph')}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Quay lại workspace
        </button>
      </div>

      <Tabs
        value={getActiveTab(location.pathname)}
        onValueChange={(value) => navigate(`/dashboard/learning-graph/sessions/${sessionId}/${value}`)}
        className="w-fit"
      >
        <Tab value="overview">Overview</Tab>
        <Tab value="learn">Learn</Tab>
        <Tab value="graph">Graph</Tab>
      </Tabs>

      <Outlet />
    </div>
  );
}
```

- [ ] **Step 3: Implement the learn resolver route**

Create `packages/dashboard/src/features/learning-graph/pages/LearningSessionLearnRedirectPage.tsx`:

```tsx
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLearningSessions } from '../hooks/useLearningSessions';

export default function LearningSessionLearnRedirectPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { currentConcept, isLoading } = useLearningSessions(sessionId);

  useEffect(() => {
    if (isLoading || !sessionId) {
      return;
    }

    if (currentConcept) {
      navigate(`/dashboard/learning-graph/sessions/${sessionId}/concepts/${currentConcept.id}`, {
        replace: true,
      });
      return;
    }

    navigate(`/dashboard/learning-graph/sessions/${sessionId}/overview`, {
      replace: true,
    });
  }, [currentConcept, isLoading, navigate, sessionId]);

  return (
    <section className="rounded-xl border border-[var(--alpha-8)] bg-card p-6 text-sm text-muted-foreground">
      Đang mở bước học phù hợp cho phiên này...
    </section>
  );
}
```

- [ ] **Step 4: Move concept and graph pages to `params.sessionId`**

Update both `ConceptLearningPage.tsx` and `KnowledgeGraphPage.tsx`:

```tsx
const params = useParams<{ sessionId: string; conceptId?: string }>();
const sessionId = params.sessionId;
```

Replace old query-string navigation:

```tsx
navigate(`/dashboard/learning-graph/sessions/${session.id}/overview`);
navigate(`/dashboard/learning-graph/sessions/${session.id}/graph`);
navigate(`/dashboard/learning-graph/sessions/${sessionId}/concepts/${nextConceptId}`);
```

Keep the concept-learning content itself intact in this task. Only switch the route shape and shell-aware links.

- [ ] **Step 5: Run dashboard typecheck**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/packages/dashboard
npm run typecheck
```

Expected: PASS with no route-param or import errors.

- [ ] **Step 6: Commit**

```bash
git add \
  packages/dashboard/src/router/AppRoutes.tsx \
  packages/dashboard/src/features/learning-graph/components/LearningSessionShell.tsx \
  packages/dashboard/src/features/learning-graph/pages/LearningSessionLearnRedirectPage.tsx \
  packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx \
  packages/dashboard/src/features/learning-graph/pages/KnowledgeGraphPage.tsx
git commit -m "feat: add learning graph session shell routes"
```

## Task 4: Build the workspace page, spotlight, and create-session drawer

**Files:**
- Create: `packages/dashboard/src/features/learning-graph/components/CreateLearningSessionDialog.tsx`
- Create: `packages/dashboard/src/features/learning-graph/components/LearningSessionCard.tsx`
- Create: `packages/dashboard/src/features/learning-graph/components/LearningSessionSpotlight.tsx`
- Create: `packages/dashboard/src/features/learning-graph/pages/LearningGraphWorkspacePage.tsx`
- Modify: `packages/dashboard/src/features/learning-graph/components/index.ts`
- Test: `cd packages/dashboard && npm run typecheck`
- Test: `cd packages/dashboard && npm run build`

- [ ] **Step 1: Implement the create-session dialog as a right-side drawer**

Create `packages/dashboard/src/features/learning-graph/components/CreateLearningSessionDialog.tsx`:

```tsx
import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@insforge/ui';
import { useLearningSessionLibrary } from '../hooks/useLearningSessionLibrary';

interface CreateLearningSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateLearningSessionDialog({
  open,
  onOpenChange,
}: CreateLearningSessionDialogProps) {
  const { createSession, isCreatingSession } = useLearningSessionLibrary();
  const [topic, setTopic] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!topic.trim()) {
      setError('Chủ đề học là bắt buộc.');
      return;
    }

    try {
      await createSession({
        topic: topic.trim(),
        sourceText: sourceText.trim() || undefined,
      });
      setTopic('');
      setSourceText('');
      setError('');
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không thể tạo phiên học.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="left-auto right-0 top-0 h-dvh w-full max-w-[min(560px,100vw)] translate-x-0 translate-y-0 rounded-none border-l border-[var(--alpha-8)]"
      >
        <form onSubmit={(event) => void handleSubmit(event)} className="flex h-full flex-col">
          <DialogHeader>
            <DialogTitle>Tạo session mới</DialogTitle>
            <DialogDescription>
              Nhập chủ đề học và tài liệu nguồn để tạo lộ trình mới.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="flex-1 gap-5">
            <label className="flex flex-col gap-2 text-sm text-foreground">
              <span>Chủ đề học</span>
              <input
                value={topic}
                onChange={(event) => {
                  setTopic(event.target.value);
                  setError('');
                }}
                placeholder="Ví dụ: Deep Learning"
                className="h-11 rounded-lg border border-[var(--alpha-8)] bg-background px-3"
                autoFocus
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-foreground">
              <span>Tài liệu nguồn</span>
              <textarea
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                placeholder="Dán ghi chú, bài viết ngắn, hoặc tóm tắt tài liệu..."
                className="min-h-48 rounded-lg border border-[var(--alpha-8)] bg-background px-3 py-3"
              />
            </label>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={isCreatingSession || !topic.trim()}>
              {isCreatingSession ? 'Đang tạo...' : 'Tạo session'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Implement spotlight and session-card components**

Create `LearningSessionSpotlight.tsx`:

```tsx
import { Button } from '@insforge/ui';
import { useNavigate } from 'react-router-dom';
import type { LearningSessionLibraryItem } from '../lib/session-workspace';
import { getSessionPrimaryHref } from '../lib/session-workspace';

export function LearningSessionSpotlight({ item }: { item: LearningSessionLibraryItem }) {
  const navigate = useNavigate();

  return (
    <section className="rounded-2xl border border-[var(--alpha-8)] bg-[linear-gradient(135deg,rgba(34,197,94,0.10),rgba(59,130,246,0.08))] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
        Tiếp tục học
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-foreground">{item.session.goalTitle}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {item.currentConcept
          ? `Khái niệm hiện tại: ${item.currentConcept.displayName}`
          : 'Session này đã hoàn thành. Mở overview để xem lại tiến độ.'}
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={() => navigate(getSessionPrimaryHref(item))}>
          {item.session.status === 'completed' ? 'Xem tổng quan' : 'Tiếp tục học'}
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            navigate(`/dashboard/learning-graph/sessions/${item.session.id}/graph`)
          }
        >
          Xem đồ thị
        </Button>
      </div>
    </section>
  );
}
```

Create `LearningSessionCard.tsx`:

```tsx
import { Button } from '@insforge/ui';
import { useNavigate } from 'react-router-dom';
import type { LearningSessionLibraryItem } from '../lib/session-workspace';
import { getSessionPrimaryHref } from '../lib/session-workspace';

export function LearningSessionCard({ item }: { item: LearningSessionLibraryItem }) {
  const navigate = useNavigate();

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => navigate(getSessionPrimaryHref(item))}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigate(getSessionPrimaryHref(item));
        }
      }}
      className="cursor-pointer rounded-xl border border-[var(--alpha-8)] bg-card p-5 transition-colors duration-200 hover:border-[var(--alpha-12)] hover:bg-[var(--alpha-4)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-medium text-foreground">{item.session.goalTitle}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {item.progress.completedCount}/{item.progress.totalCount} khái niệm hoàn thành
          </p>
        </div>
        <span className="rounded-full border border-[var(--alpha-8)] px-2.5 py-1 text-xs text-muted-foreground">
          {item.session.status}
        </span>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {item.currentConcept
          ? `Khái niệm hiện tại: ${item.currentConcept.displayName}`
          : 'Không có khái niệm hiện tại'}
      </p>

      <div className="mt-5 flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/dashboard/learning-graph/sessions/${item.session.id}/overview`);
          }}
        >
          Overview
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/dashboard/learning-graph/sessions/${item.session.id}/graph`);
          }}
        >
          Graph
        </Button>
      </div>
    </article>
  );
}
```

- [ ] **Step 3: Build the workspace page around the new data layer**

Create `packages/dashboard/src/features/learning-graph/pages/LearningGraphWorkspacePage.tsx`:

```tsx
import { useState } from 'react';
import { Button } from '@insforge/ui';
import { useLearningSessionLibrary } from '../hooks/useLearningSessionLibrary';
import { pickSpotlightSession } from '../lib/session-workspace';
import { CreateLearningSessionDialog } from '../components/CreateLearningSessionDialog';
import { LearningSessionCard } from '../components/LearningSessionCard';
import { LearningSessionSpotlight } from '../components/LearningSessionSpotlight';

export default function LearningGraphWorkspacePage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { sessions, spotlightSession, isLoading } = useLearningSessionLibrary();
  const activeSpotlight = spotlightSession ?? pickSpotlightSession(sessions);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-8 py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            AI Learning Graph
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">
            Workspace học tập theo session
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Quản lý nhiều lộ trình học, tiếp tục session đang dở, và mở nhanh overview hoặc graph của từng phiên.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>Tạo session mới</Button>
      </header>

      {isLoading ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="h-56 animate-pulse rounded-2xl bg-[var(--alpha-4)]" />
          <div className="h-56 animate-pulse rounded-2xl bg-[var(--alpha-4)]" />
        </section>
      ) : activeSpotlight ? (
        <LearningSessionSpotlight item={activeSpotlight} />
      ) : (
        <section className="rounded-2xl border border-dashed border-[var(--alpha-8)] bg-card p-8">
          <h2 className="text-xl font-medium text-foreground">Chưa có session nào</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Tạo session đầu tiên để bắt đầu xây dựng lộ trình học cá nhân hóa.
          </p>
          <Button className="mt-5" onClick={() => setIsCreateOpen(true)}>
            Tạo session mới
          </Button>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium text-foreground">Session library</h2>
          <p className="text-sm text-muted-foreground">{sessions.length} session</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((item) => (
            <LearningSessionCard key={item.session.id} item={item} />
          ))}
        </div>
      </section>

      <CreateLearningSessionDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}
```

- [ ] **Step 4: Export the new components and remove reliance on the old create-first page**

Update `packages/dashboard/src/features/learning-graph/components/index.ts`:

```ts
export * from './LearningPathPanel';
export * from './ConceptExplanationCard';
export * from './ConceptQuizCard';
export * from './KnowledgeGraphPanel';
export * from './CreateLearningSessionDialog';
export * from './LearningSessionCard';
export * from './LearningSessionSpotlight';
```

Ensure `LearningGraphWorkspacePage.tsx` is the route target from Task 3 and that `LearningSessionsPage.tsx` is no longer used in `AppRoutes.tsx`.

- [ ] **Step 5: Run typecheck and build**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/packages/dashboard
npm run typecheck
npm run build
```

Expected: PASS with no route/build errors and no missing `Dialog` or component exports.

- [ ] **Step 6: Commit**

```bash
git add \
  packages/dashboard/src/features/learning-graph/components/CreateLearningSessionDialog.tsx \
  packages/dashboard/src/features/learning-graph/components/LearningSessionCard.tsx \
  packages/dashboard/src/features/learning-graph/components/LearningSessionSpotlight.tsx \
  packages/dashboard/src/features/learning-graph/components/index.ts \
  packages/dashboard/src/features/learning-graph/pages/LearningGraphWorkspacePage.tsx
git commit -m "feat: add learning graph workspace ui"
```

## Task 5: Finish session overview behavior and keep workspace state fresh

**Files:**
- Modify: `packages/dashboard/src/features/learning-graph/hooks/useConceptLearning.ts`
- Modify: `packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx`
- Modify: `packages/dashboard/src/features/learning-graph/pages/KnowledgeGraphPage.tsx`
- Create: `packages/dashboard/src/features/learning-graph/pages/LearningSessionOverviewPage.tsx`
- Test: `cd packages/dashboard && npm run typecheck`
- Test: `cd packages/dashboard && npm run build`
- Test: `cd backend && npx vitest run tests/integration/learning-graph/session-flow.test.ts`

- [ ] **Step 1: Implement the overview page**

Create `packages/dashboard/src/features/learning-graph/pages/LearningSessionOverviewPage.tsx`:

```tsx
import { Button } from '@insforge/ui';
import { useNavigate, useParams } from 'react-router-dom';
import { LearningPathPanel } from '../components';
import { useConceptLearning } from '../hooks/useConceptLearning';
import { useLearningSessions } from '../hooks/useLearningSessions';

export default function LearningSessionOverviewPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { session, pathSnapshot, progress, currentConcept, isLoading } = useLearningSessions(sessionId);
  const { graph } = useConceptLearning(sessionId);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <LearningPathPanel
        items={pathSnapshot.map((item) => ({
          conceptId: item.conceptId,
          label: `Khái niệm ${item.position + 1}`,
          pathState: item.pathState,
        }))}
        onSelect={(conceptId) =>
          navigate(`/dashboard/learning-graph/sessions/${sessionId}/concepts/${conceptId}`)
        }
      />

      <section className="rounded-xl border border-[var(--alpha-8)] bg-card p-5">
        <h2 className="text-lg font-medium text-foreground">
          {session?.status === 'completed' ? 'Tổng kết session' : 'Tổng quan tiến độ'}
        </h2>
        {isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Đang tải tổng quan phiên học...</p>
        ) : (
          <div className="mt-4 space-y-3 text-sm text-foreground">
            <p>Tiến độ: {progress.completedCount}/{progress.totalCount}</p>
            <p>Khái niệm hiện tại: {currentConcept?.displayName ?? 'Không có'}</p>
            <p>Số concept trong graph: {graph.concepts.length}</p>
            <p>Số cạnh prerequisite: {graph.edges.length}</p>
          </div>
        )}
        <div className="mt-5 flex gap-3">
          {currentConcept ? (
            <Button
              onClick={() =>
                navigate(`/dashboard/learning-graph/sessions/${sessionId}/concepts/${currentConcept.id}`)
              }
            >
              Tiếp tục học
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={() => navigate(`/dashboard/learning-graph/sessions/${sessionId}/graph`)}
          >
            Xem đồ thị
          </Button>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Keep the workspace library fresh after quiz submissions**

Update `packages/dashboard/src/features/learning-graph/hooks/useConceptLearning.ts`:

```ts
const submitQuizMutation = useMutation({
  mutationFn: (input: SubmitConceptQuizRequestSchema) =>
    learningGraphService.submitQuiz(sessionId!, conceptId!, input),
  onSuccess: (result) => {
    void queryClient.invalidateQueries({ queryKey: ['learning-graph', 'concept', sessionId, conceptId] });
    void queryClient.invalidateQueries({ queryKey: ['learning-graph', 'graph', sessionId] });
    void queryClient.invalidateQueries({ queryKey: ['learning-graph', 'library'] });
    void queryClient.invalidateQueries({ queryKey: ['learning-graph', 'session', sessionId] });
    showToast('Đã cập nhật tiến độ học tập', 'success');
  },
  onError: (error: Error) => {
    showToast(error.message || 'Không thể nộp bài kiểm tra', 'error');
  },
});
```

Remove the `any`-based `setQueryData` block instead of carrying untyped cache mutations forward.

- [ ] **Step 3: Make concept and graph pages shell-friendly**

In `ConceptLearningPage.tsx`, update navigation copy and links:

```tsx
<Button
  type="button"
  variant="outline"
  onClick={() => navigate(`/dashboard/learning-graph/sessions/${session.id}/overview`)}
>
  Về tổng quan
</Button>

<Button
  type="button"
  variant="outline"
  onClick={() => navigate(`/dashboard/learning-graph/sessions/${session.id}/graph`)}
>
  Xem đồ thị
</Button>
```

In `KnowledgeGraphPage.tsx`, replace the old workspace back-link:

```tsx
<Button
  type="button"
  variant="outline"
  onClick={() => navigate(`/dashboard/learning-graph/sessions/${sessionId}/overview`)}
>
  Về tổng quan
</Button>
```

- [ ] **Step 4: Run focused validation**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/packages/dashboard
npm run typecheck
npm run build

cd /home/phan-duong-quoc-nhat/workspace/InsForge/backend
npx vitest run tests/integration/learning-graph/session-flow.test.ts
```

Expected: PASS across the dashboard build and the backend integration test, with no regressions in the existing learning-session flows.

- [ ] **Step 5: Commit**

```bash
git add \
  packages/dashboard/src/features/learning-graph/hooks/useConceptLearning.ts \
  packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx \
  packages/dashboard/src/features/learning-graph/pages/KnowledgeGraphPage.tsx \
  packages/dashboard/src/features/learning-graph/pages/LearningSessionOverviewPage.tsx
git commit -m "feat: finish learning graph session workspace flow"
```
