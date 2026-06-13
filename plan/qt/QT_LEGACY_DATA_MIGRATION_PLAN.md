# TopChurchPlus QT Legacy Data Migration Plan

```text
Status: Draft / Planning Only
This document is not the source of truth.
Before implementation, Codex must verify actual code, database schema, API catalog, architecture documents, and live PostgreSQL data.
```

Last updated: 2026-06-13

Related planning documents:

- `plan/qt/QT_DOMAIN_REFACTOR_PLAN_V1.md`
- `plan/qt/QT_MIGRATION_PLAN.md`
- `plan/qt/QT_DBA_MIGRATION_REVIEW.md`

## 1. Purpose

This document defines how legacy QT data should be reviewed, isolated, and safely migrated around the Phase 2 QT Inventory Model cutover.

The goal is to protect the new QT Inventory Model from incomplete historical data while preserving legacy records for history, reconciliation, and manual operations review.

This file is a planning document only. It does not create schema, execute migration, change API behavior, or modify UI.

## 2. Migration Boundary

Official boundary:

- 2026-09 is the first official operational QT month for the new QT Inventory Model.
- 2026-08 and earlier is the legacy period.
- Legacy period data must not be used to automatically establish 2026-09 stock.
- Legacy period data does not require full Physical / Reserved / Retail reconstruction.
- Legacy period data is mainly retained for historical query, reconciliation, and manual confirmation.

Inventory invariant boundary:

```text
Physical Inventory = Reserved Inventory + Retail Inventory
```

- This invariant is authoritative for 2026-09 and later.
- This invariant is not retroactively required for 2026-08 and earlier.

## 3. Data Categories

### Legacy QT Inventory

Known sources:

- `qt_inventory_movements`
- `database/20260605_qt_inventory_schema.sql`
- `database/qt_import/generated_qt_import.sql`

Treatment:

- Preserve as legacy stock reference and movement history.
- Do not assume the movement sum is complete historical Physical Inventory.
- Do not use legacy movement rows to infer all prior fulfillment activity.

### Legacy QT Orders

Known tables:

- `qt_orders`
- `qt_order_items`
- `qt_payment_types`

Treatment:

- Preserve for query, reporting, and reconciliation.
- Do not assume current legacy status values map cleanly to the new order state machine without DBA and operations review.

### Legacy Paid But Unfulfilled Orders

Known DBA review result:

- 60 paid/unreceived candidate items were identified.

Treatment:

- Do not automatically convert all 60 rows into Reserved Inventory.
- Export these rows as a manual verification list.
- Only manually confirmed obligations may be migrated into the new model.
- Unconfirmed rows remain legacy reference only.

### Legacy Pickup Records

Known fields:

- `qt_order_items.is_received`
- `qt_order_items.received_at`
- `qt_order_items.receiver_member_id`

Treatment:

- Preserve for historical pickup reporting.
- Do not backfill historical inventory deductions from these rows in Phase 2.
- Some received rows lack complete received timestamp or receiver data; these require reconciliation rather than automatic stock logic.

### Legacy Payment Records

Known fields:

- `qt_orders.finance_status`
- `qt_orders.payment_type_id`
- `qt_orders.paid_at`
- receipt-related fields in `qt_orders`

Treatment:

- Preserve for finance history and reconciliation.
- Do not automatically treat legacy paid rows as active reservations.

### Legacy Member / Order Mapping

Known fields:

- `qt_orders.member_id`
- `qt_orders.payer_member_id`
- `qt_orders.church_id`
- `qt_orders.plan_id`
- `qt_orders.product_type`

Treatment:

- Preserve for member order history.
- Any new-system mapping must respect Identity Boundary v2.
- LINE User must not be treated as the formal member subject; Pastoral Member remains the formal member identity.

### Legacy Line Bot Order References

Current status:

- UNKNOWN as a complete production order flow.
- Existing planning notes mention LIFF / Line Bot QT entry and `/qt/stock-check`, but the full QT Line Bot order flow is not confirmed in the current schema review.

Treatment:

- Preserve any discovered Line Bot QT references as legacy reference.
- Do not infer Pastoral Member or reservation state from LINE identity alone.

## 4. Migration Strategy

Conservative strategy:

1. Start the new QT Inventory Model from a clean 2026-09 operational boundary.
2. Do not mix 2026-08 or earlier data directly into 2026-09 stock quantities.
3. Preserve legacy period data through legacy reference tables, archived views, exports, or read-only reporting paths.
4. Export paid-but-unfulfilled legacy candidates for manual confirmation.
5. Convert only confirmed obligations into the new model through a reviewed DBA migration script.
6. Do not use incomplete legacy data to infer Reserved Inventory.
7. Keep all legacy-to-new transformations auditable and reversible.

New 2026-09 stock should be established from confirmed operational inputs:

- 2026-09 expected inbound quantity.
- 2026-09 actual inbound quantity.
- 2026-09 adult QT and eaglet QT product setup.
- 2026-09 church allocation.
- Any manually confirmed carry-over obligation approved by operations.

## 5. Backfill Strategy

Backfill boundary:

- 2026-09 and later uses Physical / Reserved / Retail invariant.
- 2026-08 and earlier is not forced into the new invariant.

Default new-system initial state:

```text
Physical Inventory = confirmed 2026-09 physical / inbound quantity
Reserved Inventory = 0 unless explicitly confirmed
Retail Inventory = Physical Inventory - Reserved Inventory
```

