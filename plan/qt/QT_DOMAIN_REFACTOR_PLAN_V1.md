# TopChurchPlus QT Domain Refactor Plan V1

```text
Status: Draft / Planning Only
This document is not the source of truth.
Before implementation, Codex must verify actual code, database schema, API catalog, and architecture documents.
```

Last updated: 2026-06-13

## 1. QT 模組重構目標

本文件規劃 TopChurchPlus QT 系統後續重構方向，目標是將 QT 從單純訂購、領取與庫存查詢，整理成可支援訂單、付款、保留庫存、實體領取、跨會堂調撥、Line Bot 訂購判斷、手動通知與報表預測的完整領域模型。

重構目標：

1. 明確區分訂單狀態、付款狀態、領取狀態與庫存狀態。
2. 將 QT 庫存拆成 Physical Inventory、Reserved Inventory、Retail Inventory。
3. 建立付款審核後才保留庫存、領取後才扣實體庫存的規則。
4. 建立跨會堂領取與待調撥流程。
5. 將 QT Email 通知改為管理端手動觸發。
6. 補齊 audit log 與 inventory log 規則。
7. 支援牧區統計、到期提醒、進貨預測與 Line Bot 訂購判斷。

## 2. 核心業務原則

### 2.1 庫存不可由付款前訂單占用

未付款與待審核訂單不代表有效需求，不應占用 QT 庫存，也不應納入有效預購數量。

### 2.2 付款審核通過才建立 Reserved Inventory

只有 PAID 訂單可建立保留數量。這代表會友已完成付款，系統需要替該訂單保留可領取的 QT。

### 2.3 領取完成才扣 Physical Inventory

實體庫存代表現場真正持有數量。只有 FULFILLED，也就是完成領取後，才可扣減 Physical Inventory。

### 2.4 所有庫存異動都必須可追溯

任何增加、扣減、保留、釋放、調撥、跨堂領取，都必須寫入 inventory log。高風險操作也必須寫入 audit log。

### 2.5 QT 領域不得影響行政物資管理

QT 庫存模型可參考行政物資管理，但不可直接破壞或混用行政物資資料表與流程。若要共用調撥模型，必須先在 Phase 0 驗證資料邊界。

## 3. 庫存模型定義

QT 庫存需區分：

- Physical Inventory：實體庫存
- Reserved Inventory：已付款但尚未領取的預購保留
- Retail Inventory：可零售數量

核心公式：

```text
Physical Inventory = Reserved Inventory + Retail Inventory
```

定義：

| Inventory | Definition | Change Timing |
| --- | --- | --- |
| Physical Inventory | 該會堂、月份、QT 類型實際可被領取或販售的實體數量。 | 實際入庫增加；FULFILLED 領取時減少。 |
| Reserved Inventory | PAID 且尚未 FULFILLED 的預購保留數量。 | PAID 增加；FULFILLED 減少；取消或退款時釋放。 |
| Retail Inventory | 可供現場零售或 Line Bot 當期購買的數量。 | 由 Physical - Reserved 推導，或由明確欄位維護。 |

規則：

1. PAID 只建立 Reserved Inventory，不扣 Physical Inventory。
2. FULFILLED 才扣 Physical Inventory。
3. FULFILLED 同時扣減 Reserved Inventory。
4. 庫存不可扣成負數。
5. 同一月份、會堂、QT 類型不可重複建立庫存主檔。
6. QT 月份應由年/月下拉產生，不允許手動輸入任意字串。
7. 支援成人 QT 與兒童 QT。
8. 支援預計入庫與實際入庫。
9. 移除或隱藏最低庫存功能，除非 Phase 0 驗證仍有真實需求。

## 4. 訂單狀態機

### 4.1 狀態定義

