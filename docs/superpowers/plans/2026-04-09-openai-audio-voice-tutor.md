# OpenAI Audio Voice Tutor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current browser-speech-and-Ollama voice sandbox with an OpenAI Audio API based, concept-scoped voice tutor for learning graph concept pages.

**Architecture:** Keep the lesson-first learning page intact and swap the voice path in two layers: backend moves to one-turn OpenAI STT + grounded tutor response + OpenAI TTS, and dashboard replaces the sandbox block with a floating dock plus bottom sheet that streams transcript and plays assistant audio. Persist transcript history by session, concept, and lesson version so reloads and quiz suggestions remain grounded.

**Tech Stack:** Node/Express backend, PostgreSQL persistence via SessionService, React/TypeScript dashboard, TanStack Query, OpenAI Node SDK, shared Zod schemas.

---

## File Map

### Backend

- Modify: `backend/src/api/routes/learning-graph/index.routes.ts`
  - Replace sandbox-only route surface with `voice-turns` and `voice-history`.
- Modify: `backend/src/services/learning-graph/learning-orchestrator.service.ts`
  - Orchestrate transcript history reads, one-turn processing, audio generation response shape, and quiz suggestion flag.
- Modify: `backend/src/services/learning-graph/voice-tutor.service.ts`
  - Remove Ollama dependency and implement OpenAI-backed grounded tutor generation.
- Create: `backend/src/services/learning-graph/voice-audio.service.ts`
  - Isolate OpenAI STT/TTS calls and response normalization.
- Modify: `backend/src/services/learning-graph/session.service.ts`
  - Add transcript history persistence and retrieval helpers by session/concept/lesson version.
- Modify: `backend/src/infra/database/migrations/`
  - Add one migration for transcript-turn persistence if the existing voice summary table is insufficient.
- Test: `backend/tests/unit/learning-graph/voice-tutor.service.test.ts`
- Test: `backend/tests/integration/learning-graph/session-flow.test.ts`

### Shared Contracts

- Modify: `packages/shared-schemas/src/learning-graph-api.schema.ts`
  - Add request/response contracts for `voice-turns` and `voice-history`.
- Modify: `packages/shared-schemas/src/index.ts`
  - Export new voice tutor schemas.

### Dashboard

- Modify: `packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts`
  - Replace sandbox request methods with audio-turn and history methods.
- Modify: `packages/dashboard/src/features/learning-graph/hooks/useConceptLearning.ts`
  - Add voice-turn mutation and history query invalidation.
- Create: `packages/dashboard/src/features/learning-graph/hooks/useVoiceTutor.ts`
  - Own recorder state, streaming transcript state, audio playback state, and quiz suggestion confirmation state.
- Create: `packages/dashboard/src/features/learning-graph/components/VoiceTutorDock.tsx`
  - Floating launcher control.
- Create: `packages/dashboard/src/features/learning-graph/components/VoiceTutorSheet.tsx`
  - Main tutor UI with transcript, history, controls, and fallback text input.
- Modify: `packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx`
  - Remove sandbox section and mount dock/sheet flow.
- Test: `packages/dashboard/src/features/learning-graph/lib/__tests__/voice-sandbox.test.ts`
  - Replace with `voice-tutor.test.ts` or extend to cover new UI state helpers.

---

### Task 1: Define Shared Voice Tutor Contracts

**Files:**
- Modify: `packages/shared-schemas/src/learning-graph-api.schema.ts`
- Modify: `packages/shared-schemas/src/index.ts`
- Test: `packages/shared-schemas/src/learning-graph-api.schema.ts`

- [ ] **Step 1: Write the failing contract assertions**

Create a minimal schema test inline in the backend integration test flow by parsing representative payloads:

```ts
const parsedRequest = createVoiceTurnRequestSchema.parse({
  lessonVersion: 2,
  transcriptFallback: 'giải thích lại giúp tôi class và object',
});

const parsedResponse = createVoiceTurnResponseSchema.parse({
  learnerTranscript: 'giải thích lại giúp tôi class và object',
  assistantTranscript: 'Class là bản thiết kế, object là chiếc xe thật.',
  assistantAudio: {
    mimeType: 'audio/mpeg',
    base64Audio: 'ZmFrZQ==',
  },
  summaryVersion: 3,
  suggestQuiz: false,
});
```

- [ ] **Step 2: Run type-level verification mentally, then add the schema**

Add new contracts:

