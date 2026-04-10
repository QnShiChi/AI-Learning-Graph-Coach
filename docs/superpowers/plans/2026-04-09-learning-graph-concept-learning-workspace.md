# Learning Graph Concept Learning Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Learn workspace into a content-first study page where core theory is central, Feynman is only a supporting layer, and regenerated explanations are concise, cached, and reopened instantly.

**Architecture:** Keep the existing route and query flow, but reshape the Learn screen around a wide reading article plus lightweight side rails. Move recap back into the lesson flow, keep support actions compact, and make explanation generation a persisted backend artifact so the frontend can reopen it from concept payload data instead of regenerating it each time.

**Tech Stack:** React, TypeScript, TanStack Query, Tailwind utility classes, Express, PostgreSQL, shared Zod schemas, Vitest

---

## File Structure

- Modify: `packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx`
  Responsibility: allocate width to the reading article, shrink the right support rail, and pass persisted explanation/recap state into the lesson and support components.
- Modify: `packages/dashboard/src/features/learning-graph/components/ConceptLessonCard.tsx`
  Responsibility: make the lesson a theory-first reading article with the order `core concept -> key ideas -> example -> short Feynman -> quiz CTA`.
- Modify: `packages/dashboard/src/features/learning-graph/components/ConceptExplanationCard.tsx`
  Responsibility: show explanation as layered support content only, with summary, key ideas, and bounded full-detail expansion.
- Modify: `packages/dashboard/src/features/learning-graph/components/ConceptMasteryCard.tsx`
  Responsibility: lighten the support rail and remove recap from the fixed side column.
- Modify: `packages/dashboard/src/features/learning-graph/hooks/useConceptLearning.ts`
  Responsibility: prefer explanation from the concept query payload and merge regenerated explanation back into query state.
- Modify: `packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts`
  Responsibility: align the frontend concept-learning payload type with persisted explanation data from the backend.
- Modify: `packages/shared-schemas/src/learning-graph-api.schema.ts`
  Responsibility: extend the concept-learning response contract with nullable persisted explanation content.
- Modify: `backend/src/services/learning-graph/tutor.service.ts`
  Responsibility: generate explanation content in a non-chat style and normalize duplicate or noisy paragraphs before returning it.
- Modify: `backend/src/services/learning-graph/session.service.ts`
  Responsibility: read and upsert persisted explanations keyed by `session_id + concept_id`.
- Modify: `backend/src/services/learning-graph/learning-orchestrator.service.ts`
  Responsibility: return persisted explanation with concept learning payloads and reuse it instead of regenerating when available.
- Create: `backend/src/infra/database/migrations/032_add-learning-concept-explanations.sql`
  Responsibility: store explanation artifacts for later reopen without regeneration.
- Modify: `backend/tests/unit/learning-graph/tutor.service.test.ts`
  Responsibility: lock in the no-chat, no-duplication explanation output behavior.
- Modify: `backend/tests/integration/learning-graph/session-flow.test.ts`
  Responsibility: verify explanation persistence and concept-learning payload behavior.

### Task 1: Update the shared contract and persistence layer for explanations

**Files:**
- Create: `backend/src/infra/database/migrations/032_add-learning-concept-explanations.sql`
- Modify: `packages/shared-schemas/src/learning-graph-api.schema.ts`
- Modify: `backend/src/services/learning-graph/session.service.ts`

- [ ] **Step 1: Write the failing integration test expectation for persisted explanation in concept learning**

```ts
vi.spyOn(SessionService.prototype, 'getPersistedExplanation').mockResolvedValue('Giải thích đã lưu');

const conceptLearning = await service.getConceptLearning({
  userId: '11111111-1111-1111-1111-111111111111',
  sessionId: '55555555-5555-5555-5555-555555555555',
  conceptId: '66666666-6666-6666-6666-666666666666',
});

expect(conceptLearning.explanation).toBe('Giải thích đã lưu');
```

- [ ] **Step 2: Run the focused backend test to verify it fails before implementation**

