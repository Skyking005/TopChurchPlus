# TopChurchPlus QT Phase 3B Scope Freeze

```text
Status: Draft / Planning Only
This document is not the source of truth.
Before Phase 3B implementation, Codex must verify actual code, database schema, API catalog, architecture documents, reconciliation results, and live PostgreSQL data.
```

Last updated: 2026-06-13

Related files:

- `plan/qt/QT_DOMAIN_REFACTOR_PLAN_V1.md`
- `plan/qt/QT_DBA_MIGRATION_REVIEW.md`
- `plan/qt/QT_LEGACY_DATA_MIGRATION_PLAN.md`
- `plan/qt/PHASE_2C_DESIGN_FREEZE.md`
- `plan/qt/PHASE_3A_RECONCILIATION.md`

## 1. Purpose

This document freezes the intended Phase 3B scope before any implementation.

Phase 3B is limited to Payment Boundary and Reservation Integration Boundary.

This document does not approve production code changes, schema changes, API changes, migration, fulfillment changes, Line Bot / LIFF changes, transfer changes, forecast changes, or legacy backfill.

## 2. Confirmed Phase 3B Risks

The following risks must remain visible before implementation:

1. Legacy `finance_status` mapping is not yet authoritative.
2. PAID integration may accidentally consume 2026-08 and earlier legacy data.
3. Reservation delta may already exist.
4. Audit before/after metadata must be defined before implementation.
5. Payment status update and reservation creation must happen in the same database transaction.
6. The 60 legacy paid-unfulfilled candidates must not be automatically backfilled.

## 3. Frozen Scope

Phase 3B is limited to:

- 2026-09 and later new-system QT data only.
- Payment Boundary.
- Reservation Integration Boundary.
- `PAID -> create reservation` transaction rules.
- `PENDING_APPROVAL` and `UNPAID` do not create reservations.
- `REJECT` does not release reservation because no reservation should have been occupied.
- Audit metadata specification.
- Rollback strategy.

Phase 3B must not include:

- fulfillment / pickup implementation
- reservation fulfilled transition
- Line Bot / LIFF ordering
- transfer / cross-church pickup
- forecast
- schema changes unless a separate approved migration task is created
- automatic legacy backfill

## 4. Data Boundary

### 4.1 Operational Month Boundary

Phase 3B applies only to QT data where:

```text
qt_month >= 202609
```

This includes:

- `qt_inventory_monthly.qt_month >= '202609'`
- related `qt_inventory_reservations`
- related `qt_inventory_movements`
- any future payment-boundary logic tied to new-system QT orders or order items for 2026-09 and later

### 4.2 Legacy Period Boundary

QT months through 2026-08 remain legacy period.

Phase 3B must not:

- create reservations from 2026-08 or earlier rows
- infer reservation need from legacy `finance_status = posted`
- convert the 60 paid-unfulfilled candidates into Reserved Inventory
- repair legacy data automatically
- let legacy import/sync overwrite 2026-09 and later inventory rows

### 4.3 Required Precondition

Before implementation, run or review Phase 3A reconciliation against live PostgreSQL or an approved staging copy.

If critical exceptions exist, Phase 3B write implementation must pause until DBA/operations either resolves them or explicitly accepts the risk.

## 5. Payment Boundary

### 5.1 Conceptual Payment States

Phase 3B should define a stable mapping before code:

| Conceptual State | Meaning | Reservation Effect |
| --- | --- | --- |
| `UNPAID` | Order exists but payment is not complete. | No reservation. |
| `PENDING_APPROVAL` | Payment proof or remittance is waiting for review. | No reservation. |
| `PAID` | Payment approval completed. | Create reservation inside the same transaction. |
| `REJECTED` | Payment proof was rejected before approval. | No release because no stock was occupied. |
| `CANCELLED` | Order cancelled. | Out of Phase 3B unless payment/reservation cancel is explicitly scoped later. |
| `REFUNDED` | Paid order refunded. | Out of Phase 3B unless refund/release is explicitly scoped later. |

### 5.2 Legacy `finance_status` Mapping Is Not Final

Existing values such as `unpaid`, `received`, and `posted` may map conceptually to UNPAID, PENDING_APPROVAL, and PAID, but Phase 3B must not treat this mapping as authoritative until confirmed.

Required confirmation:

1. Which legacy `finance_status` values are still written by current UI/API.
2. Which values apply to 2026-09 and later new-system orders.
3. Whether legacy rows remain read-only.
4. Whether `posted` can only be set by an explicit approval action.
5. Whether there is a distinguishable reject action or only a status reset.

## 6. Reservation Integration Boundary

### 6.1 Allowed Reservation Creation

Reservation creation is allowed only when all conditions are true:

1. QT month is 2026-09 or later.
2. Payment transition is explicitly approved into `PAID`.
3. The order or order item has no existing active reservation.
4. The target `qt_inventory_monthly` row exists.
5. The target inventory row has enough `retail_quantity`.
6. Phase 3A reconciliation has no blocking critical issue for the target inventory scope.
7. The operation can write reservation, inventory movement, and audit log in one transaction.

### 6.2 Forbidden Reservation Creation

Reservations must not be created for:

- `UNPAID`
- `PENDING_APPROVAL`
- `REJECTED`
- 2026-08 or earlier legacy rows
- the 60 legacy paid-unfulfilled candidates unless a separate approved legacy migration task exists
- Line Bot / LIFF orders in this phase
- manually inferred historical obligations

### 6.3 Reject Behavior

If payment is rejected before approval:

```text
PENDING_APPROVAL -> REJECTED or UNPAID
```