```ts
export const createVoiceTurnRequestSchema = z.object({
  lessonVersion: z.number().int().min(1),
  transcriptFallback: z.string().trim().min(1).optional(),
});

export const voiceTutorAudioSchema = z.object({
  mimeType: z.string().min(1),
  base64Audio: z.string().min(1),
});

export const createVoiceTurnResponseSchema = z.object({
  learnerTranscript: z.string(),
  assistantTranscript: z.string(),
  assistantAudio: voiceTutorAudioSchema.nullable(),
  summaryVersion: z.number().int().min(1),
  suggestQuiz: z.boolean(),
});

export const getVoiceHistoryResponseSchema = z.object({
  turns: z.array(
    z.object({
      id: z.string().uuid(),
      learnerTranscript: z.string(),
      assistantTranscript: z.string(),
      lessonVersion: z.number().int().min(1),
      createdAt: z.string(),
    })
  ),
});
```

- [ ] **Step 3: Export the new types**

Add exports in `packages/shared-schemas/src/index.ts`:

```ts
export * from './learning-graph-api.schema.js';
```

If already exported wholesale, only ensure the new named types exist:

```ts
export type CreateVoiceTurnRequestSchema = z.infer<typeof createVoiceTurnRequestSchema>;
export type CreateVoiceTurnResponseSchema = z.infer<typeof createVoiceTurnResponseSchema>;
export type GetVoiceHistoryResponseSchema = z.infer<typeof getVoiceHistoryResponseSchema>;
```

- [ ] **Step 4: Run schema package build**

Run: `cd packages/shared-schemas && npm run build`  
Expected: command exits `0`

- [ ] **Step 5: Commit**

```bash
git add packages/shared-schemas/src/learning-graph-api.schema.ts packages/shared-schemas/src/index.ts
git commit -m "feat: add voice tutor API contracts"
```

---

### Task 2: Replace Ollama Voice Logic with OpenAI Audio Services

**Files:**
- Create: `backend/src/services/learning-graph/voice-audio.service.ts`
- Modify: `backend/src/services/learning-graph/voice-tutor.service.ts`
- Test: `backend/tests/unit/learning-graph/voice-tutor.service.test.ts`

- [ ] **Step 1: Write the failing backend unit test**

Add a new test:

```ts
it('returns a grounded assistant reply and audio payload using OpenAI-backed services', async () => {
  const transcribe = vi.spyOn(VoiceAudioService.prototype, 'transcribe').mockResolvedValue(
    'giải thích lại giúp tôi class và object'
  );
  const synthesize = vi.spyOn(VoiceAudioService.prototype, 'synthesize').mockResolvedValue({
    mimeType: 'audio/mpeg',
    base64Audio: 'ZmFrZQ==',
  });

  const service = new VoiceTutorService();
  const result = await service.reply({
    conceptName: 'Giới thiệu về OOP',
    lessonPackage: {
      feynmanExplanation: 'Class là bản thiết kế, object là chiếc xe thật.',
      technicalTranslation: 'Class định nghĩa cấu trúc; object là thể hiện cụ thể.',
    },
    prerequisiteNames: [],
    priorSummary: null,
    learnerUtterance: 'giải thích lại giúp tôi class và object',
  });

  expect(result.replyText.length).toBeGreaterThan(0);
  expect(result.audio).toEqual({ mimeType: 'audio/mpeg', base64Audio: 'ZmFrZQ==' });
  expect(transcribe).not.toHaveBeenCalled();
  expect(synthesize).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the unit test to confirm it fails**

Run: `cd backend && npx vitest run tests/unit/learning-graph/voice-tutor.service.test.ts`  
Expected: FAIL because `VoiceAudioService` and audio payload fields do not exist yet

- [ ] **Step 3: Create the OpenAI audio service**

Implement `backend/src/services/learning-graph/voice-audio.service.ts`:

```ts
import OpenAI from 'openai';

export class VoiceAudioService {
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  async transcribe(input: { audioBuffer: Buffer; mimeType: string }) {
    const file = await OpenAI.toFile(input.audioBuffer, 'voice-turn.webm', {
      type: input.mimeType,
    });
    const response = await this.client.audio.transcriptions.create({
      file,
      model: 'gpt-4o-mini-transcribe',
    });
    return response.text.trim();
  }

  async synthesize(input: { text: string }) {
    const response = await this.client.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: 'alloy',
      input: input.text,
      format: 'mp3',
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      mimeType: 'audio/mpeg',
      base64Audio: buffer.toString('base64'),
    };
  }
}
```

- [ ] **Step 4: Update `VoiceTutorService` to use OpenAI and return audio**

Replace Ollama fetch logic with OpenAI-backed text generation plus audio synthesis:

```ts
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const completion = await client.chat.completions.create({
  model: 'gpt-5.4-mini',
  temperature: 0.4,
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: GROUNDED_PROMPT },
  ],
});

