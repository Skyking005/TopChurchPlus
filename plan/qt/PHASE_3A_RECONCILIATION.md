# TopChurchPlus QT Phase 3A Reconciliation

```text
Status: Draft / Planning Only
This document is not the source of truth.
Before implementation, Codex must verify actual code, database schema, API catalog, architecture documents, and live PostgreSQL data.
```

Last updated: 2026-06-13

Related files:

- `plan/qt/QT_DOMAIN_REFACTOR_PLAN_V1.md`
- `plan/qt/QT_MIGRATION_PLAN.md`
- `plan/qt/QT_DBA_MIGRATION_REVIEW.md`
- `plan/qt/QT_LEGACY_DATA_MIGRATION_PLAN.md`
- `plan/qt/PHASE_2B_READY_CHECK.md`
- `plan/qt/PHASE_2C_READY_CHECK.md`
- `plan/qt/PHASE_2C_DESIGN_FREEZE.md`

## 1. Purpose

Phase 3A establishes the read-only reconciliation plan for QT Inventory.

This phase is limited to:

- inventory consistency review
- exception detection design
- reporting design
- audit strategy
- Phase 3B scope recommendation

This phase does not change payment, fulfillment, Line Bot, transfer, forecast, schema, API, UI, or data.

## 2. Current Phase Boundary

Phase 2B is treated as complete.

Current known state:

- `qt_inventory_monthly` exists for the new monthly inventory model.
- `qt_inventory_reservations` exists for reservation records.
- Reservation creation increases Reserved Inventory and decreases Retail Inventory.
- Reservation release decreases Reserved Inventory and restores Retail Inventory.
- Physical Inventory is unchanged by reservation create/release.
- Reservation operations should write `qt_inventory_movements` and `audit_logs`.

Still out of scope:

- payment flow integration
- fulfillment / pickup inventory deduction
- Line Bot / LIFF Retail Inventory checks
- transfer / cross-church pickup
- forecast
- legacy paid-unfulfilled auto-backfill

## 3. Reconciliation Rule

### 3.1 Authoritative Inventory Invariant

For 2026-09 and later QT inventory, the authoritative invariant is:

```text
Physical Inventory = Reserved Inventory + Retail Inventory
```

The invariant must be evaluated per inventory scope:

```text
qt_month + qt_type + church_id
```

### 3.2 Inventory Field Meaning

| Field | Meaning |
| --- | --- |
| `physical_quantity` | Total physical stock currently owned by the church for that QT month/type. |
| `reserved_quantity` | Stock reserved for paid but not fulfilled orders. |
| `retail_quantity` | Stock available for direct sale or future member-facing purchase. |

### 3.3 Reservation Cross-Check

Monthly Reserved Inventory should reconcile with active reservation rows:

```text
qt_inventory_monthly.reserved_quantity
= SUM(qt_inventory_reservations.quantity WHERE status = 'reserved')
```

This is a read-only check. Phase 3A must not repair differences.

### 3.4 Movement Log Cross-Check

Inventory logs should support traceability, not replace the monthly aggregate.

Phase 3A should compare:

- reservation creation movements against active reservation rows
- release movements against released reservation rows
- future fulfillment movements against fulfilled reservation rows

Because Phase 2B does not implement fulfillment, missing fulfillment movement rows are expected until later phases unless a reservation is already marked `fulfilled`.

## 4. Exception Matrix

