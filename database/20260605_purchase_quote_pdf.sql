ALTER TABLE files
  ADD COLUMN IF NOT EXISTS file_data bytea;

CREATE INDEX IF NOT EXISTS idx_file_links_purchase_quotes
  ON file_links (entity_type, entity_id, file_type, created_at DESC)
  WHERE entity_type = 'purchase' AND file_type = 'quote_pdf';