Run: `cd backend && npm test -- --run tests/integration/learning-graph/session-flow.test.ts`
Expected: FAIL because `getConceptLearning` does not yet include persisted explanation.

- [ ] **Step 3: Add the explanation persistence table migration**

```sql
CREATE TABLE IF NOT EXISTS public.session_concept_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.learning_sessions(id) ON DELETE CASCADE,
  concept_id UUID NOT NULL,
  explanation_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT session_concept_explanations_concept_session_fk
    FOREIGN KEY (session_id, concept_id)
    REFERENCES public.session_concepts(session_id, id)
    ON DELETE CASCADE,
  CONSTRAINT session_concept_explanations_unique UNIQUE (session_id, concept_id)
);
```

- [ ] **Step 4: Extend the shared schema and session service for persisted explanations**

```ts
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

```ts
async getPersistedExplanation(sessionId: string, conceptId: string): Promise<string | null> {
  const result = await this.db.getPool().query(
    `SELECT explanation_text AS "explanationText"
     FROM public.session_concept_explanations
     WHERE session_id = $1 AND concept_id = $2
     LIMIT 1`,
    [sessionId, conceptId]
  );

  return result.rows[0]?.explanationText ?? null;
}
```

- [ ] **Step 5: Include persisted explanation in `getConceptLearningPayload`**

```ts
const [session, concept, mastery, prerequisites, explanation] = await Promise.all([
  this.findSessionById(sessionId),
  this.findConceptById(sessionId, conceptId),
  this.getConceptMastery(sessionId, conceptId),
  this.listPrerequisites(sessionId, conceptId),
  this.getPersistedExplanation(sessionId, conceptId),
]);

