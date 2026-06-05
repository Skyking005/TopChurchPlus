BEGIN;

CREATE TABLE IF NOT EXISTS account_pastoral_church_permissions (
  staff_id text NOT NULL REFERENCES accounts(staff_id) ON DELETE CASCADE,
  church_id integer NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, church_id)
);

CREATE INDEX IF NOT EXISTS idx_account_pastoral_church_permissions_church
  ON account_pastoral_church_permissions (church_id);

CREATE TABLE IF NOT EXISTS system_usage_logs (
  id bigserial PRIMARY KEY,
  staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  feature_key text NOT NULL,
  action text NOT NULL DEFAULT 'open',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_usage_logs_staff_feature_time
  ON system_usage_logs (staff_id, feature_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_usage_logs_created_at
  ON system_usage_logs (created_at DESC);

COMMIT;
