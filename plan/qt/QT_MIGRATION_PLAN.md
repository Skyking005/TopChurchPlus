# TopChurchPlus QT Migration Plan

```text
Status: Draft / Planning Only
This document is not the source of truth.
Before implementation, Codex must verify actual code, database schema, API catalog, and architecture documents.
```

Last updated: 2026-06-13

Source plan: `plan/qt/QT_DOMAIN_REFACTOR_PLAN_V1.md`

## Scope

This document verifies whether the current TopChurchPlus implementation can support the QT Domain Refactor Plan V1.

This is a planning document only.

No production code was modified.
No `/docs` files were modified.
No migration was executed.
No database schema was changed.

## Verification Summary

| Area | Current Support | Assessment |
| --- | --- | --- |
| QT product types and price plans | `qt_product_types`, `qt_price_plans` exist. | Partially supports design. |
| QT orders | `qt_orders`, `qt_order_items`, `qt_payment_types` exist. | Legacy-oriented status model; needs refactor. |
| Inventory movements | `qt_inventory_movements` exists. | Movement ledger exists, but no formal Physical / Reserved / Retail model. |
| Inventory transfer | `POST /qt/inventory/transfers` exists. | Immediate transfer movement exists; no pending transfer workflow table. |
| Dashboard / reports | `/qt/dashboard`, `/qt/reports/:type` exist. | Reports are flat; no pastoral tree report or forecast model. |
| Open pickup month | `system_config.QT_OPEN_PICKUP_MONTH` used by `/qt/settings`. | Exists. |
| Line Bot / LIFF QT entry | Menu item `/liff/modules/qt` exists. `/qt/stock-check` exists. | Entry and stock check exist, but no complete order flow. |
| Email notification | Shared notification template/log foundation exists. | No QT-specific manual notification workflow. |
| Audit log | Shared `recordAuditLog` exists. | QT routes do not consistently use audit log. |
| Fulfillment | `qt_order_items.is_received` and `received_at` exist. | No API found for completing QT pickup with inventory transaction. |

Overall assessment:

The current system supports a basic QT management foundation: listing orders, viewing reports, recording manual inventory movements, checking stock, and viewing pickup status. It does not yet support the refactor plan's core invariants: PAID creates Reserved Inventory, FULFILLED deducts Physical Inventory, cross-church pickup creates pending transfer, and Line Bot ordering respects Retail Inventory.

## Existing QT Tables

Observed in `database/20260605_qt_inventory_schema.sql`:

| Table | Current Purpose |
| --- | --- |
| `qt_product_types` | QT product categories such as adult/student and children/eaglet QT. |
| `qt_price_plans` | QT price plans, duration months, price and legacy group mapping. |
| `qt_inventory_movements` | Ledger-style inventory movement table. |

Observed in `database/20260605_qt_orders_schema.sql`:

| Table | Current Purpose |
| --- | --- |
| `qt_payment_types` | Payment method/type reference. |
| `qt_orders` | Legacy QT order header. |
| `qt_order_items` | Monthly QT pickup item rows. |

Observed index support:

- `idx_qt_inventory_movements_lookup`
- `idx_qt_inventory_movements_source`
- `idx_qt_orders_ordered_at`
- `idx_qt_orders_member`
- `idx_qt_orders_status`
- `idx_qt_orders_church`
- `idx_qt_order_items_issue_month`
- `idx_qt_order_items_order_id`
- `idx_qt_order_items_receiver_member_id`
- `idx_qt_orders_payer_member_id`
- `idx_qt_orders_plan_id`
- `idx_qt_orders_product_type`

## Existing Order Flow

Current API:

- `GET /qt/orders`
- `GET /qt/orders/:orderId`

Current UI:

- QT tab: Orders
- Order list
- Order detail modal
- Status rendering via `renderQtOrderStatus(row)`

Current DB status fields:

- `qt_orders.order_status`
- `qt_orders.finance_status`

Current allowed values:

```text
order_status: cancelled, expired, pending, active
finance_status: unpaid, received, posted
```

