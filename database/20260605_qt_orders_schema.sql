BEGIN;

CREATE TABLE IF NOT EXISTS qt_payment_types (
  payment_type_id integer PRIMARY KEY,
  payment_type_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qt_orders (
  order_id integer PRIMARY KEY,
  member_id integer REFERENCES pastoral_members(id) ON DELETE SET NULL,
  payer_member_id integer REFERENCES pastoral_members(id) ON DELETE SET NULL,
  church_id integer REFERENCES churches(id) ON DELETE SET NULL,
  plan_id integer REFERENCES qt_price_plans(plan_id) ON DELETE SET NULL,
  product_type text REFERENCES qt_product_types(product_type) ON DELETE SET NULL,
  start_month date,
  end_month date,
  quantity integer NOT NULL DEFAULT 1,
  amount integer NOT NULL DEFAULT 0,
  order_status text NOT NULL DEFAULT 'pending',
  finance_status text NOT NULL DEFAULT 'unpaid',
  cashier_staff_id text,
  payment_type_id integer REFERENCES qt_payment_types(payment_type_id) ON DELETE SET NULL,
  paper_receipt_no text,
  payment_sequence_no integer,
  ordered_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  legacy_product_group integer,
  source_system text NOT NULL DEFAULT 'legacy_quiet_time',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (order_status IN ('cancelled', 'expired', 'pending', 'active')),
  CHECK (finance_status IN ('unpaid', 'received', 'posted'))
);

CREATE TABLE IF NOT EXISTS qt_order_items (
  order_item_id integer PRIMARY KEY,
  order_id integer NOT NULL REFERENCES qt_orders(order_id) ON DELETE CASCADE,
  issue_month date NOT NULL,
  is_received boolean NOT NULL DEFAULT false,
  receiver_member_id integer REFERENCES pastoral_members(id) ON DELETE SET NULL,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qt_orders_ordered_at ON qt_orders (ordered_at DESC);
CREATE INDEX IF NOT EXISTS idx_qt_orders_member ON qt_orders (member_id);
CREATE INDEX IF NOT EXISTS idx_qt_orders_status ON qt_orders (order_status, finance_status);
CREATE INDEX IF NOT EXISTS idx_qt_orders_church ON qt_orders (church_id);
CREATE INDEX IF NOT EXISTS idx_qt_order_items_issue_month ON qt_order_items (issue_month, is_received);

GRANT SELECT, INSERT, UPDATE, DELETE ON qt_payment_types TO "Codex";
GRANT SELECT, INSERT, UPDATE, DELETE ON qt_orders TO "Codex";
GRANT SELECT, INSERT, UPDATE, DELETE ON qt_order_items TO "Codex";

COMMIT;
