BEGIN;

CREATE TABLE IF NOT EXISTS counter_pin_codes (
  pin_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_code text NOT NULL UNIQUE,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  usage_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (pin_code ~ '^[A-Z0-9]{6}$'),
  CHECK (valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_counter_pin_codes_active_time
  ON counter_pin_codes (is_active, valid_from, valid_until);

GRANT SELECT, INSERT, UPDATE, DELETE ON counter_pin_codes TO "Codex";

COMMIT;