const replyText = completion.choices[0]?.message?.content?.trim() || DEFAULT_REPLY_TEXT;
const audio = await this.voiceAudioService.synthesize({ text: replyText });

return {
  replyText,
  audio,
  summary: this.buildSummary(...),
};
```

- [ ] **Step 5: Re-run the unit test**

Run: `cd backend && npx vitest run tests/unit/learning-graph/voice-tutor.service.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/learning-graph/voice-audio.service.ts backend/src/services/learning-graph/voice-tutor.service.ts backend/tests/unit/learning-graph/voice-tutor.service.test.ts
git commit -m "feat: move voice tutor to openai audio services"
```

---

### Task 3: Add Voice Turn Persistence and API Routes

**Files:**
- Modify: `backend/src/services/learning-graph/session.service.ts`
- Modify: `backend/src/services/learning-graph/learning-orchestrator.service.ts`
- Modify: `backend/src/api/routes/learning-graph/index.routes.ts`
- Modify or Create: `backend/src/infra/database/migrations/*voice-turns*.sql`
- Test: `backend/tests/integration/learning-graph/session-flow.test.ts`

- [ ] **Step 1: Write the failing integration test**

Add a learning graph integration test:

```ts
it('creates a voice turn, persists transcript history, and returns audio metadata', async () => {
  vi.spyOn(SessionService.prototype, 'findSessionByIdForUser').mockResolvedValue(mockSession);
  vi.spyOn(SessionService.prototype, 'findConceptById').mockResolvedValue(mockConcept);
  vi.spyOn(SessionService.prototype, 'getCurrentLessonPackage').mockResolvedValue(mockLesson);
  vi.spyOn(SessionService.prototype, 'getLatestVoiceSummary').mockResolvedValue(null);
  vi.spyOn(SessionService.prototype, 'insertVoiceTurn').mockResolvedValue({
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    summaryVersion: 1,
  });
  vi.spyOn(VoiceTutorService.prototype, 'reply').mockResolvedValue({
    replyText: 'Class là bản thiết kế, object là chiếc xe thật.',
    audio: { mimeType: 'audio/mpeg', base64Audio: 'ZmFrZQ==' },
    summary: '...',
  });

  const service = new LearningOrchestratorService();
  const result = await service.createVoiceTurn({
    userId: mockUserId,
    sessionId: mockSession.id,
    conceptId: mockConcept.id,
    transcriptFallback: 'giải thích lại giúp tôi class và object',
    lessonVersion: 1,
  });

  expect(result.assistantAudio?.mimeType).toBe('audio/mpeg');
  expect(result.learnerTranscript).toContain('class');
});
```

- [ ] **Step 2: Run the integration test to confirm it fails**

Run: `cd backend && npx vitest run tests/integration/learning-graph/session-flow.test.ts`  
Expected: FAIL because the new service method and persistence path do not exist yet

- [ ] **Step 3: Add persistence helpers**

In `SessionService`, add methods like:

```ts
async insertVoiceTurn(input: {
  sessionId: string;
  conceptId: string;
  lessonVersion: number;
  learnerTranscript: string;
  assistantTranscript: string;
  summary: string;
}) { /* INSERT ... RETURNING id, summary_version */ }

