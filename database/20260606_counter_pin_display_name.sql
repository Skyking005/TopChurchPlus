BEGIN;

ALTER TABLE counter_pin_codes
  ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT '';

UPDATE counter_pin_codes
SET is_active = false,
    updated_at = now()
WHERE pin_code !~ '^[A-Z][0-9]{5}$'
  AND is_active;

ALTER TABLE counter_pin_codes
  DROP CONSTRAINT IF EXISTS counter_pin_codes_pin_code_check;

ALTER TABLE counter_pin_codes
  ADD CONSTRAINT counter_pin_codes_pin_code_check
  CHECK ((NOT is_active) OR pin_code ~ '^[A-Z][0-9]{5}$');

CREATE INDEX IF NOT EXISTS idx_counter_pin_codes_pin_code
  ON counter_pin_codes (pin_code);

COMMIT;
