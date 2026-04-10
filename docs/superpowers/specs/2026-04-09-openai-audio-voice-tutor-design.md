# OpenAI Audio Voice Tutor Design

## Summary

This spec replaces the current browser-speech-and-Ollama voice sandbox with an OpenAI Audio API based voice tutor for learning graph concept pages.

The new voice tutor is not a standalone experiment surface. It becomes the primary voice interaction layer for concept learning:

- lesson package remains the source of truth
- voice tutor is a guided interactive layer on top of the lesson package
- transcript is always visible and streams live
- audio playback begins as soon as the first response chunk is ready
- quiz can be suggested by the tutor, but only opens after explicit user confirmation

## Goals

- Replace browser-dependent speech recognition and browser TTS with OpenAI-powered STT and TTS
- Keep the lesson-first learning model intact
- Deliver a usable Vietnamese voice workflow without depending on local OS/browser Vietnamese voices
- Preserve concept scoping so the tutor stays grounded in the current lesson package and prerequisite context
- Provide a UI that feels like a real tutor layer, not a debug sandbox

## Non-Goals

- No always-on call-like experience in this phase
- No full Realtime API migration in this phase
- No removal of lesson package, quiz, or mastery loop behavior
- No fully freeform tutoring across the whole learning graph session
- No replacement of the concept page with a voice-first page

## Product Model

Each concept page keeps the current structure:

- lesson package as the default learning surface
- voice tutor as an auxiliary but prominent interaction layer
- quiz as an explicit next step after lesson and optional voice discussion

The voice tutor is a floating dock that opens into a bottom sheet.

The user flow is:

1. Read the lesson package
2. Open the voice tutor if clarification is needed
3. Speak one turn
4. See learner transcript
5. Receive streamed tutor transcript
6. Hear streamed tutor audio as soon as the first chunk is ready
7. Continue conversation or confirm readiness for quiz

## Interaction Design

### Tutor Persona

The tutor speaks like a strong classmate:

- friendly
- direct
- simple
- supportive but not patronizing
- grounded in examples before technical wording

The tutor must stay within:

- current concept
- current lesson package version
- prerequisite concepts directly relevant to the current concept

If the user goes out of scope, the tutor should redirect back to the current concept.

### Turn Model

The interaction model is turn-based:

- user taps `Bắt đầu nói`
- app records one turn
- user stops or the turn ends through the UI flow
- backend processes the turn
- assistant transcript streams
- assistant audio begins playback as soon as the first chunk is available

This phase does not use always-on microphone mode.

### Transcript Model

Transcript is always visible.

The UI uses a hybrid display:

- a live transcript area for the current assistant turn
- a conversation history for previous turns

When the assistant finishes:

- the streamed assistant turn is committed into history
- the next turn starts cleanly

### Quiz Suggestion Model

The assistant may suggest opening the quiz when the learner appears ready.

But the quiz only opens when the user explicitly confirms through UI action.

The assistant must never auto-open the quiz.

## UI Design

### Placement

The current `Voice Sandbox` block is removed.

It is replaced by:

- a floating dock at the bottom of the concept page
- a bottom sheet when opened

This preserves the lesson-first page while keeping voice always available.

### Bottom Sheet Content

The voice tutor sheet contains:

- tutor status badge
- current lesson context label
- live assistant transcript area
- conversation history
- learner transcript card
- `Bắt đầu nói` / `Dừng` controls
- mute or replay controls for assistant audio
- fallback text input for accessibility and failure cases
- quiz suggestion prompt when applicable

### States

The tutor sheet must render these states clearly:

- ready
- recording
- processing
- speaking
- error

Examples of clear user-facing labels:

- `Đang nghe`
- `Đang xử lý`
- `Tutor đang trả lời`
- `Không thể xử lý audio`

## Backend Design

### New Voice Turn API

Introduce a dedicated endpoint:

- `POST /learning-sessions/:sessionId/concepts/:conceptId/voice-turns`

This endpoint accepts one learner turn and returns one assistant turn.

The request supports:

- audio input
- transcript fallback input
- lesson version reference

The response returns:

- learner transcript
- assistant transcript
- assistant audio payload metadata or stream metadata
- summary version
- quiz suggestion flag

### Voice History API

Introduce:

- `GET /learning-sessions/:sessionId/concepts/:conceptId/voice-history`

This restores conversation history after reloads or re-entry.

### Grounding Rules

For each turn, the backend prompt context must include:

- concept name
- lesson package version
- Feynman explanation
- technical translation
- relevant prerequisite names
- short prior conversation summary or structured history window

The backend must not let the tutor answer outside that scope.

## OpenAI Integration Design

### API Roles

Use OpenAI for both audio directions:

- speech-to-text for learner audio input
- text-to-speech for tutor audio output

The assistant reasoning/text generation remains OpenAI-backed as part of the same voice tutor stack.

This phase is designed around the OpenAI Audio API rather than Realtime API.

### Why Audio API First

Audio API is chosen over Realtime because:

- lower cost
- easier fit with the current request-response backend shape
- easier migration from the existing sandbox
- still good enough for turn-based tutoring

Realtime remains a future upgrade path, not a current dependency.

### Environment

The backend must read:

- `OPENAI_API_KEY`

This spec does not require additional audio-specific vendor keys.

## Persistence

Voice tutor data should be persisted by concept and lesson version.

At minimum, store:

- learner transcript
- assistant transcript
- summary version
- lesson version
- created timestamp

Audio binary persistence is optional in this phase.

If audio files are not persisted, they may be treated as ephemeral response artifacts while transcript remains the durable record.

## Migration Plan

### Phase 1

Keep the current lesson package and quiz flow intact.

Replace only the voice backend path:

- remove Ollama dependency from voice turns
- remove browser speech recognition and browser TTS dependency from the main voice experience

### Phase 2

Replace the existing sandbox UI with the floating dock and bottom sheet tutor UI.

### Phase 3

Deprecate the old sandbox route and any Ollama-specific voice path.

## Error Handling

The system must fail gracefully when:

- OpenAI key is missing
- STT fails
- TTS fails
- audio upload is malformed
- user microphone access fails on the frontend

Required behavior:

- show actionable errors
- keep transcript visible when possible
- allow text fallback if audio capture fails
- do not crash or block the lesson page

## Verification Targets

The implementation is successful when:

- the browser no longer depends on local Vietnamese voices for tutor speech
- a learner can speak one turn and receive assistant audio + streaming transcript
- the tutor remains scoped to the current concept and lesson version
- quiz suggestion appears but requires user confirmation
- concept page continues to function even if audio fails

## Open Questions Resolved

- Voice is not sandbox-only. It becomes the main voice tutor layer.
- Turn model is turn-based.
- Transcript is always visible and streams.
- Audio begins playback as soon as the first chunk is ready.
- Voice tutor lives in a floating dock and bottom sheet.
- Quiz may be suggested by the tutor but never auto-opened.
