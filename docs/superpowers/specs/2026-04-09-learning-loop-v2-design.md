# Learning Loop V2 Design

Date: 2026-04-09
Status: Drafted for user review
Scope: Product learning loop redesign for concept lessons, adaptive quiz flow, mastery updates, path recomputation, and voice tutoring

## 1. Purpose

This spec refines the core learning experience of `AI Learning Graph Coach` after the workspace and routing layer were clarified.

The original MVP spec already defined the core loop:

`topic + raw text -> graph -> path -> learn -> quiz -> mastery update -> refreshed next step`

However, the current implementation still behaves too much like a graph debugger:

- concepts can appear as thin nodes without a real lesson surface
- explanation generation is exposed as a manual debug-like action
- quiz generation is still placeholder-based
- quiz grading is not anchored to a persisted quiz artifact
- mastery and path refresh are not yet trustworthy enough to drive the learning loop

This spec fixes that by redefining each concept as a complete learning unit instead of a bare graph node.

## 2. Relationship To Existing Specs

This document complements, and does not replace:

- [2026-04-08-ai-learning-graph-coach-design.md](/home/phan-duong-quoc-nhat/workspace/InsForge/docs/superpowers/specs/2026-04-08-ai-learning-graph-coach-design.md)
- [2026-04-08-learning-graph-workspace-design.md](/home/phan-duong-quoc-nhat/workspace/InsForge/docs/superpowers/specs/2026-04-08-learning-graph-workspace-design.md)

Role split:

- `AI Learning Graph Coach Design`
  - defines the product MVP, domain model, and service boundaries
- `Learning Graph Workspace Design`
  - defines multi-session dashboard UX and routing
- `Learning Loop V2 Design`
  - defines the concept-level teaching loop, adaptive assessment behavior, and voice tutoring layer

## 3. Product Decision Summary

Approved decisions:

- Every concept must have a default lesson package the first time it is opened.
- The lesson package is the primary learning surface, not an optional helper.
- The default lesson package is `Feynman-first, image-supported`.
- Every concept must include an everyday-life metaphor image.
- The lesson package must include:
  - Feynman explanation
  - metaphor image
  - image-reading explanation
  - translation back to technical language
- Lesson generation is `hybrid`:
  - source text when available
  - concept description
  - prerequisite context
  - current mastery
- Quiz should not appear immediately when the concept loads.
- Quiz is revealed only after the learner confirms readiness.
- Quiz is prepared in the background from the current lesson package.
- Quiz length is flexible by concept difficulty and importance, within a bounded min/max range.
- Mastery is visible to the learner as both:
  - percentage
  - simple label
- Mastery is updated from:
  - current quiz result
  - prior attempts
- Passing threshold for progression is `mastery_score >= 0.7`.
- After every quiz submission, the path is recomputed.
- If mastery is still below threshold, the current concept remains current even after recomputation.
- If the learner fails, the system should regenerate instruction by emphasizing prerequisite gaps instead of only repeating the same explanation.
- Voice tutoring is a guided layer on top of the lesson package, not a separate source of truth.
- Voice tutoring must stay within the scope of:
  - current concept
  - relevant prerequisites
  - current lesson version

## 4. Core Learning Unit

The root learning entity for the study flow is `session + concept + lesson version`.

This replaces the current informal assumption that a concept page can be rendered from concept metadata alone.

The concept page must become a complete learning unit with:

- a default lesson package
- optional re-explanation variants
- an associated quiz version
- visible mastery
- recap after passing
- adaptive remediation after failing

Important rule:

- the graph node is not itself the lesson
- the graph node is an anchor from which the lesson package is derived

## 5. Lesson Package

### 5.1 Definition

A `lesson package` is the default instructional artifact for one `session + concept + version`.

It is the source of truth for what the learner was taught before attempting a quiz.

### 5.2 Required Content

Every lesson package must include:

- `feynman_explanation`
  - simple explanation as if teaching a beginner with very low prior knowledge
- `metaphor_image`
  - an everyday-life illustration representing the concept
- `image_mapping`
  - structured mapping between visual elements, metaphor meaning, and technical meaning
- `image_reading_text`
  - learner-facing explanation of the image in plain Vietnamese
- `technical_translation`
  - concise bridge from the metaphor back to correct technical language

