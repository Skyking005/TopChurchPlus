BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS zoom_accounts (
  zoom_account_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS zoom_reservations (
  zoom_reservation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zoom_account_id uuid NOT NULL REFERENCES zoom_accounts(zoom_account_id),
  title text NOT NULL,
  borrower_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  borrower_name text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  meeting_topic text,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'cancelled')),
  note text,
  created_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_zoom_reservations_account_time
  ON zoom_reservations (zoom_account_id, start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_zoom_reservations_status_time
  ON zoom_reservations (status, start_at, end_at);

INSERT INTO zoom_accounts (email, display_name, sort_order)
VALUES
  ('tcnschurch@gmail.com', 'Zoom 主帳號', 10),
  ('top.church.zoom.alpha@gmail.com', 'Zoom Alpha', 20),
  ('top.church.zoom.beta@gmail.com', 'Zoom Beta', 30)
ON CONFLICT (email) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  sort_order = EXCLUDED.sort_order,
  status = 'active',
  updated_at = now();

INSERT INTO role_feature_permissions (role, feature_key, access_level)
VALUES
  ('超級管理者', 'zoom', 'edit'),
  ('管理員', 'zoom', 'edit'),
  ('全職同工', 'zoom', 'edit')
ON CONFLICT (role, feature_key) DO UPDATE SET
  access_level = EXCLUDED.access_level,
  updated_at = now();

COMMIT;
