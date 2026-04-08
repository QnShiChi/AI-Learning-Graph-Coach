# AI Learning Graph Coach Design

Date: 2026-04-08
Status: Approved for implementation planning

## 1. Overview

This spec defines the MVP for `AI Learning Graph Coach` as a single-user learning product built on InsForge. The system accepts a required learning topic plus optional pasted learning material, normalizes the input into raw text, generates a validated knowledge graph, produces a linear personalized learning path, serves Vietnamese explanations and quizzes for each concept, updates mastery from quiz results, and refreshes the recommended path after every submission.

The MVP is intentionally scoped to prove the core value loop:

`topic + raw text -> graph -> path -> learn -> quiz -> mastery update -> refreshed next step`

This is a product MVP, not yet a classroom or research analytics platform.

## 2. Product Goals

The MVP must support:

- A single learner signed in with real InsForge authentication
- Creating a learning session from `topic` and optional pasted text
- Building a knowledge graph with `LLM + rule-based validation`
- Rendering a linear recommended sequence for learning
- Showing concept explanations in Vietnamese
- Generating a short quiz after each concept
- Updating mastery from quiz results only
- Refreshing the path synchronously after quiz submission
- Rendering a graph view for visualization and prerequisite explanation

The MVP explicitly does not include:

- Teacher or classroom dashboards
- PDF upload/parsing
- Embeddings or retrieval in the first version
- Behavioral or self-reported mastery signals
- Multi-language UI
- Realtime collaboration
- Advanced analytics dashboards
- Complex branching navigation beyond the linear recommended path

## 3. Architecture

The backend follows a `pipeline-centered` design. Edge functions or API handlers stay thin and act as authenticated entrypoints. Business logic lives in focused services and orchestrators.

High-level flow:

`Frontend React UI`
-> `API entrypoints / edge functions`
-> `learning-orchestrator`
-> focused services
-> PostgreSQL + InsForge AI/Auth

Core backend components:

### 3.1 Input Pipeline

- Input: `topic` required, `source_text` optional
- Responsibility: normalize all input into a single `raw_text package`
- Future extension point: PDF parsing can later feed this same package without changing downstream logic

### 3.2 Graph Pipeline

Split into two stages:

- `graph-generation-service`
  - Uses LLM to extract concepts, concept descriptions, initial difficulty, and prerequisite edges
- `graph-validation-service`
  - Normalizes concept names
  - Deduplicates concepts
  - Removes self-loops
  - Removes duplicate or overly dense edges
  - Normalizes difficulty values
  - Enforces node/edge limits for MVP

### 3.3 Learning Path Engine

- Input: validated graph + current session mastery
- Output: linear recommended sequence with path states
- Responsibility: all recommendation logic stays here; frontend only renders the returned path

### 3.4 Tutor Service

- Generates Vietnamese explanations for the current concept
- Can incorporate prerequisite gaps and current mastery context

### 3.5 Quiz Service

- Generates Vietnamese multiple-choice quizzes for the current concept
- Grades submissions
- Returns structured quiz results for mastery updates

### 3.6 Mastery Service

- Updates mastery from quiz results only in the MVP
- Designed so self-report and behavioral signals can be added later without changing API contracts

### 3.7 Session Service

- Creates sessions
- Loads resume state
- Updates current concept and session status

### 3.8 Learning Orchestrator

- Coordinates multi-step flows such as session creation and quiz submission
- Keeps controllers thin and avoids distributing orchestration logic across unrelated modules

## 4. Language Requirement

All user-facing content in the MVP must be in Vietnamese.

This includes:

- UI labels and buttons
- Empty states and error messages
- Loading text
- Concept explanations
- Quiz questions and answer options
- Quiz feedback and score summaries
- Path and graph annotations that are shown to the learner

Internal API fields, database schema, and code identifiers may remain in English.

## 5. Core Domain Model

The root entity is `learning_session`, not just `user`.