Refactor plan target values:

```text
UNPAID
PENDING_APPROVAL
PAID
FULFILLED
CANCELLED
REFUNDED
```

Gap:

- Current status values do not match target state machine.
- Current model splits order and finance status, but does not clearly represent FULFILLED or REFUNDED.
- There is no QT API found for creating a new QT order.
- There is no QT API found for updating order status through the target state transitions.
- Existing orders appear mostly legacy/import oriented.

## Existing Payment Flow

Current implementation:

- `finance_status = unpaid` maps to unpaid.
- `finance_status = received` maps to pending review.
- `finance_status = posted` maps to paid.
- Finance report reads `qt_orders.paid_at` and `finance_status`.

Current API:

- `GET /qt/reports/finance`

Missing:

- Payment proof table or file linkage specific to QT remittance review.
- Payment approval API.
- Payment reject API.
- Transactional logic that creates Reserved Inventory when payment is approved.
- Audit log for payment approval/rejection.
- Explicit rollback/release logic for PAID -> CANCELLED / REFUNDED.

## Existing Fulfillment Flow

Current DB:

- `qt_order_items.is_received`
- `qt_order_items.receiver_member_id`
- `qt_order_items.received_at`

Current API:

- `GET /qt/reports/pickup`
- `GET /qt/orders/:orderId`

Current UI:

- QT Pickup report
- Pickup status filter
- Pickup detail in order detail modal

Missing:

- API to mark QT item/order as received.
- Actual receiving church field on `qt_order_items`.
- Staff/operator field for the pickup action.
- Transactional pickup flow that updates `qt_order_items`, deducts Physical Inventory, deducts Reserved Inventory, and writes inventory log.
- Protection against duplicate pickup.
- Protection against negative inventory during pickup.

## Existing Inventory Flow

Current DB:

- `qt_inventory_movements`

Current movement types:

```text
initial_stock
receive
transfer_in
transfer_out
sale
reserve
release
adjustment
```

Current API:

- `GET /qt/inventory`
- `GET /qt/inventory/movements`
- `POST /qt/inventory/movements`
- `POST /qt/inventory/transfers`
- `GET /qt/stock-check`

Current behavior:

- Inventory availability is calculated by summing `qt_inventory_movements.quantity`.
- Transfer API writes `transfer_out` and `transfer_in` in a transaction.
- `getAvailableQuantity()` sums all movement quantities by month/church/product.
- `stock-check` compares requested quantity against this summed availability.

Gap against refactor design:

- No `qt_inventory_monthly` or equivalent monthly stock master.
- No explicit Physical Inventory field.
- No explicit Reserved Inventory field.
- No explicit Retail Inventory field.
- `reserve` is represented as a negative movement, but not tied to PAID order lifecycle.
- `release` exists, but is not tied to cancel/refund lifecycle.
- `sale` exists, but there is no confirmed Line Bot / LIFF order creation flow using it.
- No uniqueness constraint for month + church + product stock master because no stock master exists.
- No expected inbound vs actual inbound distinction.
- No date range filters for movement history; current `GET /qt/inventory/movements` filters only by month, church, product and limits to 200 rows.

## Existing Line Bot / LIFF Flow

Observed:

- `menu_items` seed includes `QT` -> `/liff/modules/qt`.
- `line_app_modules` seed includes `qt_order`.
- `api/public/liff/liff-app.js` maps link type `qt` for display.
- `GET /qt/stock-check` exists and can return `canOrder`.

Missing:

- LIFF QT ordering page/flow.
- API endpoint for LIFF QT order creation.
- API endpoint for Line Bot QT order preview/confirm.
- Logic that checks Retail Inventory rather than total summed movement availability.
- Logic that suggests next issue month when current Retail Inventory is zero.
- Binding between LINE user and Pastoral Member for QT order identity in the QT ordering flow.
- Audit log or domain event for Line Bot QT ordering.

Identity Boundary note:

- The refactor must keep LINE User separate from Pastoral Member.
- QT ordering through LIFF should use member mapping / Pastoral Member, not `accounts.role`.

## Existing Notification Flow

Observed shared foundation:

- `notification_templates`
- `notification_logs`
- `api/src/shared/notifications.js`
- `recordNotificationLog()`
- `renderNotification()`

Observed shared audit foundation:

- `audit_logs`
- `api/src/shared/audit.js`
- `recordAuditLog()`

Missing for QT:

- QT-specific notification templates for unpicked-up reminder and expiring reminder.
- QT API to preview notification recipients.
- QT API to manually send unpicked-up reminders.
- QT API to manually send expiring reminders.
- QT UI buttons for manual notification.
- Audit log recording `operator_id`, `action_type`, `notification_type`, `success_count`, `failed_count`, `created_at`.
- Clear guarantee that QT Email is never automatically sent.

## Existing UI Coverage

Current QT UI tabs:

- Orders
- Pickup
- Finance
- Reports
- Inventory

Current UI features:

- Order search and list.
- Order detail modal.
- Open pickup month setting.
- Pickup report.
- Finance report.
- Expiring / pastoral summary report selector.
- Inventory table.
- Price plan table.
- Movement history table.
- Manual movement modal.
- Immediate transfer modal.

Missing UI:

- Payment approval screen with proof review.
- Payment reject flow.
- Manual email notification preview/send controls.
- Audit log result display for notification.
- Pastoral tree report.
- Forecast report for next issue month purchasing.
- Year/month separate dropdown for QT issue month.
- Expected inbound vs actual inbound UI.
- Reserved Inventory / Retail Inventory columns.
- Stock master creation/edit screen with duplicate prevention.
- Movement history date range filter.
- Fulfillment action UI for marking pickup complete.
- Cross-church pickup UI.
- Pending transfer review/complete UI.
- Line Bot / LIFF QT order UI.

## Does Current Program Support QT_DOMAIN_REFACTOR_PLAN_V1?

### Supported

1. Basic QT product and plan references.
2. Basic QT order and item tables.
3. Basic inventory movement ledger.
4. Manual inventory movement entry.
5. Immediate transfer movement pair.
6. Basic stock availability check.
7. Basic dashboard, finance, pickup, expiring and pastoral summary reports.
8. Basic open pickup month setting.
9. Shared notification and audit foundations.
10. LIFF menu entry for QT.

### Partially Supported

1. Payment status:
   - Current `finance_status` can map to UNPAID / PENDING_APPROVAL / PAID.
   - It is not enforced as the target state machine.

2. Inventory reserve/release:
   - Movement types exist.
   - They are not connected to payment approval, cancellation or refund transactions.

3. Transfer:
   - Immediate inventory transfer exists.
   - Pending transfer workflow for cross-church pickup does not exist.

4. Reports:
   - Flat pastoral summary exists.
   - Tree report and forecast report do not exist.

5. Line Bot:
   - Entry and stock check foundation exist.
   - Full order flow and Retail Inventory logic do not exist.

### Not Supported

1. Physical / Reserved / Retail Inventory invariant.
2. PAID creates Reserved Inventory.
3. FULFILLED deducts Physical and Reserved Inventory.
4. Cross-church pickup transaction.
5. Pending transfer table/workflow.
6. Manual QT email notification workflow.
7. QT-specific notification audit summary.
8. Negative stock prevention for all movement paths.
9. Fulfillment API.
10. QT order creation API for Line Bot / LIFF.

## Missing Tables

The final names must be confirmed during actual migration design. Current gaps suggest these or equivalent structures:

| Proposed Table | Purpose | Required For |
| --- | --- | --- |
| `qt_inventory_monthly` | One row per issue month + church + product type. Stores expected inbound, physical, reserved, retail or computed policy fields. | Phase 2 |
| `qt_inventory_reservations` | Links PAID order/order item to reserved stock. | Phase 2 / Phase 3 |
| `qt_inventory_transfers` | Pending/completed/cancelled transfer workflow for cross-church pickup. | Phase 3 |
| `qt_payment_reviews` | Records remittance review status, reviewer, decision, reason, timestamps, optional file link. | Phase 1 / Phase 3 |
| `qt_notification_batches` | Summary of manual notification sends: type, operator, success/fail counts. | Phase 1 |
| `qt_notification_batch_recipients` | Per-recipient result for manual QT notification. Could also use `notification_logs` if sufficient. | Phase 1 |

Existing shared tables that may be reused:

- `audit_logs`
- `notification_templates`
- `notification_logs`
- `files`
- `file_links`

Tables that might be altered instead of new:

| Existing Table | Possible Additions |
| --- | --- |
| `qt_orders` | canonical lifecycle status, payment review status, refund/cancel metadata. |
| `qt_order_items` | fulfilled status, fulfilled_at, fulfilled_by_staff_id, ordered_church_id, fulfilled_church_id, inventory movement references. |
| `qt_inventory_movements` | movement group id, order id, order item id, transfer id, metadata, stricter source references. |

## Missing API

Suggested API gaps, not implementation instructions:

| API | Purpose |
| --- | --- |
| `POST /qt/orders` | Create QT order from admin or LIFF flow. |
| `POST /qt/orders/:orderId/payment-review/approve` | Approve remittance; transition to PAID; create reservation. |
| `POST /qt/orders/:orderId/payment-review/reject` | Reject remittance; transition back to UNPAID. |
| `POST /qt/orders/:orderId/cancel` | Cancel order and release reservation if needed. |
| `POST /qt/orders/:orderId/refund` | Refund order and release reservation if needed. |
| `POST /qt/order-items/:orderItemId/fulfill` | Fulfill pickup; deduct Physical and Reserved Inventory. |
| `POST /qt/order-items/:orderItemId/cross-church-fulfill` | Fulfill pickup at a different church; deduct Retail Inventory and create pending transfer. |
| `GET /qt/inventory/monthly` | Read monthly Physical / Reserved / Retail view. |
| `POST /qt/inventory/monthly` | Create monthly stock master. |
| `PUT /qt/inventory/monthly/:id` | Update expected/actual inbound policy fields. |
| `GET /qt/inventory/movements?from=&to=` | Add date range movement history. |
| `GET /qt/reports/pastoral-tree` | Tree report by church -> pastoral group -> small group. |
| `GET /qt/reports/forecast` | Purchasing/stock forecast. |
| `POST /qt/notifications/:type/preview` | Preview manual notification recipients. |
| `POST /qt/notifications/:type/send` | Manually send QT notification and write logs. |
| `GET /liff/modules/qt` or equivalent | LIFF QT order page data. |
| `POST /liff/modules/qt/orders` or equivalent | Create member QT order from LIFF. |

## Missing UI

| UI Area | Missing Capability |
| --- | --- |
| Orders | Create/edit order, cancel/refund, status transition actions. |
| Payment | Remittance proof review, approve/reject, audit trail. |
| Fulfillment | Mark pickup complete, choose actual pickup church, duplicate prevention feedback. |
| Cross-church pickup | Retail stock check, pending transfer creation, pending transfer list. |
| Inventory | Monthly stock master, expected inbound, actual inbound, Physical / Reserved / Retail display. |
| Inventory movements | Date range filter and order/transfer linkage display. |
| Reports | Pastoral tree report and forecast report. |
| Notifications | Manual reminder preview/send for unpicked-up and expiring QT. |
| LIFF | Member-facing QT order page and current/next issue month availability. |

## Migration Strategy

### Step 1: Read-only Analysis

1. Dump current QT table definitions from live PostgreSQL.
2. Count rows by status:
   - `qt_orders.order_status`
   - `qt_orders.finance_status`
   - `qt_order_items.is_received`
3. Count movement rows by:
   - issue month
   - church
   - product type
   - movement type
4. Identify negative stock situations by current sum logic.
5. Identify orders with PAID-equivalent `finance_status = posted`.
6. Identify received items without inventory movement linkage.

