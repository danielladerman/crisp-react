-- 003_rebuild_schema.sql
-- CRISP App Rebuild: Simplified session flow with chat-log interactions table
-- Run this in the Supabase SQL Editor AFTER clearing all user data.

-- ─────────────────────────────────────────────
-- 1. Drop tables we no longer need
-- ─────────────────────────────────────────────
DROP TABLE IF EXISTS weakness_srs CASCADE;
DROP TABLE IF EXISTS notification_log CASCADE;
-- Note: prep_sessions kept (prep sessions now use main sessions + interactions tables,
-- but we preserve the table in case of existing data references)

-- ─────────────────────────────────────────────
-- 2. Rebuild sessions table
-- ─────────────────────────────────────────────
-- Drop old columns that moved to interactions table
ALTER TABLE sessions
  DROP COLUMN IF EXISTS response_text,
  DROP COLUMN IF EXISTS feedback_echo,
  DROP COLUMN IF EXISTS feedback_name,
  DROP COLUMN IF EXISTS feedback_open,
  DROP COLUMN IF EXISTS feedback_drill,
  DROP COLUMN IF EXISTS marked_moment,
  DROP COLUMN IF EXISTS mark_explanation,
  DROP COLUMN IF EXISTS framework_used,
  DROP COLUMN IF EXISTS duration_seconds,
  DROP COLUMN IF EXISTS drill_response,
  DROP COLUMN IF EXISTS drill_skipped,
  DROP COLUMN IF EXISTS deep_dive_exchanges,
  DROP COLUMN IF EXISTS weakness_targeted,
  DROP COLUMN IF EXISTS quality_signal,
  DROP COLUMN IF EXISTS secondary_capture,
  DROP COLUMN IF EXISTS session_number,
  DROP COLUMN IF EXISTS session_mode,
  DROP COLUMN IF EXISTS completed;

-- Add new columns
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS response_mode text DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS suggested_drills jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add constraints
ALTER TABLE sessions
  ADD CONSTRAINT sessions_status_check CHECK (status IN ('active', 'completed'));

-- ─────────────────────────────────────────────
-- 3. Create interactions table (chat log)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interactions (
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

CREATE INDEX IF NOT EXISTS idx_interactions_session ON interactions(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_interactions_user ON interactions(user_id, created_at DESC);

ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY interactions_select ON interactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY interactions_insert ON interactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 4. Create patterns table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patterns (
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

CREATE INDEX IF NOT EXISTS idx_patterns_user ON patterns(user_id, status);

ALTER TABLE patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY patterns_select ON patterns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY patterns_insert ON patterns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY patterns_update ON patterns FOR UPDATE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 5. Update sessions index
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sessions_user_status ON sessions(user_id, status, created_at DESC);