| Exception Code | Condition | Severity | Meaning | Phase 3A Action |
| --- | --- | --- | --- | --- |
| `INV_NEG_PHYSICAL` | `physical_quantity < 0` | Critical | Physical stock is impossible. | Report only; block Phase 3B until resolved. |
| `INV_NEG_RESERVED` | `reserved_quantity < 0` | Critical | Reserved stock is impossible. | Report only; block Phase 3B until resolved. |
| `INV_NEG_RETAIL` | `retail_quantity < 0` | Critical | Retail stock is oversold or over-reserved. | Report only; block Phase 3B until resolved. |
| `INV_SUM_OVER_PHYSICAL` | `reserved_quantity + retail_quantity > physical_quantity` | Critical | Inventory invariant is broken. | Report only; block Phase 3B until resolved. |
| `INV_SUM_UNDER_PHYSICAL` | `reserved_quantity + retail_quantity < physical_quantity` | Warning | Physical stock is not fully classified as reserved or retail. | Report for review. |
| `RES_NO_INVENTORY` | Reservation has no matching `qt_inventory_monthly` row. | Critical | Reservation cannot be tied to stock. | Report only; block payment integration. |
| `RES_NO_ORDER` | Reservation has no matching order where order reference is required. | High | Reservation may be orphaned. | Report for manual review. |
| `RES_NO_ORDER_ITEM` | Reservation has no matching order item where item reference is expected. | High | Fulfillment cannot safely target an item. | Report for manual review. |
| `RES_BAD_STATUS` | Reservation status is outside `reserved`, `released`, `fulfilled`, `cancelled`. | Critical | Reservation lifecycle is invalid. | Report only; block lifecycle writes. |
| `RES_DUP_ACTIVE_ITEM` | More than one active `reserved` reservation exists for one order item. | Critical | Same item may hold stock twice. | Report only; block Phase 3B. |
| `RES_ACTIVE_ON_RECEIVED_ITEM` | Reservation is `reserved` but related order item is already received. | High | Fulfillment and reservation state diverged. | Report for manual review. |
| `RES_FULFILLED_NO_MOVEMENT` | Reservation is `fulfilled` but no fulfillment movement exists. | High | Audit trail is incomplete. | Report for manual review. |
| `RES_RELEASED_NO_MOVEMENT` | Reservation is `released` but no release movement exists. | Medium | Audit trail may be incomplete. | Report for manual review. |
| `MOV_NO_RESERVATION` | Movement references a reservation id that does not exist. | High | Inventory log has broken reference. | Report for manual review. |
| `LEGACY_NEW_MODEL_MIX` | 2026-08 or earlier data appears in new inventory model without explicit approval. | High | Legacy data may pollute new stock model. | Report only; block automatic backfill. |

## 5. Read-Only Detection Queries

These SQL examples are for DBA/reconciliation design. They must not be executed as migration or repair scripts.

### 5.1 Negative And Broken Invariant

```sql
SELECT
  inventory_id,
  qt_month,
  qt_type,
  church_id,
  physical_quantity,
  reserved_quantity,
  retail_quantity,
  CASE
    WHEN physical_quantity < 0 THEN 'INV_NEG_PHYSICAL'
    WHEN reserved_quantity < 0 THEN 'INV_NEG_RESERVED'
    WHEN retail_quantity < 0 THEN 'INV_NEG_RETAIL'
    WHEN reserved_quantity + retail_quantity > physical_quantity THEN 'INV_SUM_OVER_PHYSICAL'
    WHEN reserved_quantity + retail_quantity < physical_quantity THEN 'INV_SUM_UNDER_PHYSICAL'
    ELSE 'OK'
  END AS reconciliation_status
FROM qt_inventory_monthly
WHERE physical_quantity < 0
   OR reserved_quantity < 0
   OR retail_quantity < 0
   OR reserved_quantity + retail_quantity <> physical_quantity;
```

### 5.2 Reserved Quantity Versus Active Reservations

```sql
SELECT
  i.inventory_id,
  i.qt_month,
  i.qt_type,
  i.church_id,
  i.reserved_quantity,
  COALESCE(SUM(r.quantity) FILTER (WHERE r.status = 'reserved'), 0)::int AS active_reservation_quantity,
  i.reserved_quantity - COALESCE(SUM(r.quantity) FILTER (WHERE r.status = 'reserved'), 0)::int AS reservation_delta
FROM qt_inventory_monthly i
LEFT JOIN qt_inventory_reservations r ON r.inventory_id = i.inventory_id
GROUP BY i.inventory_id, i.qt_month, i.qt_type, i.church_id, i.reserved_quantity
HAVING i.reserved_quantity <> COALESCE(SUM(r.quantity) FILTER (WHERE r.status = 'reserved'), 0)::int;
```

