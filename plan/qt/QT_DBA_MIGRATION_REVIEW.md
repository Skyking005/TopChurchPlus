# TopChurchPlus QT DBA Migration Review

```text
Status: Draft / Planning Only
This document is not the source of truth.
Before implementation, Codex must verify actual code, database schema, live PostgreSQL data, API catalog, and architecture documents.
```

Last updated: 2026-06-13

Source documents:

- `plan/qt/QT_DOMAIN_REFACTOR_PLAN_V1.md`
- `plan/qt/QT_MIGRATION_PLAN.md`
- `database/20260605_qt_inventory_schema.sql`
- `database/20260605_qt_orders_schema.sql`
- `database/20260605_fk_index_coverage.sql`
- `api/src/modules/qt/routes.js`
- `api/src/scripts/import-qt-legacy.js`

## 1. Review Scope

This review is for Phase 2 migration planning only.

It does not implement Phase 2.

This task did not:

- modify production code
- modify `/docs`
- execute migration
- modify database schema
- modify API
- modify UI
- deploy anything

## Phase 2 Cutover Decision

Official business decisions recorded on 2026-06-13:

- Target deployment window: 2026 年 8 月中.
- First official operational QT month: 2026-09.
- QT months from 2026-09 onward should use the new QT Inventory Model.
- QT months up to and including 2026-08 are the legacy period.

Implementation meaning:

- Phase 2 migration planning should establish a clean operational starting point at 2026-09.
- New Physical / Reserved / Retail invariant enforcement applies to 2026-09 and later.
- Legacy QT months should not be used as automatic truth for the first 2026-09 inventory state.
- Any migration script or import process must prevent legacy data from overwriting 2026-09 and later new inventory rows.

## Legacy Month Rule

QT months up to and including 2026-08 are treated as closed / legacy by default.

Rules:

- Do not perform a complete Reserved Inventory backfill for 2026-08 or earlier months.
- Legacy period data is retained for query, historical reference, reconciliation, and manual confirmation.
- Legacy period data does not need to satisfy the new Physical / Reserved / Retail invariant.
- If any 2026-08 or earlier paid-but-unfulfilled rows remain, export them for manual review.
- Do not automatically convert legacy paid-but-unfulfilled rows into new-system Reserved Inventory.

## 60 Paid-Unfulfilled Candidates Decision

The live DBA review identified 60 paid/unreceived candidate items.

Official treatment:

- These 60 rows must not be automatically treated as real Reserved Inventory.
- They must be listed as manual inventory and operations confirmation candidates.
- If operations confirms that any candidate still needs to be honored, the transfer method must be defined by `plan/qt/QT_LEGACY_DATA_MIGRATION_PLAN.md`.
- If a candidate cannot be confirmed, keep it as legacy reference only.
- Unconfirmed candidates must not pollute the 2026-09 new inventory model.

## 2. Live Read-Only Snapshot

Read-only counts were taken from the configured local `api/.env` PostgreSQL connection on 2026-06-13. No writes were executed.

| Check | Result |
| --- | ---: |
| `qt_orders` rows | 11,541 |
| `qt_order_items` rows | 56,138 |
| `qt_inventory_movements` rows | 11 |
| Inventory month/church/product groups | 9 |
| Negative stock groups under current movement sum | 0 |
| Paid and unreceived candidate items | 60 |
| Received items | 50,782 |
| Received items without `received_at` | 3 |
| Received items without `receiver_member_id` | 309 |
| Active order items already received | 4,035 |
| Active order items not received | 3,583 |

Order status distribution:

| `order_status` | `finance_status` | Count |
| --- | --- | ---: |
| active | received | 829 |
| active | unpaid | 72 |
| cancelled | posted | 21 |
| cancelled | received | 34 |
| cancelled | unpaid | 1,854 |
| expired | posted | 923 |
| expired | received | 7,239 |
| expired | unpaid | 556 |
| pending | unpaid | 13 |

Order item distribution:

| `is_received` | Count |
| --- | ---: |
| false | 5,356 |
| true | 50,782 |

Inventory movement distribution:

| Movement Type | Rows | Quantity Sum |
| --- | ---: | ---: |
| initial_stock | 5 | 1,300 |
| receive | 2 | 22 |
| transfer_in | 2 | 3 |
| transfer_out | 2 | -3 |

