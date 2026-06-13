BEGIN;

CREATE TABLE IF NOT EXISTS qt_inventory_monthly (
  inventory_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qt_month char(6) NOT NULL,
  qt_type text NOT NULL,
  church_id integer NOT NULL REFERENCES churches(id),
  physical_quantity integer NOT NULL DEFAULT 0,
  reserved_quantity integer NOT NULL DEFAULT 0,
  retail_quantity integer NOT NULL DEFAULT 0,
  estimated_inbound_quantity integer NOT NULL DEFAULT 0,
  actual_inbound_quantity integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  updated_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (qt_month ~ '^[0-9]{6}$'),
  CHECK (substring(qt_month from 5 for 2)::int BETWEEN 1 AND 12),
  CHECK (qt_month >= '202609'),
  CHECK (qt_type IN ('ADULT', 'CHILD')),
  CHECK (physical_quantity >= 0),
  CHECK (reserved_quantity >= 0),
  CHECK (retail_quantity >= 0),
  CHECK (estimated_inbound_quantity >= 0),
  CHECK (actual_inbound_quantity >= 0),
  CHECK (physical_quantity = reserved_quantity + retail_quantity),
  CHECK (status IN ('active', 'locked', 'closed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_qt_inventory_monthly_scope
  ON qt_inventory_monthly(church_id, qt_month, qt_type);

CREATE INDEX IF NOT EXISTS idx_qt_inventory_monthly_lookup
  ON qt_inventory_monthly(qt_month, church_id, qt_type);

CREATE INDEX IF NOT EXISTS idx_qt_inventory_monthly_status
  ON qt_inventory_monthly(status, qt_month);

ALTER TABLE qt_inventory_movements
  ADD COLUMN IF NOT EXISTS inventory_id uuid REFERENCES qt_inventory_monthly(inventory_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qt_month char(6),
  ADD COLUMN IF NOT EXISTS qt_type text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE qt_inventory_movements
  DROP CONSTRAINT IF EXISTS chk_qt_inventory_movements_qt_month;

ALTER TABLE qt_inventory_movements
  ADD CONSTRAINT chk_qt_inventory_movements_qt_month
  CHECK (qt_month IS NULL OR (qt_month ~ '^[0-9]{6}$' AND substring(qt_month from 5 for 2)::int BETWEEN 1 AND 12));

ALTER TABLE qt_inventory_movements
  DROP CONSTRAINT IF EXISTS chk_qt_inventory_movements_qt_type;

ALTER TABLE qt_inventory_movements
  ADD CONSTRAINT chk_qt_inventory_movements_qt_type
  CHECK (qt_type IS NULL OR qt_type IN ('ADULT', 'CHILD'));

CREATE INDEX IF NOT EXISTS idx_qt_inventory_movements_created_at
  ON qt_inventory_movements(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qt_inventory_movements_qt_month_type
  ON qt_inventory_movements(qt_month, qt_type, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON qt_inventory_monthly TO "Codex";

COMMIT;