### 5.3 Reservation Without Inventory

```sql
SELECT r.*
FROM qt_inventory_reservations r
LEFT JOIN qt_inventory_monthly i ON i.inventory_id = r.inventory_id
WHERE i.inventory_id IS NULL;
```

### 5.4 Reservation Without Order Or Order Item

```sql
SELECT r.*
FROM qt_inventory_reservations r
LEFT JOIN qt_orders o ON o.order_id = r.order_id
LEFT JOIN qt_order_items oi ON oi.order_item_id = r.order_item_id
WHERE o.order_id IS NULL
   OR (r.order_item_id IS NOT NULL AND oi.order_item_id IS NULL);
```

### 5.5 Reservation Status Exception

```sql
SELECT r.*
FROM qt_inventory_reservations r
WHERE r.status NOT IN ('reserved', 'released', 'fulfilled', 'cancelled');
```

### 5.6 Duplicate Active Reservation For One Order Item

```sql
SELECT
  order_item_id,
  COUNT(*)::int AS active_reservation_count,
  SUM(quantity)::int AS active_quantity
FROM qt_inventory_reservations
WHERE status = 'reserved'
  AND order_item_id IS NOT NULL
GROUP BY order_item_id
HAVING COUNT(*) > 1;
```

### 5.7 Active Reservation On Received Item

```sql
SELECT
  r.reservation_id,
  r.order_id,
  r.order_item_id,
  r.inventory_id,
  r.quantity,
  oi.is_received,
  oi.received_at
FROM qt_inventory_reservations r
JOIN qt_order_items oi ON oi.order_item_id = r.order_item_id
WHERE r.status = 'reserved'
  AND oi.is_received = true;
```

### 5.8 Reservation Movement Traceability

```sql
SELECT
  r.reservation_id,
  r.status,
  r.inventory_id,
  r.order_id,
  r.order_item_id,
  r.quantity,
  COUNT(m.movement_id)::int AS movement_count,
  MAX(m.created_at) AS last_movement_at
FROM qt_inventory_reservations r
LEFT JOIN qt_inventory_movements m ON m.reservation_id = r.reservation_id
GROUP BY r.reservation_id, r.status, r.inventory_id, r.order_id, r.order_item_id, r.quantity;
```

### 5.9 Legacy Boundary Check

```sql
SELECT *
FROM qt_inventory_monthly
WHERE qt_month < '202609';
```

## 6. Inventory Health Design

Future management UI should expose read-only inventory health before any corrective action exists.

### 6.1 Health Levels

| Level | Label | Meaning |
| --- | --- | --- |
| `healthy` | Healthy | No reconciliation exceptions. |
| `warning` | Warning | Non-blocking mismatch or missing traceability. |
| `critical` | Critical | Negative stock, broken invariant, orphan reservation, or duplicate active reservation. |
| `legacy_review` | Legacy Review | Legacy period or 60-candidate issue requires human review. |

### 6.2 Suggested KPI Cards

Inventory Health dashboard should show:

- total monthly inventory rows
- healthy rows
- warning rows
- critical rows
- active reservations
- reservation delta count
- movement trace exceptions
- legacy review candidates

### 6.3 Suggested Table Columns

Reconciliation Status table:

- QT month
- QT type
- church
- physical quantity
- reserved quantity
- retail quantity
- active reservation quantity
- reservation delta
- movement count
- last movement time
- exception code
- severity
- recommended manual action

### 6.4 Drill-Down Design

Each exception row should drill down to:

- monthly inventory row
- related reservation rows
- related movement rows
- related order / order item references
- audit log references when available

The UI must remain read-only in Phase 3A.

## 7. Reconciliation Status Design

Recommended status calculation:

```text
critical if:
  physical < 0
  reserved < 0
  retail < 0
  reserved + retail > physical
  reservation has no inventory
  duplicate active reservation exists
  reservation status is invalid

warning if:
  reserved + retail < physical
  reserved quantity differs from active reservation sum
  released/fulfilled reservation lacks movement trace
  reservation lacks optional order item reference

legacy_review if:
  row belongs to 2026-08 or earlier
  row relates to the legacy 60 paid-unfulfilled candidates

healthy if:
  no exception exists
```