DBA observation:

- The current inventory ledger is not a complete historical fulfillment ledger. There are 50,782 received order items but only 11 inventory movement rows.
- Therefore, Phase 2 must not backfill historical Physical/Reserved/Retail values by assuming each received order item has a corresponding inventory movement.
- Existing `qt_inventory_movements` can be preserved as current operational stock ledger input, but it is insufficient as the only source for historical fulfillment reconstruction.

## 3. Existing QT Inventory Structure

Current QT inventory tables:

### `qt_product_types`

Purpose:

- QT product category master.

Existing key fields:

- `product_type text primary key`
- `product_name`
- `sort_order`
- `is_active`

Known values:

- `adult_student`
- `eaglet`

### `qt_price_plans`

Purpose:

- Price plan and duration reference.

Existing key fields:

- `plan_id integer primary key`
- `plan_name`
- `product_type`
- `duration_months`
- `unit_price`
- `legacy_group_code`

### `qt_inventory_movements`

Purpose:

- Ledger-style inventory movement table.

Existing fields:

- `movement_id uuid primary key`
- `issue_month date not null`
- `church_id integer not null references churches(id)`
- `product_type text not null references qt_product_types(product_type)`
- `movement_type text not null`
- `quantity integer not null`
- `related_movement_id uuid references qt_inventory_movements(movement_id)`
- `source_system text`
- `source_id text`
- `note text`
- `created_by_staff_id text`
- `created_at timestamptz`

Existing checks:

- `issue_month = date_trunc('month', issue_month)::date`
- `movement_type in ('initial_stock', 'receive', 'transfer_in', 'transfer_out', 'sale', 'reserve', 'release', 'adjustment')`
- `quantity <> 0`

Existing indexes:

- `idx_qt_inventory_movements_lookup(issue_month, church_id, product_type)`
- `idx_qt_inventory_movements_source(source_system, source_id)`

Current API behavior:

- `GET /qt/inventory` computes availability by summing movements.
- `GET /qt/stock-check` uses summed availability.
- `POST /qt/inventory/movements` inserts movement rows.
- `POST /qt/inventory/transfers` inserts one `transfer_out` and one `transfer_in` row in a transaction.

## 4. Can Current Tables Support Physical / Reserved / Retail?

Short answer: no, not safely.

Current `qt_inventory_movements` can represent some concepts through signed movements:

| Concept | Current Possible Representation | Limitation |
| --- | --- | --- |
| Physical Inventory | Sum of all movement rows | Mixed with `reserve`, `release`, `sale`; not a true physical count. |
| Reserved Inventory | `reserve` / `release` rows | Movement type exists but is not linked to PAID lifecycle or order item. |
| Retail Inventory | Current summed availability | Not separated from physical or reserved. |
| Transfer | `transfer_out` + `transfer_in` | Immediate transfer only; no pending workflow. |

Problem:

The target invariant is:

```text
Physical Inventory = Reserved Inventory + Retail Inventory
```

The current movement sum is closer to "available quantity" than to the target Physical Inventory. Because `reserve` is signed as negative in current API semantics, summing all movement rows would reduce the same quantity that the target model says should remain physically present until fulfillment.

Conclusion:

- A new monthly stock master or equivalent lockable aggregate is required.
- Existing movement rows should remain as legacy ledger/audit input.
- Phase 2 should introduce additive tables and compatibility reads instead of mutating current movement semantics in place.

## 5. Recommended New Tables

### 5.1 `qt_inventory_monthly`

Purpose:

- One lockable row per issue month, church, product type.
- Holds Phase 2 aggregate stock state.

Proposed fields:

```sql
CREATE TABLE qt_inventory_monthly (
  inventory_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_month date NOT NULL,
  church_id integer NOT NULL REFERENCES churches(id),
  product_type text NOT NULL REFERENCES qt_product_types(product_type),
  expected_inbound_quantity integer NOT NULL DEFAULT 0,
  physical_quantity integer NOT NULL DEFAULT 0,
  reserved_quantity integer NOT NULL DEFAULT 0,
  retail_quantity integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  source_system text,
  source_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  updated_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (issue_month = date_trunc('month', issue_month)::date),
  CHECK (expected_inbound_quantity >= 0),
  CHECK (physical_quantity >= 0),
  CHECK (reserved_quantity >= 0),
  CHECK (retail_quantity >= 0),
  CHECK (physical_quantity = reserved_quantity + retail_quantity),
  CHECK (status IN ('active', 'locked', 'closed'))
);
```

