-- Migration 030: Create learning graph coach tables
-- Session-scoped graph, mastery, quiz, and path persistence for the learning coach MVP

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
