-- 001_fresh_schema.sql
-- CRISP App: Full schema for a fresh Supabase project
-- Run this in the Supabase SQL Editor after creating your project.

-- ─────────────────────────────────────────────
-- 1. Sessions
-- ─────────────────────────────────────────────
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  prompt_type text NOT NULL,
  prompt_text text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  response_mode text DEFAULT 'text',
  suggested_drills jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_sessions_user_status ON sessions(user_id, status, created_at DESC);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessions_select ON sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY sessions_insert ON sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY sessions_update ON sessions FOR UPDATE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 2. Interactions (chat log)
-- ─────────────────────────────────────────────
CREATE TABLE interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  interaction_type text NOT NULL CHECK (interaction_type IN (
    'response', 'dive_deeper', 'feedback', 'follow_up', 'fix_attempt'
  )),
  audio_url text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_interactions_session ON interactions(session_id, created_at);
CREATE INDEX idx_interactions_user ON interactions(user_id, created_at DESC);

ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY interactions_select ON interactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY interactions_insert ON interactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 3. Patterns (AI-detected strengths & weaknesses)
-- ─────────────────────────────────────────────
CREATE TABLE patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  pattern_type text NOT NULL CHECK (pattern_type IN ('strength', 'weakness')),
  pattern_id text NOT NULL,
  description text NOT NULL,
  evidence jsonb DEFAULT '[]'::jsonb,
  first_detected_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  status text DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  UNIQUE(user_id, pattern_id)
);

CREATE INDEX idx_patterns_user ON patterns(user_id, status);

ALTER TABLE patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY patterns_select ON patterns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY patterns_insert ON patterns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY patterns_update ON patterns FOR UPDATE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 4. Voice Models
-- ─────────────────────────────────────────────
CREATE TABLE voice_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) UNIQUE,
  model_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  session_count integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE voice_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY voice_models_select ON voice_models FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY voice_models_insert ON voice_models FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY voice_models_update ON voice_models FOR UPDATE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 5. Library (saved moments / quotes)
-- ─────────────────────────────────────────────
CREATE TABLE library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  marked_text text NOT NULL,
  prompt_text text DEFAULT '',
  ai_observation text DEFAULT '',
  prompt_type text DEFAULT '',
  pinned boolean DEFAULT false,
  source text DEFAULT 'session',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_library_user ON library(user_id, created_at DESC);
CREATE INDEX idx_library_pinned ON library(user_id, pinned) WHERE pinned = true;

ALTER TABLE library ENABLE ROW LEVEL SECURITY;
CREATE POLICY library_select ON library FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY library_insert ON library FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY library_update ON library FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY library_delete ON library FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 6. Streaks
-- ─────────────────────────────────────────────
CREATE TABLE streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) UNIQUE,
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  last_practice_date date,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY streaks_select ON streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY streaks_insert ON streaks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY streaks_update ON streaks FOR UPDATE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 7. Workout Sessions (drill completions)
-- ─────────────────────────────────────────────
CREATE TABLE workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  drill_id text NOT NULL,
  drill_name text NOT NULL,
  category text NOT NULL,
  difficulty text NOT NULL,
  duration_seconds integer,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_workout_sessions_user ON workout_sessions(user_id, created_at DESC);

ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY workout_sessions_select ON workout_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY workout_sessions_insert ON workout_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 8. Workout Progress (per-drill tracking)
-- ─────────────────────────────────────────────
CREATE TABLE workout_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  drill_id text NOT NULL,
  times_completed integer DEFAULT 1,
  last_completed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, drill_id)
);

ALTER TABLE workout_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY workout_progress_select ON workout_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY workout_progress_insert ON workout_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY workout_progress_update ON workout_progress FOR UPDATE USING (auth.uid() = user_id);