Notes:

- `retail_quantity` may be physically stored for fast reads and locked updates.
- If DBA prefers computed retail, then remove `retail_quantity` and expose a view: `physical_quantity - reserved_quantity`. However, stored `retail_quantity` with a CHECK constraint is easier for SELECT FOR UPDATE transactional updates.

### 5.2 `qt_inventory_reservations`

Purpose:

- Connect PAID but unfulfilled order items to reserved stock.
- Required for release/cancel/refund and future reconciliation.

Proposed fields:

```sql
CREATE TABLE qt_inventory_reservations (
  reservation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid NOT NULL REFERENCES qt_inventory_monthly(inventory_id),
  order_id integer NOT NULL REFERENCES qt_orders(order_id) ON DELETE CASCADE,
  order_item_id integer REFERENCES qt_order_items(order_item_id) ON DELETE CASCADE,
  member_id integer REFERENCES pastoral_members(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'reserved',
  reserved_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  fulfilled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (quantity > 0),
  CHECK (status IN ('reserved', 'released', 'fulfilled', 'cancelled'))
);
```

Recommended partial unique index:

```sql
CREATE UNIQUE INDEX uq_qt_inventory_reservations_active_item
  ON qt_inventory_reservations(order_item_id)
  WHERE status = 'reserved' AND order_item_id IS NOT NULL;
```

### 5.3 `qt_inventory_transfers`

Purpose:

- Pending transfer workflow for cross-church pickup and normal transfers.

Current transfer model inserts immediate `transfer_out` and `transfer_in` movement rows. This is not enough for cross-church pickup because the plan requires a pending transfer after actual pickup.

Proposed fields:

```sql
CREATE TABLE qt_inventory_transfers (
  transfer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_month date NOT NULL,
  product_type text NOT NULL REFERENCES qt_product_types(product_type),
  from_church_id integer NOT NULL REFERENCES churches(id),
  to_church_id integer NOT NULL REFERENCES churches(id),
  quantity integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reason text,
  source_type text,
  source_id text,
  order_id integer REFERENCES qt_orders(order_id) ON DELETE SET NULL,
  order_item_id integer REFERENCES qt_order_items(order_item_id) ON DELETE SET NULL,
  requested_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  completed_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (issue_month = date_trunc('month', issue_month)::date),
  CHECK (quantity > 0),
  CHECK (from_church_id <> to_church_id),
  CHECK (status IN ('pending', 'completed', 'cancelled'))
);
```

### 5.4 Extend `qt_inventory_movements`

Recommendation: keep the existing table as the inventory log table, but add references and metadata for Phase 2/3.

Proposed additive fields:

```sql
ALTER TABLE qt_inventory_movements
  ADD COLUMN IF NOT EXISTS inventory_id uuid REFERENCES qt_inventory_monthly(inventory_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_id integer REFERENCES qt_orders(order_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_item_id integer REFERENCES qt_order_items(order_item_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reservation_id uuid REFERENCES qt_inventory_reservations(reservation_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transfer_id uuid REFERENCES qt_inventory_transfers(transfer_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
```

Important:

- Do not reinterpret old movement rows.
- New Phase 2/3 writes should populate these reference columns.
- Existing movement rows can remain with null references.

## 6. Required Columns / Adjustments To Existing Tables

### `qt_order_items`

Recommended additive fields for Phase 3, not Phase 2 core migration unless needed for backfill:

```sql
ALTER TABLE qt_order_items
  ADD COLUMN IF NOT EXISTS ordered_church_id integer REFERENCES churches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fulfilled_church_id integer REFERENCES churches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fulfilled_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fulfillment_inventory_id uuid REFERENCES qt_inventory_monthly(inventory_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fulfillment_movement_id uuid REFERENCES qt_inventory_movements(movement_id) ON DELETE SET NULL;
```

Rationale:

- Existing `qt_order_items` only has `is_received`, `receiver_member_id`, and `received_at`.
- It does not track actual receiving church or the staff operator.
- Cross-church pickup cannot be reconstructed reliably without `fulfilled_church_id`.

