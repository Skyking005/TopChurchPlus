# QT DBA Review

最後更新：2026-06-12

## Review Summary

QT 模組目前已有以下資料模型：

- `qt_product_types`
- `qt_price_plans`
- `qt_payment_types`
- `qt_orders`
- `qt_order_items`
- `qt_inventory_movements`

本次重構優先完成不需 migration 的部分：

- QT 管理頁五個 Tab。
- Dashboard。
- 領取月份設定，使用既有 `system_config`。
- 領取報表篩選。
- 財務、到期、牧區統計沿用現有報表 API。
- 庫存管理沿用既有 `qt_inventory_movements`。

以下項目在正式實作前需 DBA Review，不應直接修改 production schema。

## 1. 匯款審核資料模型

### 現況

`qt_orders` 目前只有：

- `finance_status`: `unpaid | received | posted`
- `paid_at`
- `payment_type_id`
- `paper_receipt_no`
- `payment_sequence_no`

目前沒有匯款證明附件、審核人、審核退回原因、審核歷程。

### 建議新增

可考慮新增 `qt_payment_reviews`：

```sql
CREATE TABLE qt_payment_reviews (
  review_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id integer NOT NULL REFERENCES qt_orders(order_id) ON DELETE CASCADE,
  review_status text NOT NULL CHECK (review_status IN ('pending', 'approved', 'rejected')),
  proof_file_id uuid REFERENCES files(file_id) ON DELETE SET NULL,
  submitted_at timestamptz,
  reviewed_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  reject_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_qt_payment_reviews_order
  ON qt_payment_reviews(order_id, created_at DESC);

CREATE INDEX idx_qt_payment_reviews_status
  ON qt_payment_reviews(review_status, created_at DESC);
```

### 相容風險

- 舊資料只有 `finance_status`，沒有審核歷程。
- 若匯款證明走 `files` / `file_links`，需決定 proof_file_id 是否保留或全走共用連結。
- 審核通過時需同步 `qt_orders.finance_status = 'posted'`，避免雙狀態不一致。

### Rollback

```sql
DROP TABLE IF EXISTS qt_payment_reviews;
```

## 2. 領取流程與自動扣庫存

### 現況

`qt_order_items` 已記錄：

- `issue_month`
- `is_received`
- `receiver_member_id`
- `received_at`

庫存異動使用 `qt_inventory_movements`，支援：

- `initial_stock`
- `receive`
- `transfer_in`
- `transfer_out`
- `sale`
- `reserve`
- `release`
- `adjustment`

### 缺口

目前沒有正式的「領取成功 -> 自動扣庫存」關聯欄位，`qt_inventory_movements.source_system/source_id` 可暫用，但缺少 FK 與唯一防重。

### 建議調整

可考慮在 `qt_order_items` 新增：

```sql
ALTER TABLE qt_order_items
  ADD COLUMN pickup_movement_id uuid REFERENCES qt_inventory_movements(movement_id) ON DELETE SET NULL;

CREATE INDEX idx_qt_order_items_pickup_movement
  ON qt_order_items(pickup_movement_id);
```

或在 `qt_inventory_movements` 上建立唯一約束，防止同一領取項目重複扣庫存：

```sql
CREATE UNIQUE INDEX idx_qt_inventory_unique_pickup_source
  ON qt_inventory_movements(source_system, source_id)
  WHERE source_system = 'qt_pickup';
```

### Rollback

```sql
DROP INDEX IF EXISTS idx_qt_inventory_unique_pickup_source;
DROP INDEX IF EXISTS idx_qt_order_items_pickup_movement;

ALTER TABLE qt_order_items
  DROP COLUMN IF EXISTS pickup_movement_id;
```

## 3. Inventory / Transfer / Ledger 模型

### 現況

目前 `qt_inventory_movements` 已同時扮演 stock ledger：

- 入庫：正數。
- 出庫 / 預扣 / 調撥出：負數。
- 調撥入：正數。
- `related_movement_id` 可串調撥出入。

### DBA Review 判斷

若只需要目前月庫存、入庫、調撥、異動歷史，現有表可繼續使用。

若需要正式庫存月結、倉別、盤點鎖帳、領取單號與不可逆 ledger，建議新增：

- `qt_inventory_periods`
- `qt_stock_transfers`
- `qt_stock_transfer_items`

但這會提高複雜度，需先確認 QT 實際作業是否需要月結與審核。

## 4. 財務報表資料來源

### 現況

財務報表目前由 `qt_orders` 聚合，依：

- `church_id`
- `payment_type_id`
- `finance_status`
- `paid_at`

### 缺口

需求提到：

- 應收金額
- 已收金額
- 未收金額
- 匯款審核

目前缺少明確應收/實收分錄與審核歷程。若與 Counter 金流整合，需決定 QT 是否建立 `counter_transactions`。

### 建議

短期：

- `unpaid` 視為未收。
- `received` 視為待審核。
- `posted` 視為已收。

中期：

- QT 匯款審核通過後建立或連結 `counter_transactions`。
- 使用 `entity_links` 關聯 `qt_order` 與 `counter_transaction`。

## 5. Email 通知

### 現況

QT 到期提醒報表已有資料來源，但沒有確認 SMTP 或通知寄送設定。

### DBA / 架構問題

- 是否沿用 `notification_logs`？
- 是否需新增 QT 通知排程表？
- Email template 放在 `system_config`、`notification_templates`，或 module-specific table？

### 建議

先使用既有 notification foundation；若需排程與重送，再提出通知 job model。

## Decision

本次開發不執行 QT migration。

可安全先做：

- UI Tab 重整。
- Dashboard query。
- `system_config` 儲存開放領取月份。
- 既有報表篩選。

需 DBA Review 後再做：

- 匯款證明附件與審核歷程。
- 領取自動扣庫存防重。
- 正式 stock transfer / ledger 月結模型。
- QT 與 Counter 金流正式關聯。
- Email 通知排程與重送模型。
