-- Migration: Library enhancements for Sentence Bank controls
-- Run this in Supabase SQL Editor

ALTER TABLE library
  ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'session'
    CHECK (source IN ('session', 'manual'));

-- Index for pinned filter queries
CREATE INDEX IF NOT EXISTS idx_library_pinned ON library (user_id, pinned) WHERE pinned = true;
