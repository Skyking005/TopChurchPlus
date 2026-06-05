ALTER TABLE pastoral_member_files
  ADD COLUMN IF NOT EXISTS file_id uuid REFERENCES files(file_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pastoral_member_files_file_id
  ON pastoral_member_files (file_id);

CREATE INDEX IF NOT EXISTS idx_file_links_member_files
  ON file_links (entity_type, entity_id, file_type, created_at DESC)
  WHERE entity_type = 'pastoral_member';
