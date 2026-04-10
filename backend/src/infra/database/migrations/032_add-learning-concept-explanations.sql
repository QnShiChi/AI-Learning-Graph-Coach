-- Migration 032: Persist regenerated concept explanations for fast reopen
-- Stores one cleaned explanation per session concept so "giải thích lại" can reuse it.

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

CREATE INDEX IF NOT EXISTS session_concept_explanations_session_idx
  ON public.session_concept_explanations (session_id, concept_id);