### `qt_orders`

Recommended additive fields for Phase 3, not required to create Phase 2 stock master:

```sql
ALTER TABLE qt_orders
  ADD COLUMN IF NOT EXISTS lifecycle_status text,
  ADD COLUMN IF NOT EXISTS payment_review_status text,
  ADD COLUMN IF NOT EXISTS cancelled_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
```

Rationale:

- Current `order_status` and `finance_status` are legacy-compatible values.
- Do not change existing CHECK constraints in the first migration.
- Introduce compatibility fields or a view before any state machine cutover.

## 7. Constraints

Recommended constraints:

1. One monthly stock row per month/church/product:

```sql
ALTER TABLE qt_inventory_monthly
  ADD CONSTRAINT uq_qt_inventory_monthly_scope
  UNIQUE (issue_month, church_id, product_type);
```

2. Month normalization:

```sql
CHECK (issue_month = date_trunc('month', issue_month)::date)
```

3. Non-negative inventory:

```sql
CHECK (physical_quantity >= 0)
CHECK (reserved_quantity >= 0)
CHECK (retail_quantity >= 0)
```

4. Invariant:

```sql
CHECK (physical_quantity = reserved_quantity + retail_quantity)
```

5. Reservation status and quantity:

```sql
CHECK (quantity > 0)
CHECK (status IN ('reserved', 'released', 'fulfilled', 'cancelled'))
```

6. Transfer status and source/target:

```sql
CHECK (quantity > 0)
CHECK (from_church_id <> to_church_id)
CHECK (status IN ('pending', 'completed', 'cancelled'))
```

7. Active reservation uniqueness:

```sql
CREATE UNIQUE INDEX uq_qt_inventory_reservations_active_item
  ON qt_inventory_reservations(order_item_id)
  WHERE status = 'reserved' AND order_item_id IS NOT NULL;
```

## 8. Indexes

Recommended indexes:

```sql
CREATE INDEX idx_qt_inventory_monthly_lookup
  ON qt_inventory_monthly(issue_month, church_id, product_type);

CREATE INDEX idx_qt_inventory_monthly_status
  ON qt_inventory_monthly(status, issue_month);

CREATE INDEX idx_qt_inventory_reservations_inventory
  ON qt_inventory_reservations(inventory_id, status);

CREATE INDEX idx_qt_inventory_reservations_order
  ON qt_inventory_reservations(order_id, order_item_id);

CREATE INDEX idx_qt_inventory_transfers_lookup
  ON qt_inventory_transfers(issue_month, product_type, from_church_id, to_church_id, status);

CREATE INDEX idx_qt_inventory_transfers_order_item
  ON qt_inventory_transfers(order_item_id);

CREATE INDEX idx_qt_inventory_movements_inventory_created
  ON qt_inventory_movements(inventory_id, created_at DESC);

CREATE INDEX idx_qt_inventory_movements_order_item
  ON qt_inventory_movements(order_item_id);

CREATE INDEX idx_qt_inventory_movements_transfer
  ON qt_inventory_movements(transfer_id);

CREATE INDEX idx_qt_order_items_fulfilled_church
  ON qt_order_items(fulfilled_church_id);
```

Existing indexes to preserve:

- `idx_qt_inventory_movements_lookup`
- `idx_qt_inventory_movements_source`
- `idx_qt_order_items_issue_month`
- `idx_qt_order_items_order_id`
- `idx_qt_order_items_receiver_member_id`
- `idx_qt_orders_status`
- `idx_qt_orders_church`
- `idx_qt_orders_member`

## 9. Inventory Log Table Decision

Recommendation: reuse `qt_inventory_movements` as the inventory log table, with additive reference columns.

Reason:

- It already records `issue_month`, `church_id`, `product_type`, `movement_type`, signed `quantity`, source, note, operator, and time.
- It is already used by UI and API.
- Replacing it would increase migration risk.

Required adjustment:

- Add references to `qt_inventory_monthly`, `qt_inventory_reservations`, `qt_inventory_transfers`, `qt_orders`, and `qt_order_items`.
- New Phase 2/3 movement rows should be append-only.
- Do not update or delete historical movement rows except in an explicitly approved rollback.

## 10. Transfer Table Decision

Recommendation: add `qt_inventory_transfers`.