return {
  session: this.mapSession(session),
  concept: this.mapConcept(concept),
  mastery,
  explanation,
  prerequisites: ...
};
```

- [ ] **Step 6: Re-run the focused backend test**

Run: `cd backend && npm test -- --run tests/integration/learning-graph/session-flow.test.ts`
Expected: PASS for the persisted explanation assertion.

- [ ] **Step 7: Commit the persistence contract changes**

```bash
git add backend/src/infra/database/migrations/032_add-learning-concept-explanations.sql backend/src/services/learning-graph/session.service.ts packages/shared-schemas/src/learning-graph-api.schema.ts backend/tests/integration/learning-graph/session-flow.test.ts
git commit -m "feat: persist learning concept explanations"
```

### Task 2: Make explanation generation reusable and non-chatty

**Files:**
- Modify: `backend/src/services/learning-graph/tutor.service.ts`
- Modify: `backend/src/services/learning-graph/learning-orchestrator.service.ts`
- Modify: `backend/tests/unit/learning-graph/tutor.service.test.ts`
- Modify: `backend/tests/integration/learning-graph/session-flow.test.ts`

- [ ] **Step 1: Write the failing tutor-service unit test for no-chat, no-duplication output**

```ts
expect(result).not.toContain('Chào bạn');
expect(result).not.toContain('Đừng lo lắng');
expect(result.match(/OOP là cách tổ chức chương trình quanh object và class\./g)?.length ?? 0).toBe(1);
```

- [ ] **Step 2: Run the focused tutor-service test to verify it fails**

Run: `cd backend && npm test -- --run tests/unit/learning-graph/tutor.service.test.ts`
Expected: FAIL because the current explanation output still mirrors raw chat text.

- [ ] **Step 3: Tighten the LLM prompt and clean the returned explanation**

```ts
content: `Hãy giải thích bằng tiếng Việt về khái niệm "${input.conceptName}" cho người học.

Yêu cầu bắt buộc:
- Chỉ viết nội dung giải thích, không mở đầu kiểu hội thoại như "Chào bạn"
- Không viết lời động viên, không viết kiểu chatbot
- Không lặp lại cùng một ý theo nhiều câu gần giống nhau
- Ưu tiên 3 đến 5 đoạn ngắn, mỗi đoạn tập trung một ý`
```

```ts
private cleanExplanationOutput(value: string) {
  const cleanedParagraphs = value
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\*\*/g, '').trim())
    .filter(Boolean)
    .filter((paragraph) => !paragraph.toLowerCase().startsWith('chào bạn'));

  const seen = new Set<string>();
  return cleanedParagraphs
    .filter((paragraph) => {
      const normalized = paragraph.toLowerCase().replace(/\s+/g, ' ').trim();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .join('\n\n');
}
```

- [ ] **Step 4: Reuse persisted explanation instead of regenerating when it already exists**

```ts
if (payload.explanation) {
  return {
    conceptId: input.conceptId,
    explanation: payload.explanation,
  };
}
```

```ts
await this.sessionService.upsertPersistedExplanation({
  sessionId: input.sessionId,
  conceptId: input.conceptId,
  explanation,
});
```

- [ ] **Step 5: Re-run the focused backend tests**

Run: `cd backend && npm test -- --run tests/unit/learning-graph/tutor.service.test.ts`
Expected: PASS with the cleaned explanation output.

Run: `cd backend && npm test -- --run tests/integration/learning-graph/session-flow.test.ts`
Expected: PASS with explanation persistence and reuse verified.

- [ ] **Step 6: Commit the explanation-generation cleanup**

```bash
git add backend/src/services/learning-graph/tutor.service.ts backend/src/services/learning-graph/learning-orchestrator.service.ts backend/tests/unit/learning-graph/tutor.service.test.ts backend/tests/integration/learning-graph/session-flow.test.ts
git commit -m "feat: clean and reuse generated concept explanations"
```

### Task 3: Make the lesson article theory-first and demote Feynman to support

**Files:**
- Modify: `packages/dashboard/src/features/learning-graph/components/ConceptLessonCard.tsx`
- Modify: `packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx`

- [ ] **Step 1: Replace theory-hostile lesson framing with a theory-first article flow**

```tsx
<article className="mx-auto max-w-4xl space-y-10">
  <section>
    <h2 className="text-3xl font-semibold">Khái niệm cốt lõi</h2>
    <p className="text-base leading-8 text-foreground">{lesson.technicalTranslation}</p>
  </section>
  <section>
    <h3 className="text-2xl font-semibold">Các ý chính cần nhớ</h3>
    ...
  </section>
  <section>
    <h3 className="text-2xl font-semibold">Ví dụ minh họa</h3>
    ...
  </section>
  <aside>
    <h4 className="text-lg font-medium">Hiểu nhanh theo kiểu Feynman</h4>
    <p className="text-sm leading-7 text-muted-foreground">{lesson.feynmanExplanation}</p>
  </aside>
</article>
```

- [ ] **Step 2: Pass recap into the lesson article instead of leaving it in the side rail**

```tsx
<ConceptLessonCard
  lesson={conceptLearning.lessonPackage}
  recapSummary={conceptLearning.recap?.summary ?? null}
  onRevealQuiz={revealQuiz}
  ...
/>
```

- [ ] **Step 3: Run dashboard typecheck after the lesson article refactor**

Run: `cd packages/dashboard && npm run typecheck`
Expected: PASS with the theory-first lesson article compiling cleanly.

- [ ] **Step 4: Commit the theory-first lesson redesign**

```bash
git add packages/dashboard/src/features/learning-graph/components/ConceptLessonCard.tsx packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx
git commit -m "feat: make learning lesson theory-first"
```

### Task 4: Turn explanation into layered support content instead of a long chat dump

**Files:**
- Modify: `packages/dashboard/src/features/learning-graph/components/ConceptExplanationCard.tsx`
- Modify: `packages/dashboard/src/features/learning-graph/hooks/useConceptLearning.ts`
- Modify: `packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts`

- [ ] **Step 1: Change explanation state to prefer query payload data and merge regenerated content back into the concept query**

```ts
onSuccess: (result) => {
  queryClient.setQueryData(['learning-graph', 'concept', sessionId, conceptId], (previous) => ({
    ...previous,
    explanation: result.explanation,
  }));
}
```

```ts
explanation: explanationMutation.data?.explanation ?? conceptLearning?.explanation ?? '',
```

- [ ] **Step 2: Render explanation in three layers only: summary, key ideas, full detail**

```tsx
<div className="rounded-xl bg-[var(--alpha-4)] p-3">
  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
    Bản ngắn gọn
  </p>
  <p className="mt-2 text-sm leading-6 text-foreground">{summary}</p>
</div>
```

```tsx
{isExpanded ? (
  <div className="max-h-80 overflow-y-auto rounded-xl border border-[var(--alpha-8)] bg-[var(--alpha-2)] p-4">
    ...
  </div>
) : null}
```

- [ ] **Step 3: Add frontend-side defensive filtering for legacy chatty explanation content**

```ts
const normalizedExplanation = props.explanation
  .split(/\n+/)
  .map((part) => part.trim())
  .filter((part) => !part.toLowerCase().startsWith('chào bạn'))
  .join('\n\n');
```

- [ ] **Step 4: Run dashboard and frontend validation**

Run: `cd packages/dashboard && npm run typecheck`
Expected: PASS with the explanation card and hook changes.

Run: `cd packages/dashboard && npm run build`
Expected: PASS with the updated explanation support UI.

Run: `cd frontend && npm run build`
Expected: PASS with the host app consuming the new explanation contract.

- [ ] **Step 5: Commit the layered explanation UI**

```bash
git add packages/dashboard/src/features/learning-graph/components/ConceptExplanationCard.tsx packages/dashboard/src/features/learning-graph/hooks/useConceptLearning.ts packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts
git commit -m "feat: layer learning explanations for faster reading"
```

### Task 5: Final cross-package verification

**Files:**
- Verify only

- [ ] **Step 1: Run shared schema build**

Run: `cd packages/shared-schemas && npm run build`
Expected: PASS with the updated concept-learning schema.

- [ ] **Step 2: Run the full backend test suite**

Run: `cd backend && npm test`
Expected: PASS with explanation persistence and cleaned tutor output covered.

- [ ] **Step 3: Run backend production build**

Run: `cd backend && npm run build`
Expected: PASS with no TypeScript or bundling failures.

- [ ] **Step 4: Run dashboard validation**

Run: `cd packages/dashboard && npm run typecheck`
Expected: PASS.

Run: `cd packages/dashboard && npm run build`
Expected: PASS.

- [ ] **Step 5: Run frontend host build**

Run: `cd frontend && npm run build`
Expected: PASS. Existing chunk-size or outDir warnings are acceptable if the build exits successfully.

- [ ] **Step 6: Commit the verified end-to-end result**

```bash
git add backend/src/infra/database/migrations/032_add-learning-concept-explanations.sql backend/src/services/learning-graph/session.service.ts backend/src/services/learning-graph/learning-orchestrator.service.ts backend/src/services/learning-graph/tutor.service.ts backend/tests/integration/learning-graph/session-flow.test.ts backend/tests/unit/learning-graph/tutor.service.test.ts packages/shared-schemas/src/learning-graph-api.schema.ts packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts packages/dashboard/src/features/learning-graph/hooks/useConceptLearning.ts packages/dashboard/src/features/learning-graph/components/ConceptLessonCard.tsx packages/dashboard/src/features/learning-graph/components/ConceptExplanationCard.tsx packages/dashboard/src/features/learning-graph/components/ConceptMasteryCard.tsx packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx
git commit -m "feat: redesign learning workspace around core theory"
```

## Self-Review

- Spec coverage: the plan covers theory-first lesson structure, demoted Feynman presentation, layered explanation UI, persisted explanations, and the no-chat/no-duplication explanation rule.
- Placeholder scan: all tasks include exact files, concrete commands, and implementation snippets.
- Type consistency: `explanation` is introduced consistently across shared schema, backend payload, frontend service types, query state, and UI rendering.
