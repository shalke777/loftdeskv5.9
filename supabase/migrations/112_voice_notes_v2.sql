-- Migration 112: voice_notes v2 — add duration_seconds, char_count, transcript_storage_url
ALTER TABLE voice_notes
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS char_count integer GENERATED ALWAYS AS (char_length(transcript)) STORED,
  ADD COLUMN IF NOT EXISTS transcript_storage_url text;
