BEGIN;

CREATE TABLE IF NOT EXISTS qt_inventory_reservations (
  reservation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid NOT NULL REFERENCES qt_inventory_monthly(inventory_id) ON DELETE RESTRICT,
  order_id integer REFERENCES qt_orders(order_id) ON DELETE SET NULL,
  order_item_id integer REFERENCES qt_order_items(order_item_id) ON DELETE SET NULL,
  member_id integer REFERENCES pastoral_members(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'reserved',
  reserved_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  fulfilled_at timestamptz,
  created_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  released_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  release_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (quantity > 0),
  CHECK (status IN ('reserved', 'released', 'fulfilled', 'cancelled')),
  CHECK (
    (status = 'reserved' AND released_at IS NULL AND fulfilled_at IS NULL)
    OR (status = 'released' AND released_at IS NOT NULL)
    OR (status = 'fulfilled' AND fulfilled_at IS NOT NULL)
    OR (status = 'cancelled')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_qt_inventory_reservations_active_item
  ON qt_inventory_reservations(order_item_id)
  WHERE status = 'reserved' AND order_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_qt_inventory_reservations_inventory
  ON qt_inventory_reservations(inventory_id, status);

CREATE INDEX IF NOT EXISTS idx_qt_inventory_reservations_order
  ON qt_inventory_reservations(order_id, order_item_id);

CREATE INDEX IF NOT EXISTS idx_qt_inventory_reservations_member
  ON qt_inventory_reservations(member_id, status);

ALTER TABLE qt_inventory_movements
  ADD COLUMN IF NOT EXISTS order_id integer REFERENCES qt_orders(order_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_item_id integer REFERENCES qt_order_items(order_item_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reservation_id uuid REFERENCES qt_inventory_reservations(reservation_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_qt_inventory_movements_reservation
  ON qt_inventory_movements(reservation_id);

CREATE INDEX IF NOT EXISTS idx_qt_inventory_movements_order_item
  ON qt_inventory_movements(order_item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON qt_inventory_reservations TO "Codex";

COMMIT;
