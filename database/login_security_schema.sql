CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS login_events (
  id bigserial PRIMARY KEY,
  staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  email text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('success', 'challenge_required', 'challenge_success', 'challenge_failed', 'failed')),
  device_id_hash text,
  device_label text,
  device_type text,
  user_agent text,
  client_ip inet,
  api_ip inet,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_events_staff_created
  ON login_events (staff_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_events_email_created
  ON login_events (lower(email), created_at DESC);

CREATE TABLE IF NOT EXISTS trusted_login_devices (
  id bigserial PRIMARY KEY,
  staff_id text NOT NULL REFERENCES accounts(staff_id) ON DELETE CASCADE,
  device_id_hash text NOT NULL,
  device_label text,
  device_type text,
  user_agent text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_client_ip inet,
  last_client_ip_hash text,
  last_api_ip inet,
  is_active boolean NOT NULL DEFAULT true,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, device_id_hash)
);

CREATE INDEX IF NOT EXISTS idx_trusted_login_devices_staff
  ON trusted_login_devices (staff_id, is_active, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS login_verification_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id text NOT NULL REFERENCES accounts(staff_id) ON DELETE CASCADE,
  email text NOT NULL,
  code_hash text NOT NULL,
  device_id_hash text,
  device_label text,
  device_type text,
  user_agent text,
  client_ip inet,
  client_ip_hash text,
  api_ip inet,
  reason text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_verification_challenges_staff_created
  ON login_verification_challenges (staff_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_verification_challenges_expires
  ON login_verification_challenges (expires_at)
  WHERE verified_at IS NULL;
