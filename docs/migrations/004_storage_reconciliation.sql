-- 004_storage_reconciliation.sql
-- Adds columns that storage.ts expects but were missing from earlier migrations.
-- Run this in the Supabase SQL Editor.

-- ── Streaks: freeze_count for streak freeze logic ──
ALTER TABLE streaks
  ADD COLUMN IF NOT EXISTS freeze_count integer DEFAULT 2;

-- ── Library: session_id for linking entries to sessions ──
ALTER TABLE library
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES sessions(id);

-- ── Library: updated_at for edit/pin tracking ──
ALTER TABLE library
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ── Workout Progress: unlock tracking ──
ALTER TABLE workout_progress
  ADD COLUMN IF NOT EXISTS unlocked_at timestamptz DEFAULT now();

ALTER TABLE workout_progress
  ADD COLUMN IF NOT EXISTS difficulty_unlocked text DEFAULT 'foundational';