| Status | Meaning | Inventory Effect |
| --- | --- | --- |
| UNPAID | 訂單已建立但尚未付款。 | 不扣庫存、不保留庫存、不納入有效預購數量。 |
| PENDING_APPROVAL | 匯款資料已送出，等待審核。 | 不扣庫存、不保留庫存、不納入有效預購數量。 |
| PAID | 付款審核通過。 | 建立 Reserved Inventory，納入有效預購數量。 |
| FULFILLED | 已完成領取。 | 扣減 Physical Inventory，同時扣減 Reserved Inventory。 |
| CANCELLED | 訂單取消。 | 若已保留庫存，需釋放 Reserved Inventory。 |
| REFUNDED | 已退款。 | 若已保留庫存，需釋放 Reserved Inventory。 |

### 4.2 建議狀態轉換

```text
UNPAID
  -> PENDING_APPROVAL
  -> PAID
  -> FULFILLED

PENDING_APPROVAL
  -> UNPAID

PAID
  -> CANCELLED
  -> REFUNDED

UNPAID
  -> CANCELLED
```

### 4.3 付款規則

訂單建立時：

- 狀態為 UNPAID
- 不扣庫存
- 不保留庫存
- 不納入有效預購數量

匯款待審核：

- 狀態為 PENDING_APPROVAL
- 不扣庫存
- 不保留庫存
- 不納入有效預購數量

審核通過：

- 狀態為 PAID
- 才保留庫存
- 才納入有效預購數量

審核失敗：

- 回到 UNPAID
- 不需要釋放庫存，因為之前沒有占用庫存

## 5. 跨會堂領取規則

若會友原訂會堂與實際領取會堂不同：

範例：

- 原訂會堂：北大
- 實際領取：幸福

系統應：

1. 扣減實際領取會堂的 Retail Inventory。
2. 不得優先扣減實際領取會堂的 Reserved Inventory。
3. 若 Retail Inventory 不足，應阻擋領取或進入缺貨流程。
4. 成功領取時，建立待調撥單：
   - `from_church_id` = 原訂會堂
   - `to_church_id` = 實際領取會堂
   - `status` = PENDING
5. 跨堂領取、扣庫存、建立調撥單、更新訂單狀態必須在同一個 database transaction 內完成。

跨堂領取不可讓實際領取會堂的 Reserved Inventory 被消耗，因為 Reserved Inventory 是替該會堂已付款未領取者保留。

## 6. 付款與匯款審核規則

付款審核應有明確操作紀錄：

1. 管理員查看匯款資料或附件。
2. 管理員審核通過或退回。
3. 通過時狀態轉為 PAID。
4. 退回時狀態回到 UNPAID。
5. 每次審核操作必須寫入 audit log。
6. 若 PAID 需要建立 Reserved Inventory，必須與付款狀態更新在同一 transaction 中完成。

審核 audit log 建議欄位：

- operator_id
- action_type
- order_id
- previous_status
- next_status
- reason
- created_at

## 7. 手動 Email 通知與 Audit Log 規則

QT Email 通知不得自動寄送。

所有通知都改成管理端手動按鈕觸發。

包含：

- 未領取通知
- 即將到期通知

每次手動通知都需寫入 audit log：

- operator_id
- action_type
- notification_type
- success_count
- failed_count
- created_at

建議：

1. 通知送出前先顯示預覽名單。
2. 管理員確認後才送出。
3. 寄送成功與失敗都需記錄。
4. 不應由排程或背景程序自動寄送 QT Email，除非未來另行通過決策。

## 8. 報表與預測需求

### 8.1 牧區 Tree 報表

牧區統計應支援樹狀展開：

```text
會堂
  -> 牧區
    -> 小組
      -> 會友 / 訂購紀錄
```

統計指標：

- 訂購人數
- 訂購本數
- 已付款數
- 未付款數
- 已領取數
- 未領取數
- 領取率

### 8.2 未領取報表

預設顯示未領取清單，並可依月份、會堂、牧區、小組、QT 類型、付款狀態篩選。

### 8.3 到期提醒報表

需支援即將到期條件，例如 30 天內到期。通知仍由管理端手動觸發。

### 8.4 進貨預測

下期已繳費訂單應納入進貨預測。未付款與待審核訂單不得納入有效預購數量，可另列為潛在需求參考。

## 9. Line Bot 訂購判斷

