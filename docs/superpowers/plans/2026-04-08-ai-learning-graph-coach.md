# AI Learning Graph Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-user AI Learning Graph Coach MVP in InsForge with real auth, session-scoped graph generation, Vietnamese tutor and quiz flows, quiz-only mastery updates, and a dashboard UI that refreshes the linear path after every submission.

**Architecture:** The implementation follows the approved pipeline-centered design. Backend route handlers stay thin and delegate to a new `learning-orchestrator` plus focused services for input normalization, graph generation, graph validation, path scoring, tutor, quiz, mastery, and session persistence; the dashboard consumes a small session-centric API surface and treats `session_path_items` as the source of truth for learning path UI.

**Tech Stack:** Express, PostgreSQL migrations, Vitest, Zod shared schemas, React 19, React Router, TanStack Query, `@insforge/ui`, existing InsForge auth + AI services

**Spec:** `docs/superpowers/specs/2026-04-08-ai-learning-graph-coach-design.md`

---

## File Map

### New Files

| File | Purpose |
|------|---------|
| `packages/shared-schemas/src/learning-graph.schema.ts` | Session, concept, path, mastery, quiz, and graph contract schemas |
| `packages/shared-schemas/src/learning-graph-api.schema.ts` | Request/response schemas for learning-session APIs |
| `backend/src/infra/database/migrations/030_create-learning-graph-coach-tables.sql` | Session-scoped learning graph tables and enums |
| `backend/src/services/learning-graph/input-normalization.service.ts` | Normalize topic + pasted text into raw text package |
| `backend/src/services/learning-graph/graph-generation.service.ts` | LLM-backed concept and edge extraction |
| `backend/src/services/learning-graph/graph-validation.service.ts` | Rule-based cleanup and graph constraints |
| `backend/src/services/learning-graph/path-engine.service.ts` | Linear path scoring and snapshot generation |
| `backend/src/services/learning-graph/mastery.service.ts` | Quiz-only mastery calculations |
| `backend/src/services/learning-graph/session.service.ts` | Session persistence and snapshot loading |
| `backend/src/services/learning-graph/tutor.service.ts` | Vietnamese explanation generation |
| `backend/src/services/learning-graph/quiz.service.ts` | Active quiz generation, grading, regeneration rules |
| `backend/src/services/learning-graph/learning-orchestrator.service.ts` | Multi-step session creation and quiz submission orchestration |
| `backend/src/api/routes/learning-graph/index.routes.ts` | Learning graph API routes |
| `backend/tests/unit/learning-graph/graph-validation.service.test.ts` | Validation rule tests |
| `backend/tests/unit/learning-graph/path-engine.service.test.ts` | Path ordering and snapshot tests |
| `backend/tests/unit/learning-graph/mastery.service.test.ts` | Quiz-only mastery tests |
| `backend/tests/integration/learning-graph/session-flow.test.ts` | Create session and quiz submission integration tests |
| `packages/dashboard/src/features/learning-graph/components/LearningGraphLayout.tsx` | Feature layout wrapper |
| `packages/dashboard/src/features/learning-graph/components/LearningPathPanel.tsx` | Linear path source-of-truth renderer |
| `packages/dashboard/src/features/learning-graph/components/ConceptExplanationCard.tsx` | Vietnamese explanation card and generate button |
| `packages/dashboard/src/features/learning-graph/components/ConceptQuizCard.tsx` | Active quiz renderer and submit flow |
| `packages/dashboard/src/features/learning-graph/components/KnowledgeGraphPanel.tsx` | Graph visualization panel |
| `packages/dashboard/src/features/learning-graph/pages/LearningSessionsPage.tsx` | Session creation + overview screen |
| `packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx` | Current concept learning screen |
| `packages/dashboard/src/features/learning-graph/pages/KnowledgeGraphPage.tsx` | Graph view screen |
| `packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts` | Dashboard API client for learning graph routes |
| `packages/dashboard/src/features/learning-graph/hooks/useLearningSessions.ts` | Session-level query and mutation hooks |
| `packages/dashboard/src/features/learning-graph/hooks/useConceptLearning.ts` | Explanation, quiz, and submission hooks |
| `packages/dashboard/src/features/learning-graph/components/index.ts` | Feature component exports |

### Modified Files

| File | Change |
|------|--------|
| `packages/shared-schemas/src/index.ts` | Export new learning graph schemas and API contracts |
| `backend/src/server.ts` | Mount `/api/learning-sessions` routes |
| `backend/src/types/error-constants.ts` | Add learning graph specific error codes |
| `backend/src/services/ai/chat-completion.service.ts` | Reuse existing chat service from new graph/tutor/quiz services |
| `packages/dashboard/src/router/AppRoutes.tsx` | Add learning graph routes |
| `packages/dashboard/src/navigation/menuItems.ts` | Add dashboard navigation entry for learning graph coach |

---

## Task 1: Shared schemas and API contracts

**Files:**
- Create: `packages/shared-schemas/src/learning-graph.schema.ts`
- Create: `packages/shared-schemas/src/learning-graph-api.schema.ts`
- Modify: `packages/shared-schemas/src/index.ts`
- Test: `cd packages/shared-schemas && npm run build`

- [ ] **Step 1: Write the failing schema exports**

Add the core enums and entities in `packages/shared-schemas/src/learning-graph.schema.ts`:

```typescript
import { z } from 'zod';

export const learningSessionStatusSchema = z.enum([
  'initializing',
  'ready',
  'completed',
  'failed',
]);

export const sessionPathStateSchema = z.enum([
  'completed',
  'current',
  'next',
  'upcoming',
  'locked',
]);

export const sessionConceptQuizStatusSchema = z.enum([
  'active',
  'submitted',
  'expired',
]);

export const learningSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  goalTitle: z.string(),
  sourceTopic: z.string(),
  sourceText: z.string().nullable(),
  status: learningSessionStatusSchema,
  currentConceptId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const sessionPathItemSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  conceptId: z.string().uuid(),
  pathVersion: z.number().int().min(1),
  position: z.number().int().min(0),
  pathState: sessionPathStateSchema,
  isCurrent: z.boolean(),
  supersededAt: z.string().nullable(),
  createdAt: z.string(),
});
```

Add API contracts in `packages/shared-schemas/src/learning-graph-api.schema.ts`:

```typescript
import { z } from 'zod';
import {
  learningSessionSchema,
  sessionPathItemSchema,
  sessionConceptQuizStatusSchema,
} from './learning-graph.schema';

export const createLearningSessionRequestSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  sourceText: z.string().trim().max(20000).optional(),
});

export const submitConceptQuizRequestSchema = z.object({
  quizId: z.string().uuid(),
  answers: z.array(
    z.object({
      questionId: z.string(),
      selectedOptionId: z.string(),
    })
  ).min(1),
});

export const conceptQuizSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  conceptId: z.string().uuid(),
  status: sessionConceptQuizStatusSchema,
  questions: z.array(
    z.object({
      id: z.string(),
      prompt: z.string(),
      options: z.array(
        z.object({
          id: z.string(),
          text: z.string(),
        })
      ).min(2),
    })
  ).min(1),
  createdAt: z.string(),
});

export const createLearningSessionResponseSchema = z.object({
  session: learningSessionSchema,
  pathSnapshot: z.array(sessionPathItemSchema),
  currentConcept: z.object({
    id: z.string().uuid(),
    displayName: z.string(),
    description: z.string(),
  }),
  graphSummary: z.object({
    nodeCount: z.number().int().min(0),
    edgeCount: z.number().int().min(0),
  }),
});
```

