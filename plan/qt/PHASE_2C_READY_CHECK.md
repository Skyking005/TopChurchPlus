# TopChurchPlus QT Phase 2C Ready Check

```text
Status: Draft / Planning Only
This document is not the source of truth.
Before Phase 2C implementation, Codex must verify actual code, database schema, API catalog, architecture documents, and live PostgreSQL data.
```

Last updated: 2026-06-13

Related files:

- `plan/qt/QT_DOMAIN_REFACTOR_PLAN_V1.md`
- `plan/qt/QT_MIGRATION_PLAN.md`
- `plan/qt/QT_DBA_MIGRATION_REVIEW.md`
- `plan/qt/QT_LEGACY_DATA_MIGRATION_PLAN.md`
- `plan/qt/PHASE_2B_READY_CHECK.md`
- `database/20260613_qt_phase2a_inventory_foundation.sql`
- `database/20260613_qt_phase2b_inventory_reservations.sql`

## 1. Phase 2B Completion Summary

Phase 2B is treated as completed for planning purposes.

Completed foundation:

- `qt_inventory_reservations` exists.
- Reservation API/service foundation exists.
- Reservation creation updates Reserved / Retail inventory in a transaction.
- Reservation release restores Reserved / Retail inventory in a transaction.
- Physical Inventory remains unchanged during reservation / release.
- Reservation operations write inventory log and audit log.

Explicitly not completed in Phase 2B:

- Payment flow integration.
- Fulfillment / pickup inventory deduction.
- Line Bot / LIFF order inventory checks.
- Transfer / cross-church pickup.
- Forecast engine.

## 2. Required Phase 2C Risks

### Risk 1: Payment Flow Is Not Connected To Reservation

Payment flow has not been connected to `qt_inventory_reservations`.

Phase 2C must not connect directly to the `PAID` state.

If Phase 2C needs to connect payment approval to reservation, the payment status transition boundary must be defined first, including:

- which legacy `finance_status` values map to the new payment states
- whether Phase 2C acts only on post-cutover orders
- whether existing legacy rows are read-only
- which transaction owns the combined payment-status update and reservation creation
- rollback behavior if reservation creation fails after payment approval begins

### Risk 2: Fulfillment Does Not Deduct Physical Inventory

Pickup / fulfillment has not yet been refactored.

Current Phase 2B reservation behavior does not:

- deduct Physical Inventory
- mark `qt_inventory_reservations.status = 'fulfilled'`
- update QT order item received state
- create fulfillment movement logs

Any Phase 2C fulfillment design must lock both the order item and the target inventory row before changing inventory.

### Risk 3: Legacy 60 Paid-Unfulfilled Candidates Are Still Manual Review Only

The 60 legacy paid-but-unfulfilled candidates must not be automatically backfilled.

Phase 2C must keep these rows as manual review candidates unless operations explicitly confirms a migration method.

Forbidden behavior:

- automatically converting the 60 rows into Reserved Inventory
- inferring active obligations from old `finance_status` alone
- importing 2026-08 or earlier legacy rows into the new 2026-09 inventory model without approval

### Risk 4: Line Bot / LIFF Still Does Not Use Retail Inventory

Line Bot / LIFF QT ordering still does not use the new Retail Inventory model.

Phase 2C must not assume member-facing QT ordering is inventory-safe.

Any future Line Bot / LIFF ordering work must:

- use Retail Inventory for current-month availability
- respect Identity Boundary v2
- resolve LINE User to Pastoral Member through approved mapping
- avoid using backend account roles for member-facing eligibility

### Risk 5: Transfer / Cross-Church Pickup Is Not Implemented

Transfer and cross-church pickup remain out of scope.

Phase 2C must not smuggle in:

- `qt_inventory_transfers`
- pending transfer workflow
- cross-church pickup logic
- actual pickup church deduction rules
- retail deduction from actual pickup church

Transfer should remain a separate, explicitly approved phase.

## 3. Phase 2C Recommended Scope

Phase 2C should be constrained to one of the following narrow tracks.

Recommended safest track:

- Design and verify the fulfillment boundary without changing payment flow.
- Add read-only reconciliation views or reports for reservations.
- Confirm how reservations will become fulfilled in a later implementation.

Alternative track if explicitly approved before implementation:

- Define a payment status boundary document before writing code.
- Only then add a controlled payment-to-reservation transaction.

Phase 2C should remain small and should not combine payment, fulfillment, Line Bot ordering, and transfer in one patch.

## 4. Phase 2C Must Not Touch

Phase 2C must not modify or implement:

- existing QT payment flow unless a payment boundary document is approved first
- existing QT pickup / fulfill flow unless the task explicitly scopes fulfillment only
- Line Bot / LIFF QT ordering
- transfer or cross-church pickup
- forecast engine
- automatic legacy paid-unfulfilled backfill
- 2026-08 or earlier legacy inventory conversion
- administrative supply inventory
- DNS, NAS firewall, reverse proxy, LINE Developer Console, or production Apps Script deployment settings

## 5. Required Manual Confirmation Before Phase 2C

Before Phase 2C implementation, confirm:

1. Whether Phase 2C is intended to design fulfillment, payment boundary, or reconciliation only.
2. Whether payment integration is explicitly allowed. Default answer is no.
3. Whether fulfillment integration is explicitly allowed. Default answer is no unless separately scoped.
4. Whether legacy 60 paid-unfulfilled candidates remain manual review only. Default answer is yes.
5. Whether Line Bot / LIFF QT ordering remains out of scope. Default answer is yes.
6. Whether transfer / cross-church pickup remains out of scope. Default answer is yes.

## 6. Readiness Decision

Phase 2B is complete.

Phase 2C can be planned next, but implementation should start only after its exact narrow scope is selected.

Default allowed Phase 2C direction:

- planning and reconciliation only
- or fulfillment design only

Default blocked Phase 2C direction:

- direct PAID-state integration
- Line Bot / LIFF ordering
- Transfer / cross-church pickup
- Forecast
- automatic legacy backfill