No reservation release is required because no reservation should have been created.

If a reservation exists for a rejected payment, that is an exception and must be handled as a reconciliation or rollback issue, not as normal Phase 3B behavior.

## 7. PAID To Reservation Transaction Rule

Future Phase 3B implementation must use a single database transaction.

Required transaction shape:

```text
BEGIN
  lock target order row
  lock target order item row when item-level reservation is used
  validate current payment state
  validate target payment state is PAID
  validate qt_month >= 202609
  validate no active reservation exists
  lock target qt_inventory_monthly row
  validate retail_quantity >= reservation quantity
  update payment state
  insert qt_inventory_reservations row with status = reserved
  update qt_inventory_monthly:
    reserved_quantity = reserved_quantity + quantity
    retail_quantity = retail_quantity - quantity
    physical_quantity unchanged
  insert qt_inventory_movements row linked to reservation_id
  insert audit_logs row with before/after metadata
COMMIT
```

Failure behavior:

- If any validation fails, rollback.
- If reservation insert fails, rollback payment state update.
- If inventory update fails, rollback payment state and reservation.
- If movement log insert fails, rollback the whole transaction.
- If audit log insert fails, rollback unless DBA/operations explicitly approves an alternate outbox pattern.

## 8. Audit Metadata Specification

Phase 3B audit log must capture enough information to reconstruct payment-to-reservation decisions.

Required audit action:

```text
qt.payment.approve.create_reservation
```

Required metadata:

| Field | Required | Notes |
| --- | --- | --- |
| `order_id` | yes | QT order id. |
| `order_item_id` | yes when item-level reservation is used | Needed for one active reservation per order item. |
| `inventory_id` | yes | Target `qt_inventory_monthly` row. |
| `reservation_id` | yes | Created reservation id. |
| `qt_month` | yes | Must be `>= 202609`. |
| `qt_type` | yes | `ADULT` or `CHILD`. |
| `church_id` | yes | Target inventory church. |
| `quantity` | yes | Reserved quantity. |
| `previous_payment_state` | yes | State before approval. |
| `next_payment_state` | yes | Should be `PAID`. |
| `inventory_before` | yes | Physical / Reserved / Retail before update. |
| `inventory_after` | yes | Physical / Reserved / Retail after update. |
| `operator_id` | yes | Staff/operator id if available. |
| `source` | yes | Admin UI, API, migration, or other controlled source. |
| `request_id` | recommended | For tracing API request. |

Sensitive payment proof details should not be copied into audit metadata. Use references to files or business ids when needed.

## 9. Rollback Strategy

### 9.1 Same-Transaction Rollback

Normal failure must rollback the full transaction:

- payment state update
- reservation creation
- Reserved/Retail inventory update
- movement row
- audit row

### 9.2 Post-Commit Rollback

If a committed approval must be reversed later, do not delete rows.

Required future pattern:

1. Create a compensating payment transition.
2. Release the reservation only if it is still `reserved`.
3. Restore Reserved/Retail inventory in a transaction.
4. Insert release movement.
5. Insert audit log with reason.

This reversal is not part of Phase 3B unless explicitly scoped.

### 9.3 Application Rollback

If Phase 3B deployment must be rolled back:

- disable payment-to-reservation write path
- keep reservation records already committed
- keep movement and audit logs
- run Phase 3A reconciliation to identify deltas
- do not drop schema or delete records

### 9.4 Legacy Protection During Rollback

Rollback must not:

- convert legacy 60 paid-unfulfilled candidates into reservations
- write 2026-08 or earlier rows into new inventory model
- rerun legacy QT import in a way that truncates or overwrites new-system data

## 10. Phase 3B Acceptance Criteria For Future Implementation

A future Phase 3B implementation can be accepted only when:

1. `UNPAID` does not create reservation.
2. `PENDING_APPROVAL` does not create reservation.
3. `REJECTED` does not release reservation because it never occupied inventory.
4. `PAID` creates reservation only for 2026-09 and later new-system QT data.
5. Payment state update and reservation creation occur in one transaction.
6. Physical Inventory remains unchanged during reservation creation.
7. Reserved Inventory increases by reservation quantity.
8. Retail Inventory decreases by reservation quantity.
9. Movement log is written.
10. Audit log includes before/after metadata.
11. Legacy 60 paid-unfulfilled candidates are not backfilled.
12. No fulfillment, Line Bot / LIFF, transfer, or forecast behavior is changed.

## 11. Suggested Small Implementation Slices

Recommended slice order:

### Slice 3B-1: Payment State Mapping Review

Scope:

- read actual code and DB values
- document mapping
- no writes

### Slice 3B-2: Internal Service Boundary

Scope:

- create or define a service function that accepts an already-approved payment transition
- validates 2026-09+ and inventory readiness
- does not expose new UI yet

### Slice 3B-3: Controlled Admin Approval Path

Scope:

- wire one explicit admin approval action to the service
- create reservation in one transaction
- no fulfillment/release/refund work

### Slice 3B-4: Verification And Reconciliation

Scope:

- run Phase 3A reconciliation after test approval
- verify audit and movement trace
- document result

## 12. Phase 3B Decision

Phase 3B may enter small-scope implementation only after:

1. Phase 3A reconciliation is reviewed.
2. Legacy `finance_status` mapping is confirmed for 2026-09 and later.
3. Audit metadata contract is accepted.
4. Rollback behavior is accepted.
5. Implementation slice is selected.

Default recommended first implementation slice:

```text
Slice 3B-1: Payment State Mapping Review
```