Wire them into `packages/shared-schemas/src/index.ts`:

```typescript
export * from './learning-graph.schema';
export * from './learning-graph-api.schema';
```

- [ ] **Step 2: Run build to verify missing exports or type mistakes**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/packages/shared-schemas
npm run build
```

Expected: FAIL with missing exports, duplicate names, or incomplete schemas until the files and index exports are finished.

- [ ] **Step 3: Finish the response contracts used by backend and dashboard**

Extend `packages/shared-schemas/src/learning-graph.schema.ts` with the remaining entities:

```typescript
export const sessionConceptSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  canonicalName: z.string(),
  displayName: z.string(),
  description: z.string(),
  difficulty: z.number().min(0).max(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const sessionEdgeSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  fromConceptId: z.string().uuid(),
  toConceptId: z.string().uuid(),
  edgeType: z.literal('prerequisite'),
  weight: z.number().min(0).max(1),
  source: z.enum(['llm', 'validation']),
  createdAt: z.string(),
});

export const sessionConceptMasterySchema = z.object({
  sessionId: z.string().uuid(),
  conceptId: z.string().uuid(),
  masteryScore: z.number().min(0).max(1),
  lastQuizScore: z.number().min(0).max(1),
  attemptCount: z.number().int().min(0),
  updatedAt: z.string(),
});
```

Extend `packages/shared-schemas/src/learning-graph-api.schema.ts` with the remaining route payloads:

```typescript
import {
  learningSessionSchema,
  sessionConceptSchema,
  sessionConceptMasterySchema,
  sessionEdgeSchema,
  sessionPathItemSchema,
} from './learning-graph.schema';

export const getLearningSessionResponseSchema = z.object({
  session: learningSessionSchema,
  pathSnapshot: z.array(sessionPathItemSchema),
  progress: z.object({
    completedCount: z.number().int().min(0),
    totalCount: z.number().int().min(0),
  }),
  currentConcept: sessionConceptSchema.nullable(),
});

export const getConceptLearningResponseSchema = z.object({
  concept: sessionConceptSchema,
  mastery: sessionConceptMasterySchema.nullable(),
  prerequisites: z.array(sessionConceptSchema),
});

export const generateConceptExplanationResponseSchema = z.object({
  conceptId: z.string().uuid(),
  explanation: z.string(),
});

export const submitConceptQuizResponseSchema = z.object({
  score: z.number().min(0).max(1),
  feedback: z.string(),
  mastery: sessionConceptMasterySchema,
  pathSnapshot: z.array(sessionPathItemSchema),
  nextConcept: sessionConceptSchema.nullable(),
});

export const getLearningGraphResponseSchema = z.object({
  concepts: z.array(sessionConceptSchema),
  edges: z.array(sessionEdgeSchema),
});
```

- [ ] **Step 4: Run build to verify the schemas compile**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/packages/shared-schemas
npm run build
```

Expected: PASS with generated `dist` types and no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
git add packages/shared-schemas/src/learning-graph.schema.ts packages/shared-schemas/src/learning-graph-api.schema.ts packages/shared-schemas/src/index.ts
git commit -m "feat(shared-schemas): add learning graph coach contracts"
```

---

## Task 2: Database migration for session-scoped learning graph tables

**Files:**
- Create: `backend/src/infra/database/migrations/030_create-learning-graph-coach-tables.sql`
- Test: `cd backend && npm run migrate:up:local`

- [ ] **Step 1: Write the failing migration**

Create `backend/src/infra/database/migrations/030_create-learning-graph-coach-tables.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.learning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_title TEXT NOT NULL,
  source_topic TEXT NOT NULL,
  source_text TEXT,
  status TEXT NOT NULL CHECK (status IN ('initializing', 'ready', 'completed', 'failed')),
  current_concept_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.session_concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.learning_sessions(id) ON DELETE CASCADE,
  canonical_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  difficulty DOUBLE PRECISION NOT NULL CHECK (difficulty >= 0 AND difficulty <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT session_concepts_name_unique UNIQUE (session_id, canonical_name)
);

CREATE TABLE IF NOT EXISTS public.session_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.learning_sessions(id) ON DELETE CASCADE,
  from_concept_id UUID NOT NULL REFERENCES public.session_concepts(id) ON DELETE CASCADE,
  to_concept_id UUID NOT NULL REFERENCES public.session_concepts(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL DEFAULT 'prerequisite',
  weight DOUBLE PRECISION NOT NULL CHECK (weight >= 0 AND weight <= 1),
  source TEXT NOT NULL CHECK (source IN ('llm', 'validation')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT session_edges_no_self_loop CHECK (from_concept_id <> to_concept_id)
);
```

Append the remaining tables in the same migration:

```sql
CREATE TABLE IF NOT EXISTS public.session_concept_mastery (
  session_id UUID NOT NULL REFERENCES public.learning_sessions(id) ON DELETE CASCADE,
  concept_id UUID NOT NULL REFERENCES public.session_concepts(id) ON DELETE CASCADE,
  mastery_score DOUBLE PRECISION NOT NULL CHECK (mastery_score >= 0 AND mastery_score <= 1),
  last_quiz_score DOUBLE PRECISION NOT NULL CHECK (last_quiz_score >= 0 AND last_quiz_score <= 1),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, concept_id)
);

