CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS work_logs (
  work_log_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id text NOT NULL REFERENCES accounts(staff_id) ON DELETE CASCADE,
  log_date date NOT NULL,
  work_item text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_logs_staff_date
  ON work_logs (staff_id, log_date DESC, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON work_logs TO "Codex";
