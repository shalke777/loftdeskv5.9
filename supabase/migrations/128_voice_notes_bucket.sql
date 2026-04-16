-- Migration 128: voice-notes Storage bucket + RLS policies
-- Private bucket for audio recordings from FloatingVoiceButton.
-- Files stored at: {company_id}/{timestamp}-{uuid}.{ext}
-- audio_url in voice_notes table stores the storage PATH (not signed URL).
-- Signed URLs are generated on-demand at display time (1 year TTL).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-notes',
  'voice-notes',
  false,
  52428800,  -- 50 MB per file
  ARRAY['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/x-m4a']
)
ON CONFLICT (id) DO NOTHING;

-- Folder = company_id, so each company can only access their own audio
DROP POLICY IF EXISTS "voice_notes_audio_insert" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_audio_select" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_audio_delete" ON storage.objects;

CREATE POLICY "voice_notes_audio_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = (my_company_id())::text
  );

CREATE POLICY "voice_notes_audio_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = (my_company_id())::text
  );

CREATE POLICY "voice_notes_audio_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = (my_company_id())::text
  );