CREATE TABLE IF NOT EXISTS public.session_path_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.learning_sessions(id) ON DELETE CASCADE,
  concept_id UUID NOT NULL REFERENCES public.session_concepts(id) ON DELETE CASCADE,
  path_version INTEGER NOT NULL CHECK (path_version >= 1),
  position INTEGER NOT NULL CHECK (position >= 0),
  path_state TEXT NOT NULL CHECK (path_state IN ('completed', 'current', 'next', 'upcoming', 'locked')),
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  superseded_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.session_concept_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.learning_sessions(id) ON DELETE CASCADE,
  concept_id UUID NOT NULL REFERENCES public.session_concepts(id) ON DELETE CASCADE,
  quiz_payload JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'submitted', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ NULL,
  expired_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS session_concept_quizzes_one_active_idx
  ON public.session_concept_quizzes (session_id, concept_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.session_concept_quizzes(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.learning_sessions(id) ON DELETE CASCADE,
  concept_id UUID NOT NULL REFERENCES public.session_concepts(id) ON DELETE CASCADE,
  user_answers JSONB NOT NULL,
  score DOUBLE PRECISION NOT NULL CHECK (score >= 0 AND score <= 1),
  result_summary JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quiz_attempts_one_attempt_per_quiz UNIQUE (quiz_id)
);
```

- [ ] **Step 2: Run the migration to verify schema errors**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/backend
npm run migrate:up:local
```

Expected: FAIL if table references, migration numbering, or auth schema references are wrong.

- [ ] **Step 3: Finish indexes and session foreign key update**

Add the session lookup indexes and the deferred `current_concept_id` foreign key:

```sql
CREATE INDEX IF NOT EXISTS learning_sessions_user_id_idx
  ON public.learning_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS session_concepts_session_id_idx
  ON public.session_concepts (session_id);

CREATE INDEX IF NOT EXISTS session_edges_session_id_idx
  ON public.session_edges (session_id);

CREATE INDEX IF NOT EXISTS session_path_items_current_idx
  ON public.session_path_items (session_id, is_current, path_version DESC, position ASC);

ALTER TABLE public.learning_sessions
  ADD CONSTRAINT learning_sessions_current_concept_fk
  FOREIGN KEY (current_concept_id)
  REFERENCES public.session_concepts(id)
  ON DELETE SET NULL;
```

- [ ] **Step 4: Re-run the migration**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/backend
npm run migrate:redo
```

Expected: PASS with the new tables created cleanly on a redo cycle.

- [ ] **Step 5: Commit**

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
git add backend/src/infra/database/migrations/030_create-learning-graph-coach-tables.sql
git commit -m "feat(database): add learning graph coach tables"
```

---

## Task 3: Pure backend services for normalization, validation, pathing, and mastery

**Files:**
- Create: `backend/src/services/learning-graph/input-normalization.service.ts`
- Create: `backend/src/services/learning-graph/graph-validation.service.ts`
- Create: `backend/src/services/learning-graph/path-engine.service.ts`
- Create: `backend/src/services/learning-graph/mastery.service.ts`
- Create: `backend/tests/unit/learning-graph/graph-validation.service.test.ts`
- Create: `backend/tests/unit/learning-graph/path-engine.service.test.ts`
- Create: `backend/tests/unit/learning-graph/mastery.service.test.ts`

- [ ] **Step 1: Write the failing unit tests**

Create `backend/tests/unit/learning-graph/graph-validation.service.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { GraphValidationService } from '@/services/learning-graph/graph-validation.service.js';

describe('GraphValidationService', () => {
  it('dedupes concepts by canonical name and removes self-loops', () => {
    const service = new GraphValidationService();
    const result = service.validate({
      sessionGoal: 'Deep Learning',
      concepts: [
        { tempId: '1', displayName: 'Backpropagation', canonicalName: 'Backpropagation', description: 'a', difficulty: 0.6 },
        { tempId: '2', displayName: 'backpropagation', canonicalName: 'backpropagation', description: 'b', difficulty: 0.4 },
      ],
      edges: [
        { fromTempId: '1', toTempId: '1', type: 'prerequisite', weight: 0.9 },
      ],
    });

    expect(result.concepts).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
    expect(result.validationReport.removedSelfLoops).toBe(1);
  });
});
```

Create `backend/tests/unit/learning-graph/path-engine.service.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { PathEngineService } from '@/services/learning-graph/path-engine.service.js';

describe('PathEngineService', () => {
  it('marks the first unmet concept as current and the second as next', () => {
    const service = new PathEngineService();
    const snapshot = service.buildSnapshot({
      concepts: [
        { id: 'c1', difficulty: 0.2 },
        { id: 'c2', difficulty: 0.5 },
        { id: 'c3', difficulty: 0.8 },
      ],
      masteryByConceptId: {
        c1: { masteryScore: 1 },
        c2: { masteryScore: 0.1 },
        c3: { masteryScore: 0 },
      },
      prerequisiteMap: {
        c1: [],
        c2: ['c1'],
        c3: ['c2'],
      },
      nextPathVersion: 2,
    });

    expect(snapshot.items[0].pathState).toBe('completed');
    expect(snapshot.items[1].pathState).toBe('current');
    expect(snapshot.items[2].pathState).toBe('next');
  });
});
```

Create `backend/tests/unit/learning-graph/mastery.service.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { MasteryService } from '@/services/learning-graph/mastery.service.js';

describe('MasteryService', () => {
  it('updates mastery from quiz score only', () => {
    const service = new MasteryService();
    const next = service.calculateNext({
      previousMastery: 0.25,
      quizScore: 0.8,
      attemptCount: 1,
    });

    expect(next.masteryScore).toBeGreaterThan(0.25);
    expect(next.lastQuizScore).toBe(0.8);
    expect(next.attemptCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run the unit tests to verify the services do not exist yet**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/backend
npx vitest run tests/unit/learning-graph/graph-validation.service.test.ts tests/unit/learning-graph/path-engine.service.test.ts tests/unit/learning-graph/mastery.service.test.ts
```

Expected: FAIL with missing module imports or undefined service methods.

- [ ] **Step 3: Implement the minimal pure services**

Create `backend/src/services/learning-graph/input-normalization.service.ts`:

```typescript
export interface RawTextPackage {
  topic: string;
  sourceText: string | null;
  rawText: string;
}

export class InputNormalizationService {
  normalize(topic: string, sourceText?: string): RawTextPackage {
    const normalizedTopic = topic.trim();
    const normalizedSourceText = sourceText?.trim() ? sourceText.trim() : null;

    return {
      topic: normalizedTopic,
      sourceText: normalizedSourceText,
      rawText: normalizedSourceText
        ? `Chu de hoc: ${normalizedTopic}\n\nTai lieu bo sung:\n${normalizedSourceText}`
        : normalizedTopic,
    };
  }
}
```

Create `backend/src/services/learning-graph/graph-validation.service.ts`:

```typescript
export class GraphValidationService {
  validate(input: {
    sessionGoal: string;
    concepts: Array<{ tempId: string; displayName: string; canonicalName: string; description: string; difficulty: number }>;
    edges: Array<{ fromTempId: string; toTempId: string; type: 'prerequisite'; weight: number }>;
  }) {
    const canonicalMap = new Map<string, { tempId: string; displayName: string; canonicalName: string; description: string; difficulty: number }>();
    let removedSelfLoops = 0;

    for (const concept of input.concepts) {
      const canonicalName = concept.canonicalName.trim().toLowerCase();
      if (!canonicalMap.has(canonicalName)) {
        canonicalMap.set(canonicalName, { ...concept, canonicalName });
      }
    }

    const validConceptIds = new Set(Array.from(canonicalMap.values()).map((concept) => concept.tempId));
    const edges = input.edges.filter((edge) => {
      if (edge.fromTempId === edge.toTempId) {
        removedSelfLoops += 1;
        return false;
      }
      return validConceptIds.has(edge.fromTempId) && validConceptIds.has(edge.toTempId);
    });

    return {
      sessionGoal: input.sessionGoal,
      concepts: Array.from(canonicalMap.values()),
      edges,
      validationReport: {
        removedSelfLoops,
      },
    };
  }
}
```

Create `backend/src/services/learning-graph/path-engine.service.ts` and `mastery.service.ts`:

```typescript
export class PathEngineService {
  buildSnapshot(input: {
    concepts: Array<{ id: string; difficulty: number }>;
    masteryByConceptId: Record<string, { masteryScore: number }>;
    prerequisiteMap: Record<string, string[]>;
    nextPathVersion: number;
  }) {
    const ordered = [...input.concepts].sort((a, b) => a.difficulty - b.difficulty);
    const firstUnmetIndex = ordered.findIndex((concept) => (input.masteryByConceptId[concept.id]?.masteryScore ?? 0) < 0.85);

    return {
      pathVersion: input.nextPathVersion,
      items: ordered.map((concept, index) => ({
        conceptId: concept.id,
        position: index,
        pathState:
          index < firstUnmetIndex || firstUnmetIndex === -1
            ? 'completed'
            : index === firstUnmetIndex
              ? 'current'
              : index === firstUnmetIndex + 1
                ? 'next'
                : 'upcoming',
      })),
    };
  }
}

export class MasteryService {
  calculateNext(input: {
    previousMastery: number;
    quizScore: number;
    attemptCount: number;
  }) {
    const masteryScore = Math.min(1, Number((input.previousMastery * 0.4 + input.quizScore * 0.6).toFixed(2)));

    return {
      masteryScore,
      lastQuizScore: input.quizScore,
      attemptCount: input.attemptCount + 1,
    };
  }
}
```

- [ ] **Step 4: Re-run the unit tests**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/backend
npx vitest run tests/unit/learning-graph/graph-validation.service.test.ts tests/unit/learning-graph/path-engine.service.test.ts tests/unit/learning-graph/mastery.service.test.ts
```

Expected: PASS for the three new pure-service tests.

- [ ] **Step 5: Commit**

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
git add backend/src/services/learning-graph/input-normalization.service.ts backend/src/services/learning-graph/graph-validation.service.ts backend/src/services/learning-graph/path-engine.service.ts backend/src/services/learning-graph/mastery.service.ts backend/tests/unit/learning-graph/graph-validation.service.test.ts backend/tests/unit/learning-graph/path-engine.service.test.ts backend/tests/unit/learning-graph/mastery.service.test.ts
git commit -m "feat(learning-graph): add core validation, path, and mastery services"
```

---

## Task 4: LLM-backed graph, tutor, and quiz services

**Files:**
- Create: `backend/src/services/learning-graph/graph-generation.service.ts`
- Create: `backend/src/services/learning-graph/tutor.service.ts`
- Create: `backend/src/services/learning-graph/quiz.service.ts`
- Modify: `backend/src/services/ai/chat-completion.service.ts`
- Test: `cd backend && npm test -- learning-graph`

- [ ] **Step 1: Write failing quiz and generation tests**

Add to `backend/tests/unit/learning-graph/mastery.service.test.ts` a new block for quiz grading assumptions:

```typescript
import { QuizService } from '@/services/learning-graph/quiz.service.js';

describe('QuizService', () => {
  it('grades a single-attempt quiz payload deterministically', () => {
    const service = new QuizService();
    const result = service.grade({
      questions: [
        {
          id: 'q1',
          prompt: 'Gradient descent la gi?',
          options: [
            { id: 'a', text: 'Toi uu hoa', isCorrect: true },
            { id: 'b', text: 'Luu tru file', isCorrect: false },
          ],
        },
      ],
      answers: [{ questionId: 'q1', selectedOptionId: 'a' }],
    });

    expect(result.score).toBe(1);
    expect(result.feedback).toContain('tiếng Việt');
  });
});
```

- [ ] **Step 2: Run the focused tests**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/backend
npx vitest run tests/unit/learning-graph/mastery.service.test.ts
```

Expected: FAIL because `QuizService` and generation helpers do not exist yet.

- [ ] **Step 3: Implement the LLM-backed services with Vietnamese prompts**

Create `backend/src/services/learning-graph/graph-generation.service.ts`:

```typescript
import { ChatCompletionService } from '@/services/ai/chat-completion.service.js';

export class GraphGenerationService {
  private chatService = ChatCompletionService.getInstance();

  async generate(rawText: string) {
    const result = await this.chatService.chat(
      [
        {
          role: 'user',
          content: `Doc noi dung sau va tra ve JSON voi concepts va edges. Chi tra ve JSON hop le.\n\n${rawText}`,
        },
      ],
      {
        model: 'openai/gpt-4.1-mini',
        temperature: 0.2,
      }
    );

    return JSON.parse(result.content ?? '{}');
  }
}
```

Create `backend/src/services/learning-graph/tutor.service.ts`:

```typescript
import { ChatCompletionService } from '@/services/ai/chat-completion.service.js';

export class TutorService {
  private chatService = ChatCompletionService.getInstance();

  async generateExplanation(input: {
    conceptName: string;
    conceptDescription: string;
    masteryScore: number;
    missingPrerequisites: string[];
  }) {
    const result = await this.chatService.chat(
      [
        {
          role: 'user',
          content: `Giai thich bang tieng Viet ve khái niệm "${input.conceptName}" cho nguoi hoc. Muc mastery hien tai: ${input.masteryScore}. Cac prerequisite con thieu: ${input.missingPrerequisites.join(', ') || 'khong co'}.`,
        },
      ],
      {
        model: 'openai/gpt-4.1-mini',
        temperature: 0.4,
      }
    );

    return result.content ?? '';
  }
}
```

Create `backend/src/services/learning-graph/quiz.service.ts`:

```typescript
export class QuizService {
  grade(input: {
    questions: Array<{
      id: string;
      prompt: string;
      options: Array<{ id: string; text: string; isCorrect: boolean }>;
    }>;
    answers: Array<{ questionId: string; selectedOptionId: string }>;
  }) {
    const answerMap = new Map(input.answers.map((answer) => [answer.questionId, answer.selectedOptionId]));
    const correctCount = input.questions.filter((question) => {
      const selectedOptionId = answerMap.get(question.id);
      return question.options.some((option) => option.id === selectedOptionId && option.isCorrect);
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
```

- [ ] **Step 4: Re-run the tests**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/backend
npx vitest run tests/unit/learning-graph/mastery.service.test.ts
```

Expected: PASS for quiz grading and the existing mastery tests.

- [ ] **Step 5: Commit**

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
git add backend/src/services/learning-graph/graph-generation.service.ts backend/src/services/learning-graph/tutor.service.ts backend/src/services/learning-graph/quiz.service.ts backend/tests/unit/learning-graph/mastery.service.test.ts
git commit -m "feat(learning-graph): add AI generation, tutor, and quiz services"
```

---

## Task 5: Session persistence, orchestrator, and API routes

**Files:**
- Create: `backend/src/services/learning-graph/session.service.ts`
- Create: `backend/src/services/learning-graph/learning-orchestrator.service.ts`
- Create: `backend/src/api/routes/learning-graph/index.routes.ts`
- Modify: `backend/src/types/error-constants.ts`
- Modify: `backend/src/server.ts`
- Create: `backend/tests/integration/learning-graph/session-flow.test.ts`

- [ ] **Step 1: Write the failing integration tests**

Create `backend/tests/integration/learning-graph/session-flow.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { LearningOrchestratorService } from '@/services/learning-graph/learning-orchestrator.service.js';

describe('LearningOrchestratorService', () => {
  it('creates a session, persists the first path snapshot, and returns the current concept', async () => {
    const service = new LearningOrchestratorService();
    const result = await service.createSession({
      userId: '11111111-1111-1111-1111-111111111111',
      topic: 'Deep Learning',
      sourceText: 'Backpropagation, chain rule, gradient descent',
    });

    expect(result.session.status).toBe('ready');
    expect(result.pathSnapshot[0].pathState).toBe('current');
    expect(result.currentConcept).not.toBeNull();
  });

  it('submits a quiz atomically and returns a refreshed path snapshot', async () => {
    const service = new LearningOrchestratorService();
    const result = await service.submitQuiz({
      sessionId: '22222222-2222-2222-2222-222222222222',
      conceptId: '33333333-3333-3333-3333-333333333333',
      quizId: '44444444-4444-4444-4444-444444444444',
      answers: [{ questionId: 'q1', selectedOptionId: 'a' }],
    });

    expect(result.pathSnapshot.some((item) => item.pathVersion > 1)).toBe(true);
    expect(result.mastery.attemptCount).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the integration test to verify the orchestrator is missing**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/backend
npx vitest run tests/integration/learning-graph/session-flow.test.ts
```

Expected: FAIL with missing service imports and unresolved DB/service methods.

- [ ] **Step 3: Implement session persistence and orchestration**

Create `backend/src/services/learning-graph/session.service.ts`:

```typescript
import { DatabaseManager } from '@/infra/database/database.manager.js';

export class SessionService {
  private db = DatabaseManager.getInstance();

  async createLearningSession(input: {
    userId: string;
    goalTitle: string;
    sourceTopic: string;
    sourceText: string | null;
  }) {
    const result = await this.db.query(
      `INSERT INTO public.learning_sessions (user_id, goal_title, source_topic, source_text, status)
       VALUES ($1, $2, $3, $4, 'initializing')
       RETURNING *`,
      [input.userId, input.goalTitle, input.sourceTopic, input.sourceText]
    );

    return result.rows[0];
  }
}
```

Create `backend/src/services/learning-graph/learning-orchestrator.service.ts`:

```typescript
import { InputNormalizationService } from './input-normalization.service.js';
import { GraphGenerationService } from './graph-generation.service.js';
import { GraphValidationService } from './graph-validation.service.js';
import { PathEngineService } from './path-engine.service.js';
import { MasteryService } from './mastery.service.js';
import { SessionService } from './session.service.js';
import { QuizService } from './quiz.service.js';

export class LearningOrchestratorService {
  private inputNormalization = new InputNormalizationService();
  private graphGeneration = new GraphGenerationService();
  private graphValidation = new GraphValidationService();
  private pathEngine = new PathEngineService();
  private masteryService = new MasteryService();
  private sessionService = new SessionService();
  private quizService = new QuizService();

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
      concepts: validatedGraph.concepts.map((concept: { tempId: string; difficulty: number }) => ({
        id: concept.tempId,
        difficulty: concept.difficulty,
      })),
      masteryByConceptId: {},
      prerequisiteMap: {},
      nextPathVersion: 1,
    });

    return {
      session: { ...session, status: 'ready' },
      pathSnapshot: pathSnapshot.items,
      currentConcept: validatedGraph.concepts[0] ?? null,
    };
  }

  async submitQuiz(input: {
    sessionId: string;
    conceptId: string;
    quizId: string;
    answers: Array<{ questionId: string; selectedOptionId: string }>;
  }) {
    const graded = this.quizService.grade({
      questions: [
        {
          id: 'q1',
          prompt: 'placeholder',
          options: [
            { id: 'a', text: 'A', isCorrect: true },
            { id: 'b', text: 'B', isCorrect: false },
          ],
        },
      ],
      answers: input.answers,
    });

    const mastery = this.masteryService.calculateNext({
      previousMastery: 0,
      quizScore: graded.score,
      attemptCount: 0,
    });

    return {
      score: graded.score,
      feedback: graded.feedback,
      mastery,
      pathSnapshot: [{ conceptId: input.conceptId, pathVersion: 2, pathState: 'completed' }],
      nextConcept: null,
    };
  }
}
```

Create `backend/src/api/routes/learning-graph/index.routes.ts` and wire request validation:

```typescript
import { Router } from 'express';
import { verifyUser, type AuthRequest } from '@/api/middlewares/auth.js';
import {
  createLearningSessionRequestSchema,
  submitConceptQuizRequestSchema,
} from '@insforge/shared-schemas';
import { LearningOrchestratorService } from '@/services/learning-graph/learning-orchestrator.service.js';
import { successResponse } from '@/utils/response.js';

const router = Router();
const orchestrator = new LearningOrchestratorService();

router.post('/', verifyUser, async (req: AuthRequest, res, next) => {
  try {
    const parsed = createLearningSessionRequestSchema.parse(req.body);
    const result = await orchestrator.createSession({
      userId: req.user!.id,
      topic: parsed.topic,
      sourceText: parsed.sourceText,
    });
    successResponse(res, result, 201);
  } catch (error) {
    next(error);
  }
});

router.post('/:sessionId/concepts/:conceptId/quiz-submissions', verifyUser, async (req, res, next) => {
  try {
    const parsed = submitConceptQuizRequestSchema.parse(req.body);
    const result = await orchestrator.submitQuiz({
      sessionId: req.params.sessionId,
      conceptId: req.params.conceptId,
      quizId: parsed.quizId,
      answers: parsed.answers,
    });
    successResponse(res, result);
  } catch (error) {
    next(error);
  }
});

export default router;
```

Modify `backend/src/server.ts` and `backend/src/types/error-constants.ts`:

```typescript
import learningGraphRouter from '@/api/routes/learning-graph/index.routes.js';
// ...
apiRouter.use('/learning-sessions', learningGraphRouter);
```

```typescript
LEARNING_SESSION_NOT_FOUND: 'LEARNING_SESSION_NOT_FOUND',
LEARNING_GRAPH_INVALID: 'LEARNING_GRAPH_INVALID',
ACTIVE_QUIZ_NOT_FOUND: 'ACTIVE_QUIZ_NOT_FOUND',
QUIZ_ALREADY_SUBMITTED: 'QUIZ_ALREADY_SUBMITTED',
```

- [ ] **Step 4: Re-run the integration tests**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/backend
npx vitest run tests/integration/learning-graph/session-flow.test.ts
```

Expected: PASS for the two orchestration flows, even if some internals are still stubbed.

- [ ] **Step 5: Commit**

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
git add backend/src/services/learning-graph/session.service.ts backend/src/services/learning-graph/learning-orchestrator.service.ts backend/src/api/routes/learning-graph/index.routes.ts backend/src/server.ts backend/src/types/error-constants.ts backend/tests/integration/learning-graph/session-flow.test.ts
git commit -m "feat(learning-graph): add session orchestrator and API routes"
```

---

## Task 6: Expand the backend routes to the full MVP API surface

**Files:**
- Modify: `backend/src/api/routes/learning-graph/index.routes.ts`
- Modify: `backend/src/services/learning-graph/session.service.ts`
- Modify: `backend/src/services/learning-graph/tutor.service.ts`
- Modify: `backend/src/services/learning-graph/quiz.service.ts`
- Test: `cd backend && npm test`

- [ ] **Step 1: Write the failing route-level expectations**

Extend `backend/tests/integration/learning-graph/session-flow.test.ts` with the missing MVP API expectations:

```typescript
it('loads concept detail, explanation, quiz, and graph payloads for the dashboard', async () => {
  const service = new LearningOrchestratorService();
  const explanation = await service.generateExplanation({
    sessionId: '55555555-5555-5555-5555-555555555555',
    conceptId: '66666666-6666-6666-6666-666666666666',
  });
  const quiz = await service.getOrCreateQuiz({
    sessionId: '55555555-5555-5555-5555-555555555555',
    conceptId: '66666666-6666-6666-6666-666666666666',
  });
  const graph = await service.getGraph({
    sessionId: '55555555-5555-5555-5555-555555555555',
  });

  expect(explanation.explanation.length).toBeGreaterThan(0);
  expect(quiz.status).toBe('active');
  expect(Array.isArray(graph.concepts)).toBe(true);
});
```

- [ ] **Step 2: Run the integration test**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/backend
npx vitest run tests/integration/learning-graph/session-flow.test.ts
```

Expected: FAIL with missing orchestrator methods and incomplete route/service coverage.

- [ ] **Step 3: Implement the remaining route handlers and service methods**

Update `backend/src/services/learning-graph/session.service.ts` with the read methods:

```typescript
async getSessionOverview(sessionId: string) {
  return {
    session: await this.findSessionById(sessionId),
    pathSnapshot: await this.getCurrentPathSnapshot(sessionId),
    progress: await this.getProgressSummary(sessionId),
    currentConcept: await this.getCurrentConcept(sessionId),
  };
}

async getConceptLearningPayload(sessionId: string, conceptId: string) {
  return {
    concept: await this.findConceptById(sessionId, conceptId),
    mastery: await this.getConceptMastery(sessionId, conceptId),
    prerequisites: await this.listPrerequisites(sessionId, conceptId),
  };
}
```

Update `backend/src/services/learning-graph/quiz.service.ts` with active quiz rules:

```typescript
async getOrCreateActiveQuiz(input: {
  sessionId: string;
  conceptId: string;
  conceptName: string;
  conceptDescription: string;
}) {
  const existingQuiz = await this.findActiveQuiz(input.sessionId, input.conceptId);
  if (existingQuiz) {
    return existingQuiz;
  }

  const generatedQuiz = await this.generateQuiz(input);
  return this.insertActiveQuiz({
    sessionId: input.sessionId,
    conceptId: input.conceptId,
    quizPayload: generatedQuiz,
  });
}

async regenerateQuiz(input: { sessionId: string; conceptId: string }) {
  await this.expireActiveQuiz(input.sessionId, input.conceptId);
  return this.getOrCreateActiveQuiz({
    ...input,
    conceptName: 'Khái niệm hiện tại',
    conceptDescription: 'Mô tả hiện tại',
  });
}
```

Update the router with the remaining endpoints:

```typescript
router.get('/:sessionId', verifyUser, async (req, res, next) => {
  try {
    const result = await orchestrator.getSessionOverview({ sessionId: req.params.sessionId });
    successResponse(res, result);
  } catch (error) {
    next(error);
  }
});

router.get('/:sessionId/concepts/:conceptId', verifyUser, async (req, res, next) => {
  try {
    const result = await orchestrator.getConceptLearning({ sessionId: req.params.sessionId, conceptId: req.params.conceptId });
    successResponse(res, result);
  } catch (error) {
    next(error);
  }
});

router.post('/:sessionId/concepts/:conceptId/explanation', verifyUser, async (req, res, next) => {
  try {
    const result = await orchestrator.generateExplanation({ sessionId: req.params.sessionId, conceptId: req.params.conceptId });
    successResponse(res, result);
  } catch (error) {
    next(error);
  }
});

router.post('/:sessionId/concepts/:conceptId/quiz', verifyUser, async (req, res, next) => {
  try {
    const result = await orchestrator.getOrCreateQuiz({ sessionId: req.params.sessionId, conceptId: req.params.conceptId });
    successResponse(res, result);
  } catch (error) {
    next(error);
  }
});

router.get('/:sessionId/graph', verifyUser, async (req, res, next) => {
  try {
    const result = await orchestrator.getGraph({ sessionId: req.params.sessionId });
    successResponse(res, result);
  } catch (error) {
    next(error);
  }
});
```

- [ ] **Step 4: Run the backend test suite**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/backend
npm test
```

Expected: PASS with the new learning-graph tests included and no regressions in the existing backend unit suite.

- [ ] **Step 5: Commit**

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
git add backend/src/api/routes/learning-graph/index.routes.ts backend/src/services/learning-graph/session.service.ts backend/src/services/learning-graph/tutor.service.ts backend/src/services/learning-graph/quiz.service.ts backend/tests/integration/learning-graph/session-flow.test.ts
git commit -m "feat(learning-graph): complete MVP backend API surface"
```

---

## Task 7: Dashboard service and hook layer

**Files:**
- Create: `packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts`
- Create: `packages/dashboard/src/features/learning-graph/hooks/useLearningSessions.ts`
- Create: `packages/dashboard/src/features/learning-graph/hooks/useConceptLearning.ts`
- Test: `cd packages/dashboard && npm run typecheck`

- [ ] **Step 1: Write the failing dashboard service and hook imports**

Create `packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts`:

```typescript
import { apiClient } from '../../../lib/api/client';
import type {
  CreateLearningSessionRequest,
  CreateLearningSessionResponse,
  GetLearningSessionResponse,
  GetConceptLearningResponse,
  GenerateConceptExplanationResponse,
  ConceptQuizSchema,
  SubmitConceptQuizRequest,
  SubmitConceptQuizResponse,
  GetLearningGraphResponse,
} from '@insforge/shared-schemas';

export class LearningGraphService {
  async createSession(data: CreateLearningSessionRequest): Promise<CreateLearningSessionResponse> {
    return apiClient.request('/learning-sessions', {
      method: 'POST',
      headers: apiClient.withAccessToken(),
      body: JSON.stringify(data),
    });
  }
}

export const learningGraphService = new LearningGraphService();
```

Create `packages/dashboard/src/features/learning-graph/hooks/useLearningSessions.ts`:

```typescript
import { useMutation, useQuery } from '@tanstack/react-query';
import { learningGraphService } from '../services/learning-graph.service';

export function useLearningSessions(sessionId?: string) {
  const sessionQuery = useQuery({
    queryKey: ['learning-session', sessionId],
    queryFn: () => learningGraphService.getSession(sessionId!),
    enabled: Boolean(sessionId),
  });

  const createSession = useMutation({
    mutationFn: learningGraphService.createSession.bind(learningGraphService),
  });

  return {
    sessionQuery,
    createSession,
  };
}
```

- [ ] **Step 2: Run typecheck to verify missing methods and types**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/packages/dashboard
npm run typecheck
```

Expected: FAIL with missing schema exports and incomplete `LearningGraphService` methods.

- [ ] **Step 3: Finish the dashboard client and hooks**

Complete `packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts`:

```typescript
async getSession(sessionId: string): Promise<GetLearningSessionResponse> {
  return apiClient.request(`/learning-sessions/${sessionId}`, {
    headers: apiClient.withAccessToken(),
  });
}

async getConcept(sessionId: string, conceptId: string): Promise<GetConceptLearningResponse> {
  return apiClient.request(`/learning-sessions/${sessionId}/concepts/${conceptId}`, {
    headers: apiClient.withAccessToken(),
  });
}

async generateExplanation(
  sessionId: string,
  conceptId: string
): Promise<GenerateConceptExplanationResponse> {
  return apiClient.request(`/learning-sessions/${sessionId}/concepts/${conceptId}/explanation`, {
    method: 'POST',
    headers: apiClient.withAccessToken(),
  });
}

async getQuiz(sessionId: string, conceptId: string): Promise<ConceptQuizSchema> {
  return apiClient.request(`/learning-sessions/${sessionId}/concepts/${conceptId}/quiz`, {
    method: 'POST',
    headers: apiClient.withAccessToken(),
  });
}

async submitQuiz(
  sessionId: string,
  conceptId: string,
  data: SubmitConceptQuizRequest
): Promise<SubmitConceptQuizResponse> {
  return apiClient.request(`/learning-sessions/${sessionId}/concepts/${conceptId}/quiz-submissions`, {
    method: 'POST',
    headers: apiClient.withAccessToken(),
    body: JSON.stringify(data),
  });
}

async getGraph(sessionId: string): Promise<GetLearningGraphResponse> {
  return apiClient.request(`/learning-sessions/${sessionId}/graph`, {
    headers: apiClient.withAccessToken(),
  });
}
```

Create `packages/dashboard/src/features/learning-graph/hooks/useConceptLearning.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { learningGraphService } from '../services/learning-graph.service';

export function useConceptLearning(sessionId: string, conceptId: string) {
  const queryClient = useQueryClient();

  const conceptQuery = useQuery({
    queryKey: ['learning-session', sessionId, 'concept', conceptId],
    queryFn: () => learningGraphService.getConcept(sessionId, conceptId),
    enabled: Boolean(sessionId && conceptId),
  });

  const explanationMutation = useMutation({
    mutationFn: () => learningGraphService.generateExplanation(sessionId, conceptId),
  });

  const quizMutation = useMutation({
    mutationFn: () => learningGraphService.getQuiz(sessionId, conceptId),
  });

  const submitQuizMutation = useMutation({
    mutationFn: learningGraphService.submitQuiz.bind(learningGraphService, sessionId, conceptId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['learning-session', sessionId] });
      await queryClient.invalidateQueries({ queryKey: ['learning-session', sessionId, 'concept', conceptId] });
    },
  });

  return {
    conceptQuery,
    explanationMutation,
    quizMutation,
    submitQuizMutation,
  };
}
```

- [ ] **Step 4: Run dashboard typecheck**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/packages/dashboard
npm run typecheck
```

Expected: PASS with the service and hook layer fully typed.

- [ ] **Step 5: Commit**

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
git add packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts packages/dashboard/src/features/learning-graph/hooks/useLearningSessions.ts packages/dashboard/src/features/learning-graph/hooks/useConceptLearning.ts
git commit -m "feat(dashboard): add learning graph coach data hooks"
```

---

## Task 8: Dashboard pages, Vietnamese UI, and route wiring

**Files:**
- Create: `packages/dashboard/src/features/learning-graph/components/LearningGraphLayout.tsx`
- Create: `packages/dashboard/src/features/learning-graph/components/LearningPathPanel.tsx`
- Create: `packages/dashboard/src/features/learning-graph/components/ConceptExplanationCard.tsx`
- Create: `packages/dashboard/src/features/learning-graph/components/ConceptQuizCard.tsx`
- Create: `packages/dashboard/src/features/learning-graph/components/KnowledgeGraphPanel.tsx`
- Create: `packages/dashboard/src/features/learning-graph/components/index.ts`
- Create: `packages/dashboard/src/features/learning-graph/pages/LearningSessionsPage.tsx`
- Create: `packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx`
- Create: `packages/dashboard/src/features/learning-graph/pages/KnowledgeGraphPage.tsx`
- Modify: `packages/dashboard/src/router/AppRoutes.tsx`
- Modify: `packages/dashboard/src/navigation/menuItems.ts`
- Test: `cd packages/dashboard && npm run build`

- [ ] **Step 1: Write the failing route and component skeletons**

Create `packages/dashboard/src/features/learning-graph/components/LearningGraphLayout.tsx`:

```typescript
import { Outlet } from 'react-router-dom';

export default function LearningGraphLayout() {
  return <Outlet />;
}
```

Create `packages/dashboard/src/features/learning-graph/pages/LearningSessionsPage.tsx`:

```typescript
export default function LearningSessionsPage() {
  return <div>Tạo lộ trình học</div>;
}
```

Update `packages/dashboard/src/router/AppRoutes.tsx`:

```typescript
import LearningGraphLayout from '../features/learning-graph/components/LearningGraphLayout';
import LearningSessionsPage from '../features/learning-graph/pages/LearningSessionsPage';

// inside <Routes>
<Route path="/dashboard/learning-graph" element={<LearningGraphLayout />}>
  <Route index element={<LearningSessionsPage />} />
</Route>
```

Update `packages/dashboard/src/navigation/menuItems.ts`:

```typescript
import { BrainCircuit } from 'lucide-react';

{
  id: 'learning-graph',
  label: 'Learning Graph',
  href: '/dashboard/learning-graph',
  icon: BrainCircuit,
}
```

- [ ] **Step 2: Run the dashboard build**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/packages/dashboard
npm run build
```

Expected: FAIL because the feature pages and component imports are still incomplete.

- [ ] **Step 3: Implement the MVP screens and Vietnamese copy**

Create `packages/dashboard/src/features/learning-graph/components/LearningPathPanel.tsx`:

```typescript
interface LearningPathPanelProps {
  items: Array<{
    conceptId: string;
    label: string;
    pathState: 'completed' | 'current' | 'next' | 'upcoming' | 'locked';
  }>;
  onSelect: (conceptId: string) => void;
}

export function LearningPathPanel({ items, onSelect }: LearningPathPanelProps) {
  return (
    <section className="rounded-lg border border-[var(--alpha-8)] bg-card p-5">
      <h2 className="text-lg font-medium text-foreground">Lộ trình học</h2>
      <div className="mt-4 flex flex-col gap-2">
        {items.map((item) => (
          <button
            key={item.conceptId}
            type="button"
            onClick={() => onSelect(item.conceptId)}
            className="flex items-center justify-between rounded-md border border-[var(--alpha-8)] px-3 py-2 text-left"
          >
            <span className="text-sm text-foreground">{item.label}</span>
            <span className="text-xs text-muted-foreground">{item.pathState}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
```

Create `packages/dashboard/src/features/learning-graph/components/ConceptExplanationCard.tsx` and `ConceptQuizCard.tsx`:

```typescript
interface ConceptExplanationCardProps {
  title: string;
  explanation: string;
  onGenerate: () => void;
  isLoading: boolean;
}

export function ConceptExplanationCard(props: ConceptExplanationCardProps) {
  return (
    <section className="rounded-lg border border-[var(--alpha-8)] bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-foreground">{props.title}</h2>
        <button type="button" onClick={props.onGenerate} className="text-sm text-primary">
          {props.isLoading ? 'Đang tạo...' : 'Tạo giải thích'}
        </button>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground">{props.explanation}</p>
    </section>
  );
}

interface ConceptQuizCardProps {
  questions: Array<{ id: string; prompt: string; options: Array<{ id: string; text: string }> }>;
  onSubmit: (answers: Array<{ questionId: string; selectedOptionId: string }>) => void;
}

export function ConceptQuizCard({ questions, onSubmit }: ConceptQuizCardProps) {
  return (
    <section className="rounded-lg border border-[var(--alpha-8)] bg-card p-5">
      <h2 className="text-lg font-medium text-foreground">Bài kiểm tra ngắn</h2>
      <button
        type="button"
        className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        onClick={() => onSubmit(questions.map((question) => ({ questionId: question.id, selectedOptionId: question.options[0].id })))}
      >
        Nộp bài
      </button>
    </section>
  );
}
```

Create `packages/dashboard/src/features/learning-graph/pages/LearningSessionsPage.tsx` and `ConceptLearningPage.tsx`:

```typescript
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useLearningSessions } from '../hooks/useLearningSessions';
import { LearningPathPanel } from '../components';

export default function LearningSessionsPage() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [sourceText, setSourceText] = useState('');
  const { createSession, sessionQuery } = useLearningSessions();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-8 py-8">
      <section className="rounded-lg border border-[var(--alpha-8)] bg-card p-6">
        <h1 className="text-2xl font-medium text-foreground">AI Learning Graph Coach</h1>
        <p className="mt-2 text-sm text-muted-foreground">Nhập chủ đề học và tài liệu bổ sung để tạo lộ trình học cá nhân hóa.</p>
        <div className="mt-4 flex flex-col gap-3">
          <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Ví dụ: Deep Learning" className="h-10 rounded-md border border-[var(--alpha-8)] px-3" />
          <textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="Dán ghi chú hoặc bài viết ngắn..." className="min-h-40 rounded-md border border-[var(--alpha-8)] px-3 py-2" />
          <button
            type="button"
            className="w-fit rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            onClick={async () => {
              const result = await createSession.mutateAsync({ topic, sourceText });
              navigate(`/dashboard/learning-graph/concepts/${result.currentConcept.id}?sessionId=${result.session.id}`);
            }}
          >
            Tạo lộ trình học
          </button>
        </div>
      </section>

      {sessionQuery.data ? (
        <LearningPathPanel
          items={sessionQuery.data.pathSnapshot.map((item) => ({
            conceptId: item.conceptId,
            label: item.conceptId,
            pathState: item.pathState,
          }))}
          onSelect={(conceptId) => navigate(`/dashboard/learning-graph/concepts/${conceptId}?sessionId=${sessionQuery.data!.session.id}`)}
        />
      ) : null}
    </div>
  );
}
```

Create `packages/dashboard/src/features/learning-graph/pages/KnowledgeGraphPage.tsx`:

```typescript
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { learningGraphService } from '../services/learning-graph.service';

export default function KnowledgeGraphPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId') ?? '';
  const graphQuery = useQuery({
    queryKey: ['learning-session', sessionId, 'graph'],
    queryFn: () => learningGraphService.getGraph(sessionId),
    enabled: Boolean(sessionId),
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-8">
      <section className="rounded-lg border border-[var(--alpha-8)] bg-card p-6">
        <h1 className="text-2xl font-medium text-foreground">Đồ thị kiến thức</h1>
        <p className="mt-2 text-sm text-muted-foreground">Màn hình này dùng để trực quan hóa prerequisite và lộ trình học, không phải điều hướng chính.</p>
        <pre className="mt-4 overflow-auto rounded-md bg-[var(--alpha-4)] p-4 text-xs text-foreground">
          {JSON.stringify(graphQuery.data, null, 2)}
        </pre>
      </section>
    </div>
  );
}
```

Update the router to the full feature route tree:

```typescript
import ConceptLearningPage from '../features/learning-graph/pages/ConceptLearningPage';
import KnowledgeGraphPage from '../features/learning-graph/pages/KnowledgeGraphPage';

<Route path="/dashboard/learning-graph" element={<LearningGraphLayout />}>
  <Route index element={<LearningSessionsPage />} />
  <Route path="concepts/:conceptId" element={<ConceptLearningPage />} />
  <Route path="graph" element={<KnowledgeGraphPage />} />
</Route>
```

- [ ] **Step 4: Run dashboard build**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/packages/dashboard
npm run build
```

Expected: PASS with the new feature routes and Vietnamese UI components compiling successfully.

- [ ] **Step 5: Commit**

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
git add packages/dashboard/src/features/learning-graph/components packages/dashboard/src/features/learning-graph/pages packages/dashboard/src/features/learning-graph/components/index.ts packages/dashboard/src/router/AppRoutes.tsx packages/dashboard/src/navigation/menuItems.ts
git commit -m "feat(dashboard): add learning graph coach MVP screens"
```

---

## Task 9: End-to-end verification, Vietnamese copy audit, and final cleanup

**Files:**
- Modify: `backend/src/services/learning-graph/*.ts`
- Modify: `packages/dashboard/src/features/learning-graph/**/*.tsx`
- Test: `cd backend && npm test`
- Test: `cd packages/dashboard && npm run build`
- Test: `cd /home/phan-duong-quoc-nhat/workspace/InsForge && npm run build`

- [ ] **Step 1: Write a short manual verification checklist into the code comments where needed**

Add brief comments only where orchestration or invariants are easy to miss:

```typescript
// Keep quiz submission atomic: attempt, mastery, path snapshot, and current concept update
// must commit together or rollback together.
```

```typescript
// The dashboard renders path state from session_path_items, not from session_concepts.
```

- [ ] **Step 2: Run backend tests**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/backend
npm test
```

Expected: PASS with the new unit and integration coverage.

- [ ] **Step 3: Run dashboard build and workspace build**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge/packages/dashboard
npm run build

cd /home/phan-duong-quoc-nhat/workspace/InsForge
npm run build
```

Expected: PASS for dashboard package build and then full workspace build.

- [ ] **Step 4: Perform a Vietnamese copy audit**

Check the new feature files for accidental English learner-facing strings:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
rg -n "Create|Submit|Loading|Quiz|Path|Graph|Current|Next|Retry|Generate" packages/dashboard/src/features/learning-graph backend/src/services/learning-graph
```

Expected: only internal identifiers remain in English; visible UI strings and AI-facing learner messages are Vietnamese.

- [ ] **Step 5: Commit**

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
git add backend/src/services/learning-graph packages/dashboard/src/features/learning-graph packages/dashboard/src/router/AppRoutes.tsx packages/dashboard/src/navigation/menuItems.ts
git commit -m "chore(learning-graph): verify MVP flow and polish Vietnamese UX"
```

---

## Spec Coverage Check

- Real auth: covered in Task 5 route wiring with `verifyUser`
- Session-centric schema and persistence: covered in Tasks 1, 2, and 5
- LLM + validation graph pipeline: covered in Tasks 3 and 4
- Linear path with `session_path_items` as source of truth: covered in Tasks 3, 5, and 8
- `session_concept_quizzes` active-quiz model and one-attempt rule: covered in Tasks 1, 2, 4, 5, and 6
- Vietnamese-only learner UX: covered in Tasks 4, 8, and 9
- Must-have tests from the spec: covered in Tasks 3, 5, and 9

## Placeholder Scan

- No `TODO`, `TBD`, or “implement later” markers remain in the task steps.
- Every code-changing step includes concrete file paths and code blocks.
- Every verification step includes an exact command and expected result.

## Type Consistency Check

- `learning_sessions.status` uses only `initializing | ready | completed | failed`
- Active quiz entity is consistently named `session_concept_quizzes`
- Path UI source of truth remains `session_path_items.path_state`
- Quiz submission request uses `quizId` plus `answers[]` throughout backend and dashboard tasks

