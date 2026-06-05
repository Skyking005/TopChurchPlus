BEGIN;

CREATE TABLE IF NOT EXISTS qt_product_types (
  product_type text PRIMARY KEY,
  product_name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qt_price_plans (
  plan_id integer PRIMARY KEY,
  plan_name text NOT NULL,
  product_type text NOT NULL REFERENCES qt_product_types(product_type),
  duration_months integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  legacy_group_code integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qt_inventory_movements (
  movement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_month date NOT NULL,
  church_id integer NOT NULL REFERENCES churches(id),
  product_type text NOT NULL REFERENCES qt_product_types(product_type),
  movement_type text NOT NULL,
  quantity integer NOT NULL,
  related_movement_id uuid REFERENCES qt_inventory_movements(movement_id) ON DELETE SET NULL,
  source_system text,
  source_id text,
  note text,
  created_by_staff_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (issue_month = date_trunc('month', issue_month)::date),
  CHECK (movement_type IN ('initial_stock', 'receive', 'transfer_in', 'transfer_out', 'sale', 'reserve', 'release', 'adjustment')),
  CHECK (quantity <> 0)
);

CREATE INDEX IF NOT EXISTS idx_qt_inventory_movements_lookup
  ON qt_inventory_movements (issue_month, church_id, product_type);

CREATE INDEX IF NOT EXISTS idx_qt_inventory_movements_source
  ON qt_inventory_movements (source_system, source_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON qt_product_types TO "Codex";
GRANT SELECT, INSERT, UPDATE, DELETE ON qt_price_plans TO "Codex";
GRANT SELECT, INSERT, UPDATE, DELETE ON qt_inventory_movements TO "Codex";

INSERT INTO qt_product_types (product_type, product_name, sort_order)
VALUES
  ('adult_student', '成人/學生 QT', 1),
  ('eaglet', '小飛鷹 QT', 2)
ON CONFLICT (product_type) DO UPDATE SET
  product_name = EXCLUDED.product_name,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO qt_price_plans (plan_id, plan_name, product_type, duration_months, unit_price, legacy_group_code)
VALUES
  (1, '成人-單本購買', 'adult_student', 1, 100, 1),
  (2, '成人-半年訂購', 'adult_student', 6, 540, 1),
  (3, '成人-一年訂購', 'adult_student', 12, 960, 1),
  (4, '學生-單本購買(大專)', 'adult_student', 1, 70, 1),
  (5, '學生-半年訂購(大專)', 'adult_student', 6, 420, 1),
  (6, '學生-一年訂購(大專)', 'adult_student', 12, 840, 1),
  (7, '小飛鷹-單本購買', 'eaglet', 1, 120, 2),
  (8, '小飛鷹-半年訂購', 'eaglet', 6, 660, 2),
  (9, '小飛鷹-一年訂購', 'eaglet', 12, 1200, 2),
  (10, '學生-單本購買(國高)', 'adult_student', 1, 50, 1),
  (11, '學生-半年購買(國高)', 'adult_student', 6, 300, 1),
  (12, '學生-一年購買(國高)', 'adult_student', 12, 600, 1)
ON CONFLICT (plan_id) DO UPDATE SET
  plan_name = EXCLUDED.plan_name,
  product_type = EXCLUDED.product_type,
  duration_months = EXCLUDED.duration_months,
  unit_price = EXCLUDED.unit_price,
  legacy_group_code = EXCLUDED.legacy_group_code,
  updated_at = now();

INSERT INTO qt_inventory_movements (
  issue_month, church_id, product_type, movement_type, quantity, source_system, source_id, note
)
VALUES
  ('2024-08-01', 1, 'adult_student', 'initial_stock', 200, 'legacy_quiet_time', 'QuietTimeInventoryDetail:1', '舊系統庫存匯入'),
  ('2024-08-01', 2, 'adult_student', 'initial_stock', 300, 'legacy_quiet_time', 'QuietTimeInventoryDetail:2', '舊系統庫存匯入'),
  ('2024-08-01', 5, 'adult_student', 'initial_stock', 400, 'legacy_quiet_time', 'QuietTimeInventoryDetail:3', '舊系統庫存匯入'),
  ('2024-09-01', 4, 'adult_student', 'initial_stock', 100, 'legacy_quiet_time', 'QuietTimeInventoryDetail:4', '舊系統庫存匯入'),
  ('2024-09-01', 6, 'adult_student', 'initial_stock', 300, 'legacy_quiet_time', 'QuietTimeInventoryDetail:5', '舊系統庫存匯入')
ON CONFLICT DO NOTHING;

COMMIT;
