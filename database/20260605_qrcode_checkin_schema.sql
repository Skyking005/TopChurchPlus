CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS qrcode_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code text NOT NULL UNIQUE,
  event_name text NOT NULL,
  church_id integer REFERENCES churches(id) ON DELETE SET NULL,
  event_date date,
  checkin_starts_at timestamptz,
  checkin_ends_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  note text,
  created_by_staff_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qrcode_checkins (
  checkin_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES qrcode_events(event_id) ON DELETE CASCADE,
  member_id integer NOT NULL REFERENCES pastoral_members(id) ON DELETE CASCADE,
  qr_payload text,
  checkin_source text NOT NULL DEFAULT 'counter_camera',
  checked_in_by_staff_id text,
  checked_in_by_name text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  note text,
  UNIQUE (event_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_qrcode_events_status_date
  ON qrcode_events (status, event_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qrcode_events_church
  ON qrcode_events (church_id, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_qrcode_checkins_event_time
  ON qrcode_checkins (event_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_qrcode_checkins_member
  ON qrcode_checkins (member_id, checked_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON qrcode_events TO "Codex";
GRANT SELECT, INSERT, UPDATE, DELETE ON qrcode_checkins TO "Codex";

INSERT INTO role_feature_permissions (role, feature_key, access_level)
VALUES
  (U&'\8D85\7D1A\7BA1\7406\8005', 'qrcode', 'edit'),
  (U&'\7BA1\7406\54E1', 'qrcode', 'edit'),
  (U&'\5168\8077\540C\5DE5', 'qrcode', 'edit')
ON CONFLICT (role, feature_key) DO UPDATE
SET access_level = EXCLUDED.access_level,
    updated_at = now();