### Step 2: Compatibility Mapping

Map current values to target concepts:

| Current | Target Meaning |
| --- | --- |
| `finance_status = unpaid` | UNPAID |
| `finance_status = received` | PENDING_APPROVAL |
| `finance_status = posted` | PAID |
| `qt_order_items.is_received = true` | FULFILLED item |
| `order_status = cancelled` | CANCELLED |

Do not remove legacy columns in the first migration. Add compatibility views or computed fields first.

### Step 3: Additive Migration

Use additive changes first:

1. Add new tables behind existing behavior.
2. Add nullable references from new tables to old order/order item rows.
3. Backfill computed monthly inventory snapshots.
4. Backfill reservations from paid unfulfilled orders only after verification.
5. Backfill fulfillment movements only if source data is reliable.

### Step 4: Dual-read / Controlled Write

1. Keep existing QT dashboard and reports working.
2. Introduce new read endpoints behind new routes or explicit query flags.
3. Add write flows only after backfilled data passes reconciliation.
4. Use database transactions for all payment approval, fulfillment and cross-church pickup writes.

### Step 5: Cutover

1. Route admin UI to new inventory monthly view.
2. Route pickup to fulfillment API.
3. Route LIFF QT ordering to Retail Inventory check.
4. Keep old movement ledger available for audit and reconciliation.

## Backward Compatibility Risk

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Legacy status values do not match target state names. | Reports may change counts unexpectedly. | Use mapping layer first; do not rename values directly in first migration. |
| Existing movement sums mix receive, reserve, release, sale and transfer as one availability value. | Physical / Reserved / Retail reconciliation may not balance. | Build reconciliation queries before backfill. |
| Paid legacy orders may not have reliable payment timestamps. | Reservation backfill may be incomplete. | Use `finance_status = posted` as primary signal; record assumptions. |
| Received legacy items may not identify actual pickup church. | Cross-church history cannot be reconstructed. | Default to order church for legacy rows; mark unknown when needed. |
| Existing immediate transfer movements lack pending status. | Cannot represent cross-church pending transfers. | Introduce new transfer table without rewriting old transfer movements. |
| Line Bot menu already exposes QT route. | Users may hit incomplete flow if route is activated. | Keep route guarded until LIFF order flow is complete. |
| Notification logs exist but not QT batch semantics. | Manual notification summary may be hard to audit. | Add QT batch table or store batch id in `notification_logs.metadata`. |

## Rollback Strategy

Phase 0 has no rollback because it only creates this plan file.

For future migrations:

1. Every schema migration must have a rollback SQL file.
2. Additive tables should be dropped only if no production writes occurred.
3. If production writes occurred, rollback should disable new flows rather than delete data.
4. Keep legacy QT order and movement columns untouched until final cutover is proven.
5. Add feature flags for new payment approval, fulfillment, LIFF ordering and notification flows.
6. Before any backfill, create a database backup and export reconciliation counts.
7. Rollback scripts must not delete `audit_logs`, `notification_logs`, or inventory movement history unless explicitly approved.

## Migration Risk

Overall risk: High for Phase 2 and Phase 3.

Reasons:

1. QT inventory is currently movement-sum based, while the target model requires strict Physical / Reserved / Retail invariants.
2. Legacy data may not have enough fields to reconstruct actual pickup church or reservation lifecycle.
3. Payment approval currently appears as status data, not a complete review workflow.
4. Fulfillment currently appears read-oriented; write flow with inventory deduction is missing.
5. Cross-church pickup requires multi-table transaction and pending transfer workflow.
6. Line Bot ordering touches Identity Boundary v2 and must not treat LINE User as Pastoral Member directly.

Recommended next action:

Proceed with a separate DBA review / migration design before any implementation.

The next concrete planning task should produce:

`plan/qt/QT_DBA_MIGRATION_REVIEW.md`

It should include actual live row counts, reconciliation SQL, proposed schema DDL, rollback SQL, and cutover checklist.