## 8. Audit Strategy

Phase 3A does not modify audit behavior. It defines what future phases must verify.

### 8.1 Reservation Created

Future reservation creation should have:

- `qt_inventory_reservations` row with `status = 'reserved'`
- `qt_inventory_monthly` Reserved/Retail update
- `qt_inventory_movements` row linked by `reservation_id`
- `audit_logs` entry with action such as `qt.inventory.reservation.create`

Audit metadata should include:

- `inventory_id`
- `reservation_id`
- `order_id`
- `order_item_id`
- `qt_month`
- `qt_type`
- `church_id`
- `quantity`
- before/after Reserved/Retail values

### 8.2 Reservation Released

Future reservation release should have:

- reservation status changed to `released`
- `released_at`
- `released_by_staff_id`
- monthly Reserved/Retail reversal
- movement row linked by `reservation_id`
- audit log action such as `qt.inventory.reservation.release`

Audit metadata should include:

- release reason
- before/after Reserved/Retail values
- linked order and order item

### 8.3 Reservation Fulfilled

Future reservation fulfillment should have:

- reservation status changed to `fulfilled`
- `fulfilled_at`
- related order item received fields updated
- monthly Physical/Reserved update
- fulfillment movement linked by `reservation_id` and `order_item_id`
- audit log action such as `qt.inventory.reservation.fulfill`

Audit metadata should include:

- fulfillment church
- operator
- before/after Physical/Reserved/Retail values
- whether fulfillment was same-church or cross-church

Cross-church fulfillment must wait for transfer design and must not be added in Phase 3A.

## 9. Phase 3B Recommended Scope

Recommended Phase 3B should be narrow and selected only after Phase 3A reconciliation is reviewed.

Preferred Phase 3B:

- Payment Boundary And Reservation Integration for 2026-09 and later only.
- Define exact mapping from legacy `finance_status` to target payment states.
- Create reservation only when payment approval is explicitly completed.
- Keep fulfillment, Line Bot, transfer, and forecast out of scope.

Alternative Phase 3B:

- If payment boundary is not yet ready, implement read-only reconciliation API/report first.
- Still no writes to payment, fulfillment, Line Bot, transfer, or forecast.

## 10. Phase 3B Risks

| Risk | Severity | Mitigation Before Phase 3B |
| --- | --- | --- |
| Payment state is legacy-oriented. | High | Define mapping and cutover month before code. |
| `PAID` integration may reserve legacy rows accidentally. | High | Restrict to 2026-09 and later unless explicitly approved. |
| Reservation delta may already exist. | High | Run Phase 3A reconciliation and resolve critical exceptions first. |
| Audit log may not fully capture before/after values. | Medium | Define audit metadata contract before write implementation. |
| Payment approval and reservation could partially succeed. | High | Use one transaction with rollback. |
| Legacy 60 paid-unfulfilled candidates may be mistaken for active obligations. | High | Keep manual review only. |
| Fulfillment pressure may cause scope creep. | Medium | Keep Phase 3B payment-only unless a separate task is approved. |

## 11. Phase 3A Acceptance Criteria

Phase 3A is complete when:

1. Reconciliation rules are documented.
2. Exception matrix is documented.
3. Inventory Health design is documented.
4. Audit strategy is documented.
5. Phase 3B recommended scope is documented.
6. No production code was modified.
7. No schema was modified.
8. No API was modified.
9. No migration was executed.

## 12. Phase 3A Decision

Phase 3A can be considered complete after this plan is reviewed.

Phase 3B should not begin until:

1. Phase 3A reconciliation has been run against live PostgreSQL or an approved staging copy.
2. Critical exceptions are either resolved or accepted with written DBA/operations approval.
3. Phase 3B scope is selected.
4. Legacy 60 paid-unfulfilled candidates remain protected from automatic backfill.
5. Legacy import/sync protection is reconfirmed.