Reason:

- Existing `POST /qt/inventory/transfers` writes immediate transfer movements only.
- Cross-church pickup requires pending transfer state.
- The plan requires `status = PENDING` after a successful cross-church pickup.
- Immediate movement pairs cannot express pending / completed / cancelled transfer lifecycle.

Compatibility:

- Existing immediate transfers can remain in `qt_inventory_movements`.
- Future transfer UI/API can write `qt_inventory_transfers` first, then movement rows when completed.
- Cross-church pickup can create a `pending` transfer row in the same transaction as fulfillment.

## 11. Phase 2 Migration Strategy

Phase 2 should be additive and reversible.

### Step 0: Backup And Freeze Window

Before migration:

1. Backup these tables:
   - `qt_product_types`
   - `qt_price_plans`
   - `qt_inventory_movements`
   - `qt_orders`
   - `qt_order_items`
   - `qt_payment_types`
   - `audit_logs`
2. Export read-only reconciliation counts:
   - orders by `order_status`, `finance_status`
   - items by `is_received`
   - movements by `movement_type`
   - current stock sum by `issue_month`, `church_id`, `product_type`
   - paid unreceived candidate items by `issue_month`, `church_id`, `product_type`
3. Confirm no legacy QT sync/import is running.

### Step 1: Add New Tables

Create:

- `qt_inventory_monthly`
- `qt_inventory_reservations`
- `qt_inventory_transfers`

Add reference columns to:

- `qt_inventory_movements`
- optionally `qt_order_items` and `qt_orders` if Phase 2 UI/API needs them.

### Step 2: Backfill Monthly Rows Conservatively

Initial conservative rule:

```text
physical_quantity = current summed movement availability
reserved_quantity = 0
retail_quantity = physical_quantity
```

Use only groups from existing `qt_inventory_movements`:

```sql
INSERT INTO qt_inventory_monthly (
  issue_month, church_id, product_type,
  physical_quantity, reserved_quantity, retail_quantity,
  source_system, source_id, metadata
)
SELECT
  issue_month,
  church_id,
  product_type,
  GREATEST(SUM(quantity), 0)::int AS physical_quantity,
  0 AS reserved_quantity,
  GREATEST(SUM(quantity), 0)::int AS retail_quantity,
  'qt_phase2_backfill',
  'movement_sum',
  jsonb_build_object('source', 'qt_inventory_movements_sum')
FROM qt_inventory_movements
GROUP BY issue_month, church_id, product_type
ON CONFLICT (issue_month, church_id, product_type) DO NOTHING;
```

Important:

- Do not subtract historical received items from physical stock during initial backfill.
- Existing received items do not have reliable matching movement rows.
- If a stock group sum is negative, migration should fail or mark the row for manual review. Current read-only check found 0 negative stock groups.
- For the official cutover, apply the new inventory invariant from 2026-09 onward.
- Treat 2026-08 and earlier rows as legacy reference unless explicitly migrated after manual confirmation.

### Step 3: Reservation Candidate Review

Paid unreceived candidate rule:

```sql
SELECT
  i.issue_month,
  o.church_id,
  o.product_type,
  COUNT(*)::int AS reserved_candidate_items
FROM qt_order_items i
JOIN qt_orders o ON o.order_id = i.order_id
WHERE o.finance_status = 'posted'
  AND o.order_status <> 'cancelled'
  AND NOT i.is_received
GROUP BY i.issue_month, o.church_id, o.product_type
ORDER BY i.issue_month, o.church_id, o.product_type;
```

Live check found 60 paid/unreceived candidate items, mostly from old 2020-2022 issue months.

Recommendation:

- Do not automatically apply these 60 items to `reserved_quantity` unless operations confirms they still represent real unclaimed QT.
- Create a review export first.
- If confirmed, backfill reservations only for confirmed rows.
- If not confirmed, leave initial reserved quantity as 0 and treat old paid/unreceived rows as legacy anomalies.
- If a confirmed candidate belongs to 2026-08 or earlier, migrate it only through the legacy migration plan and do not let it change the initial 2026-09 monthly stock row unless operations explicitly creates a replacement 2026-09 obligation.

### Step 4: Compatibility View

Create a view for UI/API read-only migration safety:

```sql
CREATE OR REPLACE VIEW qt_inventory_monthly_view AS
SELECT
  inventory_id,
  issue_month,
  church_id,
  product_type,
  expected_inbound_quantity,
  physical_quantity,
  reserved_quantity,
  retail_quantity,
  status,
  created_at,
  updated_at
FROM qt_inventory_monthly;
```

### Step 5: Controlled API Cutover

Phase 2 API should:

- read stock from `qt_inventory_monthly`
- write stock changes in transaction
- lock the target inventory row with `SELECT ... FOR UPDATE`
- append a `qt_inventory_movements` row for every change
- keep old `/qt/inventory` behavior available until UI cutover is verified

## 12. Rollback Strategy

### 12.1 Schema Rollback

If no production writes occurred after migration:

```sql
DROP TABLE IF EXISTS qt_inventory_transfers;
DROP TABLE IF EXISTS qt_inventory_reservations;
DROP TABLE IF EXISTS qt_inventory_monthly;

ALTER TABLE qt_inventory_movements
  DROP COLUMN IF EXISTS metadata,
  DROP COLUMN IF EXISTS transfer_id,
  DROP COLUMN IF EXISTS reservation_id,
  DROP COLUMN IF EXISTS order_item_id,
  DROP COLUMN IF EXISTS order_id,
  DROP COLUMN IF EXISTS inventory_id;
```

If production writes occurred:

- Do not drop the new tables immediately.
- Disable new application paths.
- Preserve new tables for reconciliation.
- Restore old API reads to `qt_inventory_movements` sum.

### 12.2 Data Rollback

Before rollback:

1. Export `qt_inventory_monthly`.
2. Export `qt_inventory_reservations`.
3. Export `qt_inventory_transfers`.
4. Export Phase 2 movement rows from `qt_inventory_movements` where `inventory_id is not null` or `source_system = 'qt_phase2'`.
5. Export related `audit_logs`.

If rolling back after production writes:

- Do not delete Phase 2 movement rows unless DBA and operations approve.
- Prefer application rollback that ignores new tables while preserving audit trail.
- If the system must return to exact pre-migration state, restore from full DB backup instead of trying to manually reverse stock counts.

### 12.3 Application Rollback

Application rollback should:

- switch `/qt/inventory` and `/qt/stock-check` back to movement-sum logic
- hide Phase 2 monthly stock UI
- keep Phase 1 notification/reporting intact
- keep old QT order, finance, pickup reports unchanged

### 12.4 Avoiding Inconsistent Stock After Rollback

To avoid inconsistent stock:

- No partial rollback while Phase 2 writes are in progress.
- Stop API writes or put QT inventory UI in maintenance mode first.
- Export before/after inventory reconciliation.
- If any Phase 2 reservation/fulfillment occurred, rollback must either:
  - restore from backup, or
  - execute a reviewed compensation script that appends reversing movements and updates monthly rows in one transaction.

### 12.5 Tables To Backup

Minimum backup:

- `qt_product_types`
- `qt_price_plans`
- `qt_inventory_movements`
- `qt_orders`
- `qt_order_items`
- `qt_payment_types`
- `audit_logs`
- `notification_logs`

After migration adds new tables, also backup:

- `qt_inventory_monthly`
- `qt_inventory_reservations`
- `qt_inventory_transfers`

## 13. Backfill Strategy

Because existing data cannot be reliably split into Reserved / Retail / Physical, use conservative backfill.

Cutover boundary:

- 2026-09 and later is the first period where the new invariant is authoritative.
- 2026-08 and earlier does not need to satisfy the new invariant.
- Legacy rows should be preserved for history and reconciliation.
- Do not infer 2026-09 Reserved Inventory from incomplete legacy data.

### Conservative Initial Backfill

For each existing movement group:

```text
Physical Inventory = current summed movement quantity
Reserved Inventory = 0
Retail Inventory = Physical Inventory
```

Rationale:

- Existing movements are sparse.
- Received order items do not map to stock movements.
- Paid unreceived items include old historical data that may not represent current operational reservations.

### Reservation Backfill

Only after human confirmation:

1. Export paid/unreceived candidate list.
2. Exclude 2026-08 and earlier months unless operations explicitly confirms an active obligation.
3. Exclude rows with questionable payment/receipt status.
4. For confirmed rows:
   - insert `qt_inventory_reservations`
   - increment `reserved_quantity`
   - decrement `retail_quantity`
   - preserve `physical_quantity`
