BEGIN;

CREATE TABLE IF NOT EXISTS mail_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL,
  business_id text,
  event_type text,
  dedupe_key text,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  html_body text,
  status text NOT NULL DEFAULT 'PENDING',
  priority text NOT NULL DEFAULT 'NORMAL',
  retry_count integer NOT NULL DEFAULT 0,
  error_message text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED')),
  CHECK (priority IN ('HIGH', 'NORMAL', 'LOW')),
  CHECK (retry_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mail_queue_dedupe_active
  ON mail_queue(dedupe_key)
  WHERE dedupe_key IS NOT NULL
    AND status IN ('PENDING', 'SENT');

CREATE INDEX IF NOT EXISTS idx_mail_queue_pending
  ON mail_queue(status, priority, scheduled_at, created_at);

CREATE INDEX IF NOT EXISTS idx_mail_queue_module_status
  ON mail_queue(module_key, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mail_queue_recipient
  ON mail_queue(recipient_email, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON mail_queue TO "Codex";

COMMIT;
