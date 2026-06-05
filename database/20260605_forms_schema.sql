BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS forms (
  form_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_code text UNIQUE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed', 'archived')),
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'public', 'members')),
  allow_multiple_responses boolean NOT NULL DEFAULT true,
  require_login boolean NOT NULL DEFAULT true,
  created_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  updated_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forms_status_updated
  ON forms (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_forms_created_by
  ON forms (created_by_staff_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS form_questions (
  question_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES forms(form_id) ON DELETE CASCADE,
  question_type text NOT NULL CHECK (question_type IN ('short_text', 'paragraph', 'single_choice', 'multiple_choice', 'dropdown', 'date', 'number')),
  title text NOT NULL,
  description text,
  is_required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_questions_form_sort
  ON form_questions (form_id, sort_order, question_id);

CREATE TABLE IF NOT EXISTS form_question_options (
  option_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES form_questions(question_id) ON DELETE CASCADE,
  option_label text NOT NULL,
  option_value text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_question_options_question_sort
  ON form_question_options (question_id, sort_order, option_id);

CREATE TABLE IF NOT EXISTS form_responses (
  response_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES forms(form_id) ON DELETE CASCADE,
  respondent_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  respondent_member_id integer REFERENCES pastoral_members(id) ON DELETE SET NULL,
  respondent_name text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_form_responses_form_time
  ON form_responses (form_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS form_response_answers (
  answer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES form_responses(response_id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES form_questions(question_id) ON DELETE CASCADE,
  answer_text text,
  answer_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_response_answers_response
  ON form_response_answers (response_id);

COMMIT;