Reason:

- One user may later have multiple independent learning goals
- Session-centric modeling keeps graph, path, quiz, and mastery state grouped cleanly
- Resume behavior becomes straightforward

### 5.1 learning_sessions

Represents one learning journey for one user and one goal.

Suggested fields:

- `id`
- `user_id`
- `goal_title`
- `source_topic`
- `source_text`
- `status`
- `current_concept_id`
- `created_at`
- `updated_at`

Official session status enum for MVP:

- `initializing`
- `ready`
- `completed`
- `failed`

Notes:

- `awaiting_quiz` is intentionally not part of session-level status
- Quiz readiness belongs to quiz/concept state, not to the whole session

### 5.2 session_concepts

Stores validated concepts for one session.

Suggested fields:

- `id`
- `session_id`
- `canonical_name`
- `display_name`
- `description`
- `difficulty`
- `created_at`
- `updated_at`

Optional derived status field:

- `locked`
- `available`
- `current`
- `mastered`

Important rule:

- `session_concepts.status` is not the primary source of truth for the path UI
- It is a derived/read-model-friendly field and may be omitted if it creates duplication during implementation

### 5.3 session_edges

Stores prerequisite edges within a session.

Suggested fields:

- `id`
- `session_id`
- `from_concept_id`
- `to_concept_id`
- `edge_type`
- `weight`
- `source`
- `created_at`

### 5.4 session_concept_mastery

Stores mastery state for each concept in a session.

This is the official renamed entity replacing `user_concept_mastery`.

Suggested fields:

- `session_id`
- `concept_id`
- `mastery_score`
- `last_quiz_score`
- `attempt_count`
- `updated_at`

### 5.5 session_path_items

Stores the current and historical path snapshots for a session.

Suggested fields:

- `id`
- `session_id`
- `concept_id`
- `path_version`
- `position`
- `path_state`
- `is_current`
- `superseded_at`
- `created_at`

Official path state enum:

- `completed`
- `current`
- `next`
- `upcoming`
- `locked`

Important rule:

- `session_path_items.path_state` is the source of truth for learning path UI state
- The dashboard and main learning flow must render from the current path snapshot

Versioning rule:

- Every path recomputation creates a new `path_version`
- Previous snapshot rows are marked non-current using `is_current = false` or `superseded_at`
- The MVP keeps minimal path history for debugging and research without requiring full event sourcing

### 5.6 session_concept_quizzes

This is the official name for the active quiz entity.

It stores generated quizzes for a specific `session + concept`.

Suggested fields:

- `id`
- `session_id`
- `concept_id`
- `quiz_payload`
- `status`
- `created_at`
- `submitted_at`
- `expired_at`

Official status enum:

- `active`
- `submitted`
- `expired`

Core rules:

- For a given `session_id + concept_id`, at most one quiz may be `active` at a time
- The active quiz is stored server-side and reused if it already exists and is still valid
- The frontend must not be the source of truth for the active quiz

### 5.7 quiz_attempts

Stores submission history and grading outcomes.

Suggested fields:

- `id`
- `quiz_id`
- `session_id`
- `concept_id`
- `user_answers`
- `score`
- `result_summary`
- `created_at`

Official relationship between `session_concept_quizzes` and `quiz_attempts` for MVP:

- One quiz has exactly one allowed attempt in the MVP
- Retry on the same quiz is not allowed in the MVP
- If the user wants a new quiz, the system regenerates one
- When regeneration happens, the old quiz transitions to `expired` and the new quiz becomes `active`
- A submitted quiz cannot become active again

This keeps mastery logic simple and makes each attempt correspond cleanly to one generated quiz.

## 6. Graph Pipeline Contract

The graph pipeline has a dedicated output contract independent from UI and persistence details.

Output shape:

- `session_goal`
- `concepts[]`
- `edges[]`
- `graph_summary`
- `validation_report`