5. Enforce invariant after each update.
6. For 2026-08 and earlier confirmed obligations, follow `plan/qt/QT_LEGACY_DATA_MIGRATION_PLAN.md` before creating any new-system reservation.

### Fulfillment Backfill

Do not backfill fulfillment stock deductions from historical `is_received = true` rows in Phase 2.

Reason:

- There are 50,782 received items but only 11 inventory movement rows.
- Existing stock movements appear to represent selected operational inventory snapshots, not full historical order fulfillment.

## 14. Data Consistency Risks

| Risk | Severity | Notes |
| --- | --- | --- |
| Historical received items lack movement records | High | Cannot reconstruct real physical stock history from `qt_order_items`. |
| Paid/unreceived candidates are old | Medium/High | Live check found 60 candidates; many are 2020-2022. Must confirm if real. |
| `order_status` / `finance_status` are legacy states | High | Need mapping before reservation lifecycle writes. |
| `qt_order_items` lacks actual pickup church | High | Cross-church history cannot be reconstructed. |
| `qt_inventory_movements` current sum is not target Physical | High | Current sum is operational availability, not full physical stock model. |
| Existing import script truncates order tables | High | `api/src/scripts/import-qt-legacy.js` truncates `qt_order_items`, `qt_orders`, `qt_payment_types`. Must not run blindly after Phase 2 unless updated. |
| Legacy sync/import may overwrite new 2026-09 data | High | Cutover decision makes 2026-09 the first new-system month. Legacy import must be disabled, isolated, or guarded before Phase 2. |
| Movement types `reserve` / `release` exist but are not lifecycle-linked | Medium | Future writes must tie them to order/reservation rows. |
| No applied migration ledger | Medium | Need manual checklist and backup until migration runner exists. |

## 15. Concurrency Risks

High-risk concurrent operations:

- Two admins adjust the same monthly stock at the same time.
- Two pickup actions fulfill the same order item.
- Line Bot / LIFF order and admin stock adjustment hit the same inventory row.
- Cross-church pickup consumes actual pickup church Retail Inventory while another operation sells the same stock.
- Payment approval creates reservation while cancellation/refund releases it.

Required protections:

1. Wrap all inventory writes in a DB transaction.
2. Lock target `qt_inventory_monthly` rows with `SELECT ... FOR UPDATE`.
3. Lock target `qt_order_items` row for fulfillment with `SELECT ... FOR UPDATE`.
4. Use unique partial index to prevent duplicate active reservation for the same order item.
5. Re-check `retail_quantity >= requested_quantity` after locking, not before.
6. Append movement log in the same transaction as stock update.
7. Write audit log for high-risk actions in the same transaction when possible.

Example stock lock pattern:

```sql
BEGIN;

SELECT *
FROM qt_inventory_monthly
WHERE issue_month = $1
  AND church_id = $2
  AND product_type = $3
FOR UPDATE;

-- Validate retail/physical/reserved after lock.
-- Update monthly row.
-- Insert qt_inventory_movements row.
-- Insert audit log.

COMMIT;
```

Example fulfillment lock pattern:

```sql
BEGIN;

SELECT *
FROM qt_order_items
WHERE order_item_id = $1
FOR UPDATE;

SELECT *
FROM qt_inventory_monthly
WHERE inventory_id = $2
FOR UPDATE;

-- Reject if item already received.
-- Reject if stock would become negative.
-- Update item, monthly stock, reservation, movement, audit.

COMMIT;
```

## 16. Phase 2 Acceptance Gate

Phase 2 should not start until these are true:

1. DBA approves table names and DDL.
2. Operations confirms that 2026-09 is the first official operational month for the new QT Inventory Model.
3. Operations confirms that 2026-08 and earlier months are legacy / closed by default.
4. Operations confirms whether any of the 60 paid/unreceived candidate items are real active obligations.
5. `plan/qt/QT_LEGACY_DATA_MIGRATION_PLAN.md` is reviewed and accepted.
6. Operations confirms how to treat historical closed months.
7. A full DB backup is taken and restore path is known.
8. Legacy QT import/sync scripts are updated, disabled, or isolated so they cannot overwrite 2026-09 and later inventory data.
9. Migration rollback SQL is prepared.
10. Reconciliation SQL is reviewed.
11. UI/API feature flag or controlled cutover plan exists.
12. Load/concurrency behavior for stock locks is accepted.
13. Apps Script and NAS API deployment sequence is documented.