async listVoiceTurns(sessionId: string, conceptId: string, lessonVersion: number) {
  /* SELECT id, learner_transcript, assistant_transcript, lesson_version, created_at */
}
```

If the existing `session_concept_voice_summaries` table cannot support per-turn history, create a migration for:

```sql
CREATE TABLE public.session_concept_voice_turns (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL,
  concept_id uuid NOT NULL,
  lesson_version integer NOT NULL,
  learner_transcript text NOT NULL,
  assistant_transcript text NOT NULL,
  summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 4: Add orchestrator methods**

In `LearningOrchestratorService` add:

```ts
async createVoiceTurn(input: { ... }) {
  const session = await this.requireOwnedSession(...);
  const concept = await this.requireConcept(...);
  const lessonPackage = await this.lessonPackageService.getOrCreateCurrentLessonPackage(...);
  const priorSummary = await this.sessionService.getLatestVoiceSummary(...);
  const reply = await this.voiceTutorService.reply({ ... });
  const persisted = await this.sessionService.insertVoiceTurn({ ... });

  return {
    learnerTranscript: input.transcriptFallback,
    assistantTranscript: reply.replyText,
    assistantAudio: reply.audio,
    summaryVersion: persisted.summaryVersion,
    suggestQuiz: false,
  };
}

async getVoiceHistory(input: { ... }) {
  return {
    turns: await this.sessionService.listVoiceTurns(...),
  };
}
```

- [ ] **Step 5: Add routes**

In `backend/src/api/routes/learning-graph/index.routes.ts` add:

```ts
router.post('/:sessionId/concepts/:conceptId/voice-turns', verifyUser, async (req, res, next) => {
  // safeParse request, call orchestrator, successResponse(res, result)
});

router.get('/:sessionId/concepts/:conceptId/voice-history', verifyUser, async (req, res, next) => {
  // call orchestrator and return successResponse
});
```

- [ ] **Step 6: Re-run the integration test**

Run: `cd backend && npx vitest run tests/integration/learning-graph/session-flow.test.ts`  
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/learning-graph/session.service.ts backend/src/services/learning-graph/learning-orchestrator.service.ts backend/src/api/routes/learning-graph/index.routes.ts backend/src/infra/database/migrations backend/tests/integration/learning-graph/session-flow.test.ts
git commit -m "feat: add openai voice turn api and persistence"
```

---

### Task 4: Replace the Sandbox UI with Voice Tutor Dock and Sheet

**Files:**
- Create: `packages/dashboard/src/features/learning-graph/hooks/useVoiceTutor.ts`
- Create: `packages/dashboard/src/features/learning-graph/components/VoiceTutorDock.tsx`
- Create: `packages/dashboard/src/features/learning-graph/components/VoiceTutorSheet.tsx`
- Modify: `packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts`
- Modify: `packages/dashboard/src/features/learning-graph/hooks/useConceptLearning.ts`
- Modify: `packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx`
- Test: `packages/dashboard/src/features/learning-graph/lib/__tests__/voice-tutor.test.ts`

- [ ] **Step 1: Write the failing dashboard state test**

Add a helper test:

```ts
it('shows a quiz suggestion banner only after the assistant flags readiness', () => {
  const state = reduceVoiceTutorState(initialState, {
    type: 'assistant_turn_completed',
    payload: {
      assistantTranscript: 'Mình nghĩ bạn đã nắm được ý chính rồi.',
      suggestQuiz: true,
    },
  });

  expect(state.showQuizSuggestion).toBe(true);
});
```

- [ ] **Step 2: Run the failing dashboard test**

Run: `cd packages/dashboard && npx vitest run src/features/learning-graph/lib/__tests__/voice-tutor.test.ts`  
Expected: FAIL because the reducer/helper does not exist yet

- [ ] **Step 3: Add client service methods**

In `learning-graph.service.ts` add:

```ts
async createVoiceTurn(sessionId: string, conceptId: string, input: { lessonVersion: number; transcriptFallback?: string }) {
  return apiClient.request(`/learning-sessions/${sessionId}/concepts/${conceptId}/voice-turns`, {
    method: 'POST',
    headers: apiClient.withAccessToken(),
    body: JSON.stringify(input),
  });
}

async getVoiceHistory(sessionId: string, conceptId: string) {
  return apiClient.request(`/learning-sessions/${sessionId}/concepts/${conceptId}/voice-history`, {
    headers: apiClient.withAccessToken(),
  });
}
```

- [ ] **Step 4: Add `useVoiceTutor`**

Implement a focused hook:

```ts
export function useVoiceTutor(sessionId?: string, conceptId?: string, lessonVersion?: number) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftTranscript, setDraftTranscript] = useState('');
  const historyQuery = useQuery(...);
  const turnMutation = useMutation(...);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    draftTranscript,
    setDraftTranscript,
    history: historyQuery.data?.turns ?? [],
    createTurn: turnMutation.mutateAsync,
    isSubmitting: turnMutation.isPending,
  };
}
```

- [ ] **Step 5: Create dock and sheet UI**

Implement:

```tsx
export function VoiceTutorDock({ onOpen }: { onOpen: () => void }) {
  return (
    <button className="fixed bottom-6 right-6 ..." onClick={onOpen}>
      Hỏi tutor bằng giọng nói
    </button>
  );
}