### 6.1 concepts[]

Each concept should include:

- `temp_id`
- `canonical_name`
- `display_name`
- `description`
- `difficulty`

### 6.2 edges[]

Each edge should include:

- `from_temp_id`
- `to_temp_id`
- `type`
- `weight`

### 6.3 graph_summary

Should include:

- `node_count`
- `edge_count`
- `source_input_length`
- `generation_version`

### 6.4 validation_report

Should include at least:

- `deduped_concepts`
- `removed_self_loops`
- `removed_duplicate_edges`
- `trimmed_edges`

Why this contract matters:

- `graph-generation-service` can evolve independently
- `graph-validation-service` can later add embeddings or similarity-based merging
- `path-engine` can remain stable as long as the contract stays stable

## 7. Learning Lifecycle

Main lifecycle for the MVP:

### 7.1 Start Session

- User signs in
- User enters topic and optional pasted text
- Backend creates `learning_session`
- Input is normalized into raw text

### 7.2 Build Graph

- Graph generation produces draft concepts and edges
- Graph validation cleans and constrains the graph
- Concepts and edges are persisted into session-scoped tables

### 7.3 Generate Initial Path

- Path engine reads validated graph and initial mastery state
- Backend writes `session_path_items` as `path_version = 1`
- Backend sets `learning_sessions.current_concept_id`
- Session moves to `ready`

### 7.4 Learn Current Concept

- Frontend loads current concept metadata
- Tutor service generates a Vietnamese explanation

### 7.5 Generate Or Reuse Active Quiz

- Frontend requests quiz for the current concept
- Backend checks `session_concept_quizzes`
- If an `active` quiz exists for that `session + concept`, return it
- Otherwise create a new active quiz and persist it

### 7.6 Submit Quiz

- User submits answers
- Backend grades the quiz
- Backend records the attempt
- Backend updates mastery
- Backend recomputes the path
- Backend writes a new path snapshot
- Backend updates current concept
- Frontend receives refreshed state immediately

## 8. API Surface

Minimal MVP API surface:

### 8.1 POST /learning-sessions

Creates a session from `topic` and optional `source_text`.

Backend flow:

- Input normalization
- Graph generation
- Graph validation
- Initial path generation

Response should include:

- `session`
- `graph_summary`
- `path_snapshot`
- `current_concept`

### 8.2 GET /learning-sessions/:sessionId

Returns resume state:

- session metadata
- current path snapshot
- progress summary
- current concept

### 8.3 GET /learning-sessions/:sessionId/concepts/:conceptId

Returns concept view data:

- concept metadata
- prerequisite context
- current mastery state

### 8.4 POST /learning-sessions/:sessionId/concepts/:conceptId/explanation

Generates or regenerates concept explanation.

Notes:

- This is intentionally separated from the concept detail endpoint
- Avoids spending AI calls on every page load

### 8.5 POST /learning-sessions/:sessionId/concepts/:conceptId/quiz

Returns the active quiz if one already exists, otherwise generates a new one.

### 8.6 POST /learning-sessions/:sessionId/concepts/:conceptId/quiz-submissions

This is the main orchestration endpoint for the learning loop.

Responsibilities:

- Validate payload
- Load active quiz
- Grade submission
- Persist attempt
- Update mastery
- Recompute path
- Persist new path snapshot
- Update session current concept
- Return refreshed state

### 8.7 GET /learning-sessions/:sessionId/graph

Returns validated graph data for Graph View.

This endpoint is for visualization, not primary navigation.

## 9. Transaction Boundary For Quiz Submission

`POST /quiz-submissions` has the strictest consistency requirement in the MVP.

Expected flow:

1. Validate session, concept, active quiz, and submission payload
2. Grade submission
3. Open transaction
4. Persist `quiz_attempt`
5. Update `session_concept_mastery`
6. Mark active quiz as `submitted`
7. Recompute path
8. Write new `session_path_items` snapshot with incremented `path_version`
9. Update `learning_sessions.current_concept_id`
10. Update `learning_sessions.status` if session becomes `completed`
11. Commit transaction
12. Return refreshed response payload

