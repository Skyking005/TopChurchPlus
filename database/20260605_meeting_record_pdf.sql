CREATE INDEX IF NOT EXISTS idx_file_links_meeting_records
  ON file_links (entity_type, entity_id, file_type, created_at DESC)
  WHERE entity_type = 'meeting' AND file_type = 'meeting_record_pdf';