Legacy paid-unfulfilled handling:

- Do not automatically convert every paid-unfulfilled legacy order into Reserved Inventory.
- If a specific legacy obligation is manually confirmed, require an explicit confirmation marker before migration.
- The confirmation export should include order ID, order item ID, issue month, member, church, product type, payment status, received status, and reviewer decision.
- Confirmed obligations should be migrated through an approved DBA script that updates the relevant new-system inventory row in a transaction.
- Unconfirmed obligations remain in legacy reference.

Forbidden inference:

- Do not infer 2026-09 Reserved Inventory from old paid status alone.
- Do not infer Physical Inventory by subtracting all historical received rows.
- Do not infer cross-church pickup stock effects from legacy pickup records unless actual pickup church is confirmed.

## 6. Legacy Import / Sync Strategy

Observed legacy import/sync assets:

- `api/src/scripts/import-qt-legacy.js`
- `database/run_legacy_weekly_sync.ps1`
- `database/qt_import/generated_qt_import.sql`

Observed risk:

- `api/src/scripts/import-qt-legacy.js` truncates `qt_order_items`, `qt_orders`, and `qt_payment_types`.
- `database/qt_import/generated_qt_import.sql` also truncates `qt_order_items`, `qt_orders`, and `qt_payment_types`.
- A weekly legacy sync script copies and runs generated QT import SQL.

Required Phase 2 protection:

- Legacy QT import/sync must be disabled, isolated, or rewritten before Phase 2 cutover.
- Legacy sync must not write to `qt_inventory_monthly`, `qt_inventory_reservations`, or `qt_inventory_transfers`.
- Legacy sync must not overwrite 2026-09 or later QT inventory data.
- Legacy import scripts must not blindly truncate production QT tables after cutover.
- If legacy import remains necessary, it should load into staging or legacy reference tables first.
- Any import that touches production QT tables must enforce a date guard that excludes 2026-09 and later new-system inventory rows.
- DBA should consider separate database permissions or script-level guards that prevent legacy import jobs from writing new Phase 2 inventory tables.

Minimum pre-cutover decision:

- Confirm whether legacy QT sync remains needed after 2026-09.
- If it remains needed, define the staging target and reconciliation flow.
- If it is not needed, disable the scheduled job and document the rollback procedure.

## 7. Rollback Strategy

### Pre-Migration Backup

Before any legacy migration or Phase 2 cutover, back up:

- `qt_product_types`
- `qt_price_plans`
- `qt_inventory_movements`
- `qt_orders`
- `qt_order_items`
- `qt_payment_types`
- `audit_logs`
- `notification_logs`

After Phase 2 schema exists, also back up:

- `qt_inventory_monthly`
- `qt_inventory_reservations`
- `qt_inventory_transfers`

### Legacy Data Rollback

- Restore legacy QT order, item, payment, and movement tables from backup.
- Preserve any migration export files used for candidate review.
- Keep reviewer decisions as audit evidence even if the application rolls back.

### New Inventory Rollback

If no production writes occurred:

- Drop or ignore new Phase 2 tables according to the DBA-approved rollback SQL.

If production writes occurred:

- Do not immediately drop new tables.
- Freeze QT inventory writes.
- Export new inventory tables and related movement rows.
- Prefer application rollback that ignores new tables while preserving audit evidence.
- If exact pre-cutover state is required, restore from full DB backup.

### Application Rollback

If cutover fails:

- Temporarily return QT operations to the pre-Phase 2 flow.
- Disable or hide new Phase 2 stock management UI paths.
- Keep Phase 1 manual notification and reporting behavior unless it is directly affected.
- Stop any legacy sync job that could overwrite partially migrated data.

### Avoiding Inconsistent Reserved / Retail / Physical Values

- Do not perform partial rollback while stock writes are active.
- Freeze QT stock-changing actions before rollback.
- Reconcile `physical_quantity = reserved_quantity + retail_quantity` before and after rollback.
- If a rollback follows actual reservations or fulfillments, use either full restore or a DBA-reviewed compensation script.

## 8. Manual Verification Checklist

Before Phase 2 implementation, manually confirm:

- The 60 paid-unfulfilled candidate rows.
- 2026-09 initial expected inbound quantity.
- 2026-09 adult QT initial product/inventory data.
- 2026-09 eaglet QT initial product/inventory data.
- Initial 2026-09 allocation quantity for each church.
- Whether any 2026-08 or earlier paid-unfulfilled item must be carried forward.
- Whether legacy import/sync is disabled, isolated, or rewritten.
- DB backup path.
- DB restore path.
- DBA approval for adding:
  - `qt_inventory_monthly`
  - `qt_inventory_reservations`
  - `qt_inventory_transfers`
- DBA approval for additive `qt_inventory_movements` reference columns if adopted.
- DBA approval for lock strategy using transactions and `SELECT ... FOR UPDATE`.
- Operations approval for the 2026-09 cutover boundary.

## 9. Acceptance Criteria

This plan is accepted when:

- A legacy migration plan exists.
- 2026-09 is clearly defined as the new-system starting month.
- 2026-08 and earlier is clearly defined as the legacy period.
- Legacy data is prevented from polluting the new inventory model.
- The 60 paid-unfulfilled candidate rows have a manual confirmation strategy.
- Rollback, backup, and restore requirements are listed.
- Legacy import/sync risk is documented.
- Phase 2 implementation remains blocked until DBA and operations approvals are complete.