Optional adaptive additions:

- `prerequisite_mini_lessons`
- `reexplanation_variants`
- `recap_summary`

### 5.3 Lesson Generation Inputs

Lesson generation must use hybrid grounding:

- `source_text`
- session concept description
- prerequisite relationships
- current mastery
- current path position

Priority rule:

- use `source_text` to make examples and wording more grounded
- use concept description to preserve correct meaning
- use prerequisite and mastery context to adapt level and emphasis

### 5.4 Default Loading Behavior

When the learner opens a concept for the first time:

- if a current lesson package exists, load it
- otherwise generate a new current lesson package

The lesson package must be visible by default without the learner pressing a special explanation button.

Important UX rule:

- `generate explanation` is no longer treated as the first-step CTA for learning
- if explanation controls remain, they represent re-explanation actions such as:
  - explain more simply
  - give another everyday example
  - review prerequisite quickly

## 6. Visual Teaching Model

### 6.1 Image Policy

Every concept must have a metaphor image.

The default visual language is not abstract technical diagrams. It is everyday-life metaphor.

Examples:

- gradient descent as walking downhill to find the lowest point
- backpropagation as tracing mistakes backward through steps
- tensors as organized containers across dimensions

### 6.2 Mapping Representation

The system must store image understanding in hybrid form:

- structured machine-readable mapping for control and regeneration
- learner-facing prose for readability

Minimum structured mapping fields:

- `visualElement`
- `everydayMeaning`
- `technicalMeaning`
- `teachingPurpose`

### 6.3 Learner Rendering

The learner-facing `reading the image` section should be rendered as hybrid content:

- a short lead paragraph
- followed by clear breakdown of the main parts of the image

This keeps the image pedagogically useful instead of decorative.

## 7. Quiz Lifecycle

### 7.1 Reveal Rule

Quiz does not appear automatically when the concept page loads.

The learner studies the lesson package first.

Quiz becomes visible only after the learner confirms readiness through a CTA such as:

- `Tôi đã hiểu, cho tôi quiz`

### 7.2 Preparation Rule

Quiz should be prepared in the background while the learner studies the lesson package.

Expected behavior:

- if the prepared quiz is ready when the learner confirms, reveal it immediately
- otherwise show a short loading state

### 7.3 Quiz Grounding Rule

Quiz must be generated from the current lesson package version, not from a generic concept-name template.

It must reflect:

- the actual lesson content taught
- the selected metaphor and image mapping
- prerequisite emphasis currently in force
- the current technical translation

### 7.4 Question Style

Quiz question count is flexible by concept difficulty and importance.

Recommended MVP range:

- small concepts: `1-2`
- medium concepts: `3`
- heavy concepts: `4-5`

Assessment emphasis:

- roughly `70%` conceptual understanding
- roughly `30%` technical terminology and correct mapping back to formal meaning

### 7.5 Persistence Rule

The quiz for a learner attempt must be stored as a real artifact tied to:

- `session`
- `concept`
- `lesson_version`
- `quiz_version`

Submission must be graded against the stored quiz artifact actually shown to the learner.

Important rule:

- grading against a placeholder or synthetic in-memory quiz is not allowed in the intended design

## 8. Mastery Update

### 8.1 Source of Truth

Mastery in MVP is still derived from quiz performance, but not from the latest quiz alone.

Mastery must use:

- current quiz score
- prior attempt count
- prior mastery state

This avoids overreacting to a single lucky or unlucky submission.

### 8.2 Passing Threshold

Progression threshold:

- `mastery_score >= 0.7`

Behavior:

- if mastery is below threshold, the learner remains on the current concept
- if mastery reaches or exceeds threshold, the concept is eligible to be marked passed

### 8.3 Learner Visibility

Mastery must be visible to the learner using hybrid presentation:

- numeric percentage, for example `72%`
- simple human label, for example:
  - `Chưa vững`
  - `Đang tiến bộ`
  - `Đã đạt ngưỡng`

This makes advancement decisions understandable instead of opaque.

## 9. Path Recompute

### 9.1 Recompute Timing

The learning path must be recomputed after every quiz submission.

This matches the original MVP loop and keeps recommendation state synchronized with learner performance.

### 9.2 Constraint Rule

Recomputation does not automatically mean concept switching.

