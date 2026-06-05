BEGIN;

ALTER TABLE form_questions
  DROP CONSTRAINT IF EXISTS form_questions_question_type_check;

ALTER TABLE form_questions
  ADD CONSTRAINT form_questions_question_type_check
  CHECK (question_type IN (
    'short_text',
    'paragraph',
    'single_choice',
    'multiple_choice',
    'dropdown',
    'date',
    'number',
    'image_upload'
  ));

CREATE TABLE IF NOT EXISTS form_response_attachments (
  attachment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES form_responses(response_id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES form_questions(question_id) ON DELETE CASCADE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size integer NOT NULL,
  file_data bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_response_attachments_response
  ON form_response_attachments (response_id);

CREATE INDEX IF NOT EXISTS idx_form_response_attachments_question
  ON form_response_attachments (question_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON form_response_attachments TO "Codex";

COMMIT;