## 17. Phase 2 Pre-Migration Checklist

Required manual confirmations:

- Confirm target deployment window remains 2026 年 8 月中.
- Confirm 2026-09 remains the first Phase 2 operational month.
- Confirm 2026-08 and earlier months are closed / legacy by default.
- Confirm whether any of the 60 paid/unreceived candidate rows remain meaningful.
- Which churches should have active QT inventory rows for the first operational month?
- Should `eaglet` inventory be created for all churches or only when stock exists?
- Should `retail_quantity` be stored or computed?
- Should `expected_inbound_quantity` be editable after actual inbound is recorded?
- What is the official rule for closing a QT month?
- Who can reopen or adjust a locked/closed month?
- Should legacy import continue after Phase 2, and if yes, how is it prevented from writing 2026-09 and later inventory rows?
- Does Line Bot / LIFF need to see current month inventory immediately after Phase 2, or only after Phase 3?

## 18. Reconciliation SQL For DBA Review

Run before migration:

```sql
SELECT order_status, finance_status, COUNT(*)::int
FROM qt_orders
GROUP BY order_status, finance_status
ORDER BY order_status, finance_status;

SELECT is_received, COUNT(*)::int
FROM qt_order_items
GROUP BY is_received
ORDER BY is_received;

SELECT movement_type, COUNT(*)::int, COALESCE(SUM(quantity), 0)::int AS quantity
FROM qt_inventory_movements
GROUP BY movement_type
ORDER BY movement_type;

SELECT issue_month, church_id, product_type, SUM(quantity)::int AS current_quantity
FROM qt_inventory_movements
GROUP BY issue_month, church_id, product_type
ORDER BY issue_month, church_id, product_type;

SELECT issue_month, church_id, product_type, SUM(quantity)::int AS current_quantity
FROM qt_inventory_movements
GROUP BY issue_month, church_id, product_type
HAVING SUM(quantity) < 0;

SELECT i.issue_month, o.church_id, o.product_type, COUNT(*)::int AS paid_unreceived_count
FROM qt_order_items i
JOIN qt_orders o ON o.order_id = i.order_id
WHERE o.finance_status = 'posted'
  AND o.order_status <> 'cancelled'
  AND NOT i.is_received
GROUP BY i.issue_month, o.church_id, o.product_type
ORDER BY i.issue_month, o.church_id, o.product_type;

SELECT COUNT(*)::int AS received_without_received_at
FROM qt_order_items
WHERE is_received
  AND received_at IS NULL;

SELECT COUNT(*)::int AS received_without_receiver
FROM qt_order_items
WHERE is_received
  AND receiver_member_id IS NULL;
```

## 19. Recommendation

Do not implement Phase 2 directly from the current movement table alone.

Recommended safe path:

1. Add `qt_inventory_monthly` as the lockable aggregate stock master.
2. Reuse `qt_inventory_movements` as append-only inventory log with new reference columns.
3. Add `qt_inventory_reservations` for PAID but unfulfilled order items.
4. Add `qt_inventory_transfers` for pending transfer lifecycle.
5. Backfill conservatively:
   - existing movement sum becomes initial Physical
   - Reserved starts at 0
   - Retail equals Physical
6. Treat paid/unreceived legacy rows as review candidates, not automatic truth.
7. Require `SELECT ... FOR UPDATE` in all inventory writes.
8. Keep Phase 1 notification/reporting unchanged.

## 20. Phase 2 Safety Decision

Phase 2 is not yet safe to implement automatically.

It can become safe after:

- DBA approves additive DDL and rollback SQL.
- Operations confirms historical reservation handling.
- Operations accepts 2026-09 as the first new-system operational month.
- Operations accepts 2026-08 and earlier as legacy / closed by default.
- Full DB backup and restore path are confirmed.
- Legacy QT import behavior is updated or blocked.
- `plan/qt/QT_LEGACY_DATA_MIGRATION_PLAN.md` is reviewed and accepted.
- A feature-flagged API/UI cutover plan is approved.
