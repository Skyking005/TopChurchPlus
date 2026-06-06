BEGIN;

CREATE TABLE IF NOT EXISTS admin_supply_items (
  supply_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '',
  min_stock numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  note text NOT NULL DEFAULT '',
  created_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (min_stock >= 0)
);

CREATE TABLE IF NOT EXISTS admin_supply_stocks (
  supply_id uuid NOT NULL REFERENCES admin_supply_items(supply_id) ON DELETE CASCADE,
  church_id integer NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  quantity numeric(12,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (supply_id, church_id),
  CHECK (quantity >= 0)
);

CREATE TABLE IF NOT EXISTS admin_supply_movements (
  movement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_type text NOT NULL,
  supply_id uuid NOT NULL REFERENCES admin_supply_items(supply_id) ON DELETE CASCADE,
  from_church_id integer REFERENCES churches(id) ON DELETE SET NULL,
  to_church_id integer REFERENCES churches(id) ON DELETE SET NULL,
  quantity numeric(12,2) NOT NULL,
  reason text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  handled_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  handled_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (quantity > 0),
  CHECK (movement_type IN ('in', 'out', 'transfer', 'adjust', 'discard', 'return'))
);

CREATE INDEX IF NOT EXISTS idx_admin_supply_items_category ON admin_supply_items(category);
CREATE INDEX IF NOT EXISTS idx_admin_supply_items_active ON admin_supply_items(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_supply_stocks_church ON admin_supply_stocks(church_id);
CREATE INDEX IF NOT EXISTS idx_admin_supply_movements_supply_time ON admin_supply_movements(supply_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_supply_movements_church_time
  ON admin_supply_movements(from_church_id, to_church_id, created_at DESC);

INSERT INTO role_feature_permissions (role, feature_key, access_level)
VALUES
  ('超級管理者', 'admin_supply', 'edit'),
  ('管理員', 'admin_supply', 'edit'),
  ('全職同工', 'admin_supply', 'read'),
  ('使用者', 'admin_supply', 'none'),
  ('一般使用者', 'admin_supply', 'none'),
  ('義工', 'admin_supply', 'none'),
  ('技術同工', 'admin_supply', 'none'),
  ('牧養同工', 'admin_supply', 'none'),
  ('教育同工', 'admin_supply', 'none'),
  ('媒體同工', 'admin_supply', 'none')
ON CONFLICT (role, feature_key) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON admin_supply_items TO "Codex";
GRANT SELECT, INSERT, UPDATE, DELETE ON admin_supply_stocks TO "Codex";
GRANT SELECT, INSERT, UPDATE, DELETE ON admin_supply_movements TO "Codex";

COMMIT;