If current concept mastery is still below threshold:

- the path may reorder downstream priorities
- prerequisites may move closer in importance
- but the current concept remains current

If current concept mastery reaches threshold:

- the system may advance current concept selection
- the learner is shown a recap checkpoint before moving on

## 10. Remediation Flow

### 10.1 Failure Response

When the learner fails a quiz or remains under threshold:

- the system should not merely repeat the same content
- it should regenerate instruction with stronger emphasis on prerequisite gaps

### 10.2 Prerequisite Exposure

The product should use hybrid disclosure:

- explicitly name the weak prerequisite when useful
- explain it gently in supportive language

Example tone:

- `Để hiểu phần này dễ hơn, mình sẽ nhắc lại ngắn gọn ý chính của Đại số tuyến tính trước.`

### 10.3 Mini-Lesson Strategy

When prerequisite weakness matters, the system should insert a mini-lesson before the concept explanation rather than forcibly navigating the learner away.

Mini-lessons are flexible by severity:

- light gap: very short reminder
- medium gap: short mini-lesson with everyday example
- heavy gap: more substantial prerequisite bridge and a simpler main lesson

## 11. Passing Recap

When the learner reaches passing mastery for the concept:

- do not jump instantly to the next concept
- show a short recap checkpoint first

The recap must include:

- what the learner has now understood
- why the system considers the learner above threshold

This recap closes the loop before progression and reinforces learning confidence.

## 12. Voice Tutor Layer

### 12.1 Role

Voice tutoring is a guided interactive layer on top of the lesson package.

It is not a second lesson source and it is not allowed to drift outside the current instructional scope.

### 12.2 Scope Constraint

The voice tutor may talk about:

- the current concept
- relevant prerequisites
- the current lesson version

It must not improvise new curriculum outside the current learning unit.

### 12.3 Interaction Model

The voice tutor should be presented as a highlighted panel alongside the lesson package.

The initial learning screen remains:

- text lesson
- image
- structured explanatory content

The learner can then activate a voice learning mode.

### 12.4 Opening Behavior

The default voice opening should be a short Feynman-style explanation, not the full lesson.

After that, the learner may:

- ask follow-up questions by microphone
- listen to spoken replies
- confirm readiness for quiz by button or speech

### 12.5 Persona

The voice tutor persona should feel like:

- a smart, friendly classmate
- close and supportive
- technically competent but not formal or preachy

### 12.6 Memory Model

Memory should be hybrid:

- deep turn memory within the current concept
- compact summary memory for previously completed concepts in the same session

### 12.7 Quiz Transition Rule

The voice tutor may suggest moving to quiz, but the learner must confirm before the quiz is revealed.

Confirmation may happen through:

- explicit button press
- sufficiently confident speech confirmation

The UI should always keep a visible manual confirmation control.

## 13. Voice Prototype Rollout

Voice should be rolled out in two phases.

### 13.1 Phase 1: Sandbox

Build a dedicated voice sandbox panel first.

Requirements:

- use real session and concept data
- do not use hardcoded example concepts
- validate microphone permissions, speech recognition, latency, and response quality separately from the main concept page

### 13.2 Phase 2: Main Learning Surface

Only after the sandbox loop is stable should the voice panel be embedded into the main concept page flow.

This reduces the chance of mixing infrastructure issues with core pedagogy issues.

## 14. Data And Versioning Implications

The current domain model must be extended to reflect instructional truth, not just graph truth.

New or expanded entities are expected to include versioned records for:

- lesson packages
- metaphor image metadata
- image mapping
- quiz artifacts
- voice conversation summaries

Recommended lesson version fields:

- `version`
- `is_current`
- `regeneration_reason`
- `created_at`

Recommended regeneration reasons:

- `initial`
- `failed_quiz`
- `simpler_reexplain`
- `prerequisite_refresh`

Important consistency rule:

- if lesson meaning changes in an instructionally meaningful way, it becomes a new lesson version
- cosmetic phrasing changes do not require a new version

## 15. Out Of Scope For This Design

This spec does not yet define:

- exact storage format for image binaries
- final voice provider selection for production paid deployment
- classroom or teacher features
- multilingual behavior beyond Vietnamese
- full analytics or research dashboards

Those decisions may be layered on later without changing the core learning loop defined here.