Transaction rules:

- Steps `4` through `10` should be in one database transaction
- Grading should happen before the transaction if grading does not require additional remote model calls
- The system must not leave a state where an attempt is saved but the path snapshot is stale
- If any write inside the transaction fails, rollback the whole transaction

## 10. Frontend Experience

The MVP has four main screens.

### 10.1 Session Creation Screen

Purpose:

- Start a new learning session

UI:

- Topic input
- Optional pasted text input
- Primary CTA in Vietnamese
- Loading state while graph and path are being built
- Vietnamese error state with retry path

### 10.2 Session Overview Screen

Purpose:

- Primary navigation surface

UI:

- Goal summary
- Progress summary
- Linear learning path
- Current concept
- Next concept
- Completed and locked items

Important rule:

- This is the primary navigation layer of the app

### 10.3 Concept Learning Screen

Purpose:

- Learn one concept at a time

UI:

- Concept name
- Vietnamese explanation
- Short prerequisite context
- Current mastery
- Action to generate or open quiz

### 10.4 Graph View Screen

Purpose:

- Visualize graph and explain prerequisite relationships

UI:

- Validated graph
- Highlighted current concept
- Highlighted recommended path context

Important rule:

- Graph view is explanatory, not the main navigation model

## 11. Auth Strategy

The MVP uses real InsForge authentication.

Rationale:

- `learning_session` ownership already depends on `user_id`
- Resume behavior becomes real from the first version
- Later expansion beyond one active learner does not require reworking data ownership or auth boundaries

Product scope remains single-user despite using real authentication.

## 12. Failure Strategy

### 12.1 Session Creation Failures

- If graph generation fails, session ends in `failed`
- If graph validation fails, session ends in `failed`
- The system should not persist a partial graph as the accepted session state

### 12.2 Explanation Or Quiz Generation Failures

- These failures must not corrupt the session
- UI may show a Vietnamese error and allow regeneration

### 12.3 Quiz Submission Failures

- This flow must be atomic
- Either all core writes commit together or all changes rollback

## 13. Testing Strategy

### 13.1 Must-Have Tests For MVP

Unit tests:

- Graph validation rules
- Path engine ordering and scoring
- Mastery update calculation

Integration tests:

- Create session from `topic + source_text`
- Submit quiz -> update mastery -> increment path version -> update current concept correctly

End-to-end test:

- One learner completes the main product loop from session creation through refreshed path

### 13.2 Nice-To-Have Tests

- Detailed contract tests for every payload shape
- Extra edge-case UI error tests
- Deeper snapshot-history verification beyond core path version changes
- Repeated regenerate explanation/quiz scenarios

If test scope must be reduced, the two orchestration integration tests must still be kept.

## 14. Implementation Notes

Items to preserve in implementation planning:

- Keep session status minimal; do not reintroduce `awaiting_quiz` at session level unless a strong reason appears during implementation
- Treat `session_path_items.path_state` as the path UI source of truth
- Treat `session_concept_quizzes` as the backend-owned active quiz model
- Enforce one attempt per quiz in MVP
- Expire old active quiz on regeneration and create a fresh active quiz
- Keep all learner-facing content in Vietnamese
- Preserve clean boundaries between API handlers, orchestrator, and services

## 15. Summary

This MVP is a focused single-user learning system with:

- real auth
- topic plus optional raw text input
- LLM-generated and rule-validated knowledge graph
- session-centric state
- Vietnamese-first learner experience
- linear adaptive path
- quiz-only mastery updates
- atomic path refresh after submission

The design is intentionally narrow enough for a vertical slice while leaving clean extension points for PDF parsing, embeddings, classroom features, and richer mastery signals later.