Line Bot / LIFF 訂購當期 QT 時需檢查 Retail Inventory。

規則：

1. 當期 QT 若 Retail Inventory 大於 0，可允許訂購。
2. Retail Inventory 為 0 時，提示改訂下一期。
3. Line Bot 不可賣出已無零售庫存的當期 QT。
4. LINE User 不是正式會員主體。
5. 若訂購需要對應會友，應透過既有 member mapping / Pastoral Member 機制。
6. 不得用 `accounts.role` 判斷會友可訂購範圍。

Line Bot 訂購判斷應遵守 Identity Boundary v2：

- Administrative Domain 與 Pastoral Domain 必須解耦。
- Pastoral Member 才是正式會員主體。
- LIFF / LINE 入口不可直接等同後台帳號。

## 10. 三階段執行計畫

### Phase 0：Architecture Alignment & Migration Planning

目標：

只分析，不修改程式。

產出：

`plan/qt/QT_MIGRATION_PLAN.md`

內容需包含：

- 現有 QT tables
- 現有 order flow
- 現有 payment flow
- 現有 Line Bot flow
- 現有 fulfillment flow
- 需要新增的欄位
- 需要新增的資料表
- migration strategy
- backward compatibility risk
- rollback strategy

限制：

- 不修改 production code
- 不修改 docs
- 不修改 schema
- 僅新增 plan 文件

### Phase 1：Notification & Reporting Refactor

目標：

- Email 通知改手動觸發
- 牧區統計改為 Tree 報表
- 通知寫入 audit log

範圍：

- 管理端手動通知按鈕
- 通知預覽名單
- 通知結果 audit log
- 牧區 Tree 報表
- 不改變既有 QT 訂單與庫存流程

### Phase 2：QT Inventory Core Refactor

目標：

重構 QT 庫存核心模型。

需求：

- QT 月份改為年/月下拉產生
- 不允許手動輸入 QT 月份
- 支援成人 / 兒童 QT
- 支援預計入庫
- 支援實際入庫
- 支援 Reserved Inventory
- 支援 Retail Inventory
- 移除或隱藏最低庫存功能
- 異動紀錄支援時間區間查詢

### Phase 3：Order / Payment / Fulfillment Refactor

目標：

完成 QT 訂單、付款、領取、跨堂調撥、Line Bot 訂購判斷。

需求：

- UNPAID 不保留庫存
- PENDING_APPROVAL 不保留庫存
- PAID 才保留庫存
- FULFILLED 才扣實體庫存
- 跨堂領取優先扣實際領取堂的 Retail Inventory
- Retail Inventory 不足時阻擋領取
- 建立 `qt_inventory_transfers` 或沿用現有調撥模型
- Line Bot 訂購當期 QT 時需檢查 Retail Inventory
- Retail Inventory 為 0 時提示改訂下一期
- 下期已繳費訂單納入進貨預測

## 11. 各階段驗收條件

### Phase 0 驗收條件

- 不修改 production code
- 不修改 docs
- 不修改 schema
- 僅新增 plan 文件
- 產出 `plan/qt/QT_MIGRATION_PLAN.md`
- 清楚標示需要新增欄位、資料表、migration strategy、rollback strategy

### Phase 1 驗收條件

- 系統不再自動寄送 QT Email
- 管理端可手動寄送通知
- 通知結果會寫入 audit log
- 牧區報表可用樹狀結構展開
- 不影響既有 QT 訂單與庫存流程

### Phase 2 驗收條件

- 可建立 202605 成人 QT
- 可建立 202605 兒童 QT
- 不可建立重複月份、會堂、QT 類型庫存
- 庫存不可扣成負數
- 異動紀錄可依時間查詢
- 不影響行政物資管理系統

### Phase 3 驗收條件

- 付款成功後才保留庫存
- 領取後才扣實體庫存
- 跨堂領取會建立待調撥單
- 跨堂領取不會吃掉實際領取堂的 Reserved Inventory
- Line Bot 不會賣出已無零售庫存的當期 QT
- 所有交易都有 audit log
- 所有庫存異動都有 inventory log
