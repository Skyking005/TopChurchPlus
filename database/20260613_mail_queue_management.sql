-- noqa: disable=all
BEGIN;

CREATE TABLE IF NOT EXISTS mail_quota_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remaining_quota integer NOT NULL,
  pending_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  sent_today_count integer NOT NULL DEFAULT 0,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (remaining_quota >= 0),
  CHECK (pending_count >= 0),
  CHECK (failed_count >= 0),
  CHECK (sent_today_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_mail_quota_snapshots_checked_at
  ON mail_quota_snapshots (checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_mail_queue_status_created
  ON mail_queue (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mail_queue_recipient_status
  ON mail_queue (recipient_email, status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON mail_quota_snapshots TO "Codex";

COMMIT;
