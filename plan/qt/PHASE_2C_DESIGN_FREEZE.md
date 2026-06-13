# TopChurchPlus QT Phase 2C Design Freeze

```text
Status: Draft / Planning Only
This document is not the source of truth.
Before Phase 3 implementation, Codex must verify actual code, database schema, API catalog, architecture documents, and live PostgreSQL data.
```

Last updated: 2026-06-13

Related files:

- `plan/qt/QT_DOMAIN_REFACTOR_PLAN_V1.md`
- `plan/qt/QT_MIGRATION_PLAN.md`
- `plan/qt/QT_DBA_MIGRATION_REVIEW.md`
- `plan/qt/QT_LEGACY_DATA_MIGRATION_PLAN.md`
- `plan/qt/PHASE_2B_READY_CHECK.md`
- `plan/qt/PHASE_2C_READY_CHECK.md`

## 1. Purpose

This document freezes the Phase 2C design boundary for QT payment, fulfillment, reservation lifecycle, and inventory reconciliation.

Phase 2C Design Freeze is allowed.

Phase 2C Implementation is not allowed by this document.

This file must be used as the handoff between the completed Phase 2B reservation foundation and future Phase 3 implementation tasks.

## 2. Confirmed Risks

The following risks are confirmed and must remain visible before any implementation:

1. Payment flow is not connected to reservation.
2. Fulfillment flow does not deduct Physical Inventory.
3. Reservation records are not yet converted to `fulfilled`.
4. The 60 legacy paid-unfulfilled candidates must not be automatically backfilled.
5. Line Bot / LIFF ordering does not yet use Retail Inventory.
6. Transfer / cross-church pickup is not implemented.

## 3. Phase 2C Design Freeze Scope

This phase is limited to design only:

- Reconciliation Design
- Fulfillment Boundary Design
- Payment Boundary Design
- Inventory Lifecycle Design

Explicitly out of scope:

- production code changes
- migration
- schema changes
- API changes
- UI changes
- Line Bot changes
- fulfillment implementation
- payment implementation
- transfer implementation
- forecast implementation

## 4. Payment Lifecycle Boundary

### 4.1 Current Boundary

Current QT payment state is represented by legacy fields such as `qt_orders.finance_status`.

Phase 2B did not connect payment approval to reservation creation.

Therefore, future implementation must not assume that an existing `PAID` or `posted`-equivalent value already owns a valid reservation.

### 4.2 Target Boundary

Payment lifecycle should be treated as a separate domain boundary until explicitly connected.

Target conceptual states:

| Conceptual State | Meaning | Inventory Effect |
| --- | --- | --- |
| `UNPAID` | Order exists but payment is not complete. | No reservation. |
| `PENDING_APPROVAL` | Remittance or payment proof is waiting for review. | No reservation. |
| `PAID` | Payment is approved. | May create reservation only inside an approved payment-to-reservation transaction. |
| `PAYMENT_REJECTED` | Payment review failed. | No reservation. |
| `REFUNDED` | Payment reversed after approval. | Must release reservation if still active. |

### 4.3 Frozen Rule

Phase 3 must not directly connect legacy `finance_status = posted` to `qt_inventory_reservations` without a payment boundary implementation plan.

Before any payment implementation, define:

1. legacy `finance_status` to target payment-state mapping
2. whether Phase 3 applies only to 2026-09 and later orders
3. whether 2026-08 and earlier rows are read-only
4. who owns payment approval transaction boundaries
5. what happens if payment status succeeds but reservation creation fails
6. what happens if reservation creation succeeds but audit log insert fails
7. rollback and compensation rules

### 4.4 Required Transaction Shape

Future payment approval that creates reservation must be a single database transaction:

```text
BEGIN
  lock order row
  validate payment transition
  lock inventory row
  validate retail quantity
  update payment state
  create reservation
  update reserved / retail inventory
  insert inventory movement
  insert audit log
COMMIT
```

If any step fails, the transaction must rollback.

## 5. Fulfillment Lifecycle Boundary

### 5.1 Current Boundary

Current fulfillment data exists through fields such as:

- `qt_order_items.is_received`
- `qt_order_items.received_at`
- `qt_order_items.receiver_member_id`

Phase 2B did not change fulfillment behavior.

Current fulfillment does not:

- deduct Physical Inventory
- reduce Reserved Inventory
- set reservation status to `fulfilled`
- write fulfillment-specific movement logs
- create transfer rows

### 5.2 Target Boundary

Fulfillment means the QT was physically handed out.

Target fulfillment must:

1. lock the order item
2. reject duplicate fulfillment
3. find the active reservation when the item was reserved
4. lock the related inventory row
5. deduct Physical Inventory
6. deduct Reserved Inventory if fulfilling a reserved order
7. mark reservation as `fulfilled`
8. mark order item as received
9. insert inventory movement
10. insert audit log

### 5.3 Frozen Rule

Phase 3 fulfillment implementation must not be mixed with payment approval implementation unless explicitly scoped and reviewed.

Same-church fulfillment and cross-church fulfillment must be separated.

Phase 3 should implement same-church fulfillment first.

Cross-church fulfillment remains blocked until transfer design is explicitly approved.

### 5.4 Required Transaction Shape

Future same-church fulfillment should use this transaction shape:

```text
BEGIN
  lock order item row
  reject already fulfilled item
  lock active reservation row when present
  lock inventory row
  validate physical and reserved quantity
  update order item received fields
  update reservation to fulfilled
  update physical / reserved / retail inventory
  insert inventory movement
  insert audit log
COMMIT
```

For reserved fulfillment:

```text
physical_quantity = physical_quantity - fulfilled_quantity
reserved_quantity = reserved_quantity - fulfilled_quantity
retail_quantity remains unchanged
```

For non-reserved retail sale fulfillment:

```text
physical_quantity = physical_quantity - fulfilled_quantity
reserved_quantity remains unchanged
retail_quantity = retail_quantity - fulfilled_quantity
```

## 6. Reservation Lifecycle

### 6.1 Current Phase 2B Behavior

Phase 2B reservation behavior:

- creates `qt_inventory_reservations`
- increases Reserved Inventory
- decreases Retail Inventory
- keeps Physical Inventory unchanged
- writes `qt_inventory_movements`
- writes `audit_logs`

Release behavior:

- decreases Reserved Inventory
- restores Retail Inventory
- keeps Physical Inventory unchanged
- writes movement and audit logs

### 6.2 Target Reservation States

| Status | Meaning | Allowed Next States |
| --- | --- | --- |
| `reserved` | Stock is held for a paid but unfulfilled order. | `fulfilled`, `released`, `cancelled` |
| `fulfilled` | Reserved stock was physically handed out. | terminal |
| `released` | Reservation was released before fulfillment. | terminal |
| `cancelled` | Reservation was voided due to cancellation or rollback policy. | terminal |

### 6.3 Frozen Rules

1. A reservation must not exist for `UNPAID` or `PENDING_APPROVAL` orders.
2. A reservation must not be inferred from legacy `posted` rows without explicit migration approval.
3. Only one active `reserved` reservation may exist for the same order item.
4. `fulfilled` reservation must have a matching fulfillment movement.
5. `released` reservation must have a matching release movement.
6. Reservation updates must always happen with an inventory row lock.
7. Legacy 60 paid-unfulfilled candidates remain manual review only.

## 7. Inventory Lifecycle Design

### 7.1 Authoritative Invariant

For 2026-09 and later QT inventory:

```text
Physical Inventory = Reserved Inventory + Retail Inventory
```

### 7.2 Lifecycle Events

| Event | Physical | Reserved | Retail | Notes |
| --- | ---: | ---: | ---: | --- |
| Actual inbound | +N | no change | +N | Increases physical stock available for allocation or sale. |
| Reservation create | no change | +N | -N | Only after approved payment boundary. |
| Reservation release | no change | -N | +N | Used for cancel/refund before fulfillment. |
| Reserved fulfillment | -N | -N | no change | Physical handout of previously reserved stock. |
| Retail sale fulfillment | -N | no change | -N | Direct sale from retail inventory. |
| Adjustment increase | +N | no change unless specified | +N by default | Requires note and audit. |
| Adjustment decrease | -N | no change unless specified | -N by default | Must not break invariant or go negative. |

### 7.3 Frozen Rules

1. All inventory-changing actions must lock `qt_inventory_monthly`.
2. All inventory-changing actions must write `qt_inventory_movements`.
3. High-risk actions must write `audit_logs`.
4. New inventory logic applies to 2026-09 and later.
5. 2026-08 and earlier remains legacy by default.
6. Administrative supply inventory must not be affected.

## 8. Inventory Reconciliation Flow

### 8.1 Purpose

Reconciliation compares monthly inventory aggregate rows, reservation rows, movement rows, and order item fulfillment state.

The goal is to detect mismatch before Phase 3 implementation changes payment or fulfillment behavior.

### 8.2 Required Reconciliation Checks

Phase 3 should begin with read-only reconciliation checks:

1. `qt_inventory_monthly.physical_quantity = reserved_quantity + retail_quantity`
2. sum of active `qt_inventory_reservations.quantity` equals monthly `reserved_quantity`
3. no active reservation exists for a fulfilled order item
4. no fulfilled reservation lacks a fulfillment movement
5. no released reservation lacks a release movement
6. no negative physical, reserved, or retail quantity exists
7. no 2026-08 or earlier legacy row appears in new inventory tables unless explicitly approved
8. no duplicated active reservation exists for one order item
9. no Line Bot / LIFF order has bypassed Retail Inventory checks after cutover

### 8.3 Reconciliation Output

Recommended read-only report fields:

- `qt_month`
- `qt_type`
- `church_id`
- `physical_quantity`
- `reserved_quantity`
- `retail_quantity`
- `active_reservation_quantity`
- `reservation_delta`
- `movement_count`
- `last_movement_at`
- `issue_count`
- `issue_level`

### 8.4 Frozen Rule

Reconciliation is allowed as design or read-only planning.

Reconciliation must not repair data automatically in Phase 2C Design Freeze.

Any future auto-repair or compensation script requires DBA approval, backup, and rollback plan.

## 9. Phase 3 Suggested Split

Phase 3 should be split into small, separately verifiable tasks.

### Phase 3A: Read-Only Reconciliation

Scope:

- build reconciliation SQL/API/report
- no writes
- no payment, fulfillment, Line Bot, or transfer changes

Acceptance:

- mismatch report identifies inventory, reservation, and movement inconsistencies
- report is safe to run repeatedly

### Phase 3B: Payment Boundary And Reservation Integration

Scope:

- define and implement payment transition boundary
- connect approved payment to reservation creation for 2026-09 and later only
- no fulfillment changes

Acceptance:

- `UNPAID` and `PENDING_APPROVAL` do not reserve inventory
- approved payment creates reservation in one transaction
- failure rolls back payment state and reservation changes

### Phase 3C: Same-Church Fulfillment

Scope:

- fulfill reserved same-church order item
- deduct Physical and Reserved
- mark reservation fulfilled
- no cross-church logic

Acceptance:

- duplicate fulfillment is blocked
- physical/reserved/retail invariant holds
- fulfillment movement and audit log are written

### Phase 3D: Retail Inventory Check For Line Bot / LIFF

Scope:

- make member-facing QT ordering check Retail Inventory
- preserve Identity Boundary v2
- no transfer or cross-church logic

Acceptance:

- current-month QT cannot be sold when Retail Inventory is 0
- LINE User is mapped to Pastoral Member through approved mapping

### Phase 3E: Transfer / Cross-Church Pickup

Scope:

- design and implement pending transfer lifecycle
- support cross-church pickup only after transfer table/workflow is approved

Acceptance:

- cross-church pickup does not consume the actual pickup church's Reserved Inventory
- pending transfer is created in the same transaction

### Phase 3F: Forecast

Scope:

- purchasing forecast and next-month demand
- isolated from payment/fulfillment writes

Acceptance:

- forecast does not mutate inventory
- paid future orders are counted according to approved payment boundary

## 10. Phase 3 Risk Assessment

| Risk | Severity | Required Mitigation |
| --- | --- | --- |
| Payment approval and reservation creation can become inconsistent. | High | Use one transaction and define payment boundary before code. |
| Fulfillment can double-deduct inventory. | High | Lock order item and inventory row; reject duplicate fulfillment. |
| Legacy paid-unfulfilled rows may pollute new stock. | High | Keep 60 candidates manual review only. |
| Line Bot / LIFF can oversell current-month QT. | High | Require Retail Inventory check before member-facing order creation. |
| Cross-church pickup can consume reserved stock incorrectly. | High | Keep transfer separate until approved. |
| Reconciliation may discover mismatches after production writes. | Medium | Start Phase 3 with read-only reconciliation. |
| Legacy import/sync may overwrite new data. | High | Confirm legacy import isolation before write phases. |
| Audit and movement logs may diverge. | Medium | Write both inside the same transaction where possible. |

## 11. Phase 2C Freeze Decision

Phase 2C Design Freeze is complete when this document is accepted.

Phase 3 is not automatically approved by this document.

Before Phase 3 implementation, select exactly one Phase 3 slice and verify:

1. implementation scope
2. touched files
3. migration requirement
4. rollback strategy
5. read-only reconciliation baseline
6. manual confirmation for legacy 60 paid-unfulfilled candidates
7. legacy import/sync protection

Default recommendation:

Start Phase 3 with `Phase 3A: Read-Only Reconciliation`.