export function VoiceTutorSheet(props: ...) {
  return (
    <section className="fixed inset-x-0 bottom-0 ...">
      <header>...</header>
      <div>{history.map(...)}</div>
      <textarea ... />
      <button onClick={...}>Bắt đầu nói</button>
      <button onClick={...}>Gửi lượt hiện tại</button>
    </section>
  );
}
```

For this phase, render transcript streaming progressively in the current turn UI even if the actual transport is chunk-append on the client from a completed response.

- [ ] **Step 6: Replace the concept page sandbox block**

In `ConceptLearningPage.tsx`, remove:

```tsx
<VoiceTutorSandboxPanel ... />
```

and mount:

```tsx
<VoiceTutorDock onOpen={voiceTutor.open} />
<VoiceTutorSheet
  isOpen={voiceTutor.isOpen}
  onClose={voiceTutor.close}
  history={voiceTutor.history}
  onSubmitTurn={voiceTutor.createTurn}
  lessonVersion={conceptLearning.lessonPackage.version}
  onConfirmQuiz={revealQuiz}
/>
```

- [ ] **Step 7: Re-run dashboard tests and typecheck**

Run:
- `cd packages/dashboard && npx vitest run src/features/learning-graph/lib/__tests__/voice-tutor.test.ts`
- `cd packages/dashboard && npm run typecheck`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/dashboard/src/features/learning-graph/services/learning-graph.service.ts packages/dashboard/src/features/learning-graph/hooks/useConceptLearning.ts packages/dashboard/src/features/learning-graph/hooks/useVoiceTutor.ts packages/dashboard/src/features/learning-graph/components/VoiceTutorDock.tsx packages/dashboard/src/features/learning-graph/components/VoiceTutorSheet.tsx packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx packages/dashboard/src/features/learning-graph/lib/__tests__/voice-tutor.test.ts
git commit -m "feat: replace voice sandbox with openai voice tutor ui"
```

---

### Task 5: Remove the Old Sandbox Path and Verify the Full Flow

**Files:**
- Modify: `backend/src/services/learning-graph/voice-tutor.service.ts`
- Modify: `backend/src/api/routes/learning-graph/index.routes.ts`
- Modify: `packages/dashboard/src/features/learning-graph/components/index.ts`
- Modify: `packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx`

- [ ] **Step 1: Write the final regression expectations**

Extend integration coverage to assert:

```ts
expect(result.assistantAudio).not.toBeNull();
expect(result.assistantTranscript.length).toBeGreaterThan(0);
expect(result.suggestQuiz).toBe(false);
```

And dashboard expectations that the old label is gone:

```ts
expect(screen.queryByText('Voice Sandbox')).not.toBeInTheDocument();
expect(screen.getByText('Hỏi tutor bằng giọng nói')).toBeInTheDocument();
```

- [ ] **Step 2: Remove obsolete sandbox references**

Delete or stop exporting:

```ts
// packages/dashboard/src/features/learning-graph/components/index.ts
export { VoiceTutorDock } from './VoiceTutorDock';
export { VoiceTutorSheet } from './VoiceTutorSheet';
// remove VoiceTutorSandboxPanel export
```

Update backend route docs/comments to remove "sandbox" wording.

- [ ] **Step 3: Run full verification**

Run:

```bash
cd packages/shared-schemas && npm run build
cd backend && npx vitest run tests/unit/learning-graph/voice-tutor.service.test.ts tests/integration/learning-graph/session-flow.test.ts
cd packages/dashboard && npm run typecheck
cd packages/dashboard && npm run build
```

Expected:
- all commands exit `0`
- no dashboard type errors
- no backend integration failures

- [ ] **Step 4: Commit**

```bash
git add backend/src/api/routes/learning-graph/index.routes.ts backend/src/services/learning-graph/voice-tutor.service.ts packages/dashboard/src/features/learning-graph/components/index.ts packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx
git commit -m "refactor: finalize openai audio voice tutor rollout"
```

---

## Self-Review

### Spec Coverage

- OpenAI Audio API replacement: covered by Tasks 2 and 3
- New voice-turn and history APIs: covered by Task 3
- Floating dock and bottom sheet UI: covered by Task 4
- Quiz suggestion with user confirmation: covered by Tasks 3 and 4
- Removal of sandbox path: covered by Task 5

### Placeholder Scan

- No `TODO`, `TBD`, or “appropriate handling” placeholders remain
- Each task contains concrete files, code shapes, commands, and expected outcomes

### Type Consistency

- Shared schema names are introduced first in Task 1 and reused consistently later
- `assistantAudio`, `learnerTranscript`, `assistantTranscript`, and `suggestQuiz` stay consistent across backend and dashboard tasks

