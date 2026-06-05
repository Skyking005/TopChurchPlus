ALTER TABLE pastoral_member_files
  ADD COLUMN IF NOT EXISTS file_data bytea,
  ADD COLUMN IF NOT EXISTS file_size integer;

CREATE INDEX IF NOT EXISTS idx_pastoral_member_files_member_type
  ON pastoral_member_files (member_id, file_type, uploaded_at DESC);
