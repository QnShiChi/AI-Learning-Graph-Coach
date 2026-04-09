-- Migration 031: Add learning lesson packages and voice summaries
-- Stores the current instructional package per session concept plus compact voice-memory summaries.

ALTER TABLE public.session_concepts
  ADD CONSTRAINT session_concepts_session_id_id_unique UNIQUE (session_id, id);

CREATE TABLE IF NOT EXISTS public.session_concept_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.learning_sessions(id) ON DELETE CASCADE,
  concept_id UUID NOT NULL,
  lesson_version INTEGER NOT NULL CHECK (lesson_version >= 1),
  lesson_payload JSONB NOT NULL,
  regeneration_reason TEXT NOT NULL CHECK (
    regeneration_reason IN ('initial', 'failed_quiz', 'simpler_reexplain', 'prerequisite_refresh')
  ),
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT session_concept_lessons_concept_session_fk
    FOREIGN KEY (session_id, concept_id)
    REFERENCES public.session_concepts(session_id, id)
    ON DELETE CASCADE,
  CONSTRAINT session_concept_lessons_version_unique UNIQUE (session_id, concept_id, lesson_version)
);

CREATE UNIQUE INDEX IF NOT EXISTS session_concept_lessons_one_current_idx
  ON public.session_concept_lessons (session_id, concept_id)
  WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS session_concept_lessons_session_idx
  ON public.session_concept_lessons (session_id, concept_id, is_current, lesson_version DESC);

CREATE TABLE IF NOT EXISTS public.session_concept_voice_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.learning_sessions(id) ON DELETE CASCADE,
  concept_id UUID NOT NULL,
  lesson_version INTEGER NOT NULL CHECK (lesson_version >= 1),
  summary_version INTEGER NOT NULL CHECK (summary_version >= 1),
  summary_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT session_concept_voice_summaries_concept_session_fk
    FOREIGN KEY (session_id, concept_id)
    REFERENCES public.session_concepts(session_id, id)
    ON DELETE CASCADE,
  CONSTRAINT session_concept_voice_summaries_lesson_fk
    FOREIGN KEY (session_id, concept_id, lesson_version)
    REFERENCES public.session_concept_lessons(session_id, concept_id, lesson_version)
    ON DELETE CASCADE,
  CONSTRAINT session_concept_voice_summaries_unique UNIQUE (
    session_id,
    concept_id,
    lesson_version,
    summary_version
  )
);
