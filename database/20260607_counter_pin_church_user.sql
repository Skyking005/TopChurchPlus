BEGIN;

ALTER TABLE counter_pin_codes
  ADD COLUMN IF NOT EXISTS assigned_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL;

ALTER TABLE counter_pin_codes
  ADD COLUMN IF NOT EXISTS church_id integer REFERENCES churches(id) ON DELETE SET NULL;

ALTER TABLE counter_pin_codes
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

UPDATE counter_pin_codes
SET status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END
WHERE status IS NULL OR status = '';

UPDATE counter_pin_codes
SET status = 'inactive',
    updated_at = now()
WHERE NOT is_active
  AND status <> 'inactive';

UPDATE counter_pin_codes
SET status = 'inactive',
    is_active = false,
    updated_at = now()
WHERE is_active
  AND (assigned_staff_id IS NULL OR church_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_counter_pin_codes_assigned_staff
  ON counter_pin_codes (assigned_staff_id);

CREATE INDEX IF NOT EXISTS idx_counter_pin_codes_church
  ON counter_pin_codes (church_id);

CREATE INDEX IF NOT EXISTS idx_counter_pin_codes_status
  ON counter_pin_codes (status, is_active);

ALTER TABLE counter_transactions
  ADD COLUMN IF NOT EXISTS received_church_id integer REFERENCES churches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_counter_transactions_received_church_time
  ON counter_transactions (received_church_id, received_at DESC);

COMMIT;
