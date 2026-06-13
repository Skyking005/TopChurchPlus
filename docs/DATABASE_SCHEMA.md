# TopChurchPlus Database Schema

最後更新：2026-06-12

本文件是 AI / Codex 快速理解用的資料庫索引，不取代 SQL migration。實際欄位定義以 `database/*.sql` 與 PostgreSQL 實際 schema 為準。

## 資料庫原則

- 主資料庫：NAS PostgreSQL。
- 過渡來源：舊 MSSQL，仍用於會友、課程、QT、點名等資料匯入或核對。
- schema 變更前需備份，變更後需查回驗證。
- 新增 FK 欄位必須補 index。
- 與 MSSQL 搬移相關的欄位不要任意改名或改型別。
- 中文 seed 或測試資料寫入後要查回確認無 mojibake。

## Identity Boundary v2

### Administrative Domain

用途：同工後台登入、行政功能入口、系統管理權限。

主要資料表：

- `accounts`
- `account_roles`
- `role_feature_permissions`
- `system_usage_logs`
- `audit_logs`

規則：

- `role_feature_permissions` 控制 feature key 的 `none/read/edit`。
- 後台角色只代表行政系統權限，不代表會友身份。

### Pastoral Domain

用途：會友資料、牧養資料範圍、LINE/LIFF 外部身份。

主要資料表：

- `pastoral_members`
- `pastoral_groups`
- `account_pastoral_church_permissions`
- `member_accounts`
- `line_users`
- `line_liff_sessions`

硬性規則：

- Pastoral Domain 權限不可依賴後台 Account Role。
- 會友自助、LINE/LIFF、牧養資料範圍要使用牧養專用權限或外部身份橋接。
- 不可用 `role_feature_permissions` 決定會友在外部入口可看哪些個人資料。

## Core / Administrative Tables

### accounts

同工帳號主檔。用於內部登入、使用者資料、部門、會堂、後台操作人員。

注意：

- 部門已朝多選方向發展。
- `staff_id` 會被多個 audit / creator 欄位引用。

### account_roles

同工角色多值表。用於角色權限矩陣。

### role_feature_permissions

功能入口權限矩陣。

欄位概念：

- `role`
- `feature_key`
- `access_level`: `none/read/edit`

目前包含常見 feature：`project`、`meeting`、`finance`、`admin_supply`、`asset`、`venue`、`zoom`、`forms`、`counter`、`qrcode`、`qt`、`linebot`、`pastoral`、`education`、`attendance`、`workflow`、`system`、`dev_management` 等。

### id_rules

中央編碼規則。

已使用：

- project -> `PJ`
- course -> `CL`
- member -> `TOP`
- meeting -> `M`

欄位概念：

- `entity_key`
- `prefix`
- `include_year_month`
- `sequence_digits`
- `is_active`

### audit_logs

敏感操作稽核。Workflow、牧養、財務、系統設定等操作應記錄。

注意：

- `staff_id` FK 到 `accounts.staff_id`，測試時不要帶不存在的 staffId。
- 避免大量寫入完整個資，只放必要前後資料與 metadata。

### system_usage_logs

功能使用紀錄，用於入口使用頻率與 UX 分析。

### system_config_keys

Migration: `database/20260613_config_key_management.sql`

Central configurable key store for system and module settings.

Columns:
- `id`
- `namespace`
- `config_key`
- `config_value`
- `value_type`: `string|number|boolean|json`
- `is_secret`
- `is_enabled`
- `description`
- `created_at`
- `updated_at`
- `updated_by`

Rules:
- `(namespace, config_key)` is unique.
- API/UI responses mask `is_secret` values.
- Audit logs store masked before/after values only.
- Legacy `system_config` remains for compatibility; mapped flat keys such as `LINE_*` and `QT_OPEN_PICKUP_MONTH` are synchronized into `system_config_keys`.

### mail_queue

Migration：`database/20260613_mail_queue.sql`

共用 Email 佇列表。所有 Apps Script Email 必須先寫入此表，再由 `processPendingMails()` 排程依 MailApp quota 批次寄送。

欄位概念：

- `module_key`
- `business_id`
- `event_type`
- `dedupe_key`
- `recipient_email`
- `subject`
- `body`
- `html_body`
- `status`: `PENDING|SENT|FAILED|SKIPPED`
- `priority`: `HIGH|NORMAL|LOW`
- `retry_count`
- `scheduled_at`
- `sent_at`
- `metadata`

注意：

- `dedupe_key` 在 `PENDING` / `SENT` 狀態下不可重複，用來避免同事件重複寄信。
- 實際發送仍由 Apps Script `MailApp` 執行，API 只保存佇列與狀態。

### mail_quota_snapshots

Migration: `database/20260613_mail_queue_management.sql`

MailApp quota observation table. Apps Script records snapshots because `MailApp.getRemainingDailyQuota()` is execution-scoped.

Columns:
- `id`
- `remaining_quota`
- `pending_count`
- `failed_count`
- `sent_today_count`
- `checked_at`
- `created_at`

Notes:
- This table is monitoring data only; it does not reserve quota.
- Dashboard should treat stale snapshots as health risk.

## Common Foundation

### files

共用檔案主檔，記錄檔名、mime type、大小、路徑、上傳者與 metadata。

### file_links

檔案與業務資料的關聯表。

原則：

- 新模組不要輕易新增自己的附件表。
- 先寫 `files`，再用 `file_links` 掛到 entity。
- Workflow history 若需要附件，保存 `file_link_ids`。

### entity_links

跨系統來源與衍生關係。

例：

- project -> finance.purchase
- finance.payment_request -> asset.asset

### domain_events

跨系統事件紀錄。用於追蹤業務事件，不取代 audit log。

### param_categories / param_items / params

參數系統。

現況：

- 舊功能仍有 `params`。
- 新結構朝 `param_categories` + `param_items` 發展。

## BPM / Workflow

Migration：`database/20260612_bpm_engine.sql`

### bpm_definitions

流程定義。

欄位概念：

- `id`
- `name`
- `definition_key`
- `owner_role`
- `is_active`
- `metadata`

### bpm_instances

流程實例。

欄位概念：

- `definition_id`
- `entity_type`
- `entity_id`
- `entity_code`
- `status`: `DRAFT|IN_PROGRESS|COMPLETED|CANCELLED`
- `creator_id`
- `creator_name`

原則：

- 業務狀態與 BPM 狀態 v1 分離。
- 不直接改業務表狀態。

### bpm_history

流程歷程。

欄位概念：

- `instance_id`
- `node_key`
- `node_name`
- `approver_id`
- `approver_name`
- `action`: `SUBMIT|APPROVE|REJECT|COMMENT|CANCEL`
- `comment`
- `file_link_ids`

## Pastoral

主要 migration：

- `database/pastoral_schema.sql`
- `database/pastoral_permissions_usage.sql`

主要資料表：

- `pastoral_members`
- `pastoral_member_contacts`
- `pastoral_member_addresses`
- `pastoral_member_faith`
- `pastoral_groups`
- `pastoral_group_closure`
- `pastoral_care_records`
- `pastoral_member_relationships`
- `pastoral_member_files`
- `account_pastoral_church_permissions`

注意：

- `member_code` 是 TOP 對外編碼；內部主鍵仍是整數 `id`。
- 牧養資料會影響 Education、Attendance、Forms、Line App、LIFF。
- Pastoral Domain 權限不可依賴後台 Account Role。

## Project / Meeting

主要資料表：

- `projects`
- `project_people`
- `project_permissions`
- `project_income`
- `project_budget`
- `meetings`

現況：

- `projects.project_id` 已改 PJ 前綴。
- `meetings.project_id` 可為 null，用於獨立會議。
- 會議編碼使用 `id_rules`。

注意：

- 專案權限需由 API 檢查，不只前端隱藏。
- 專案文件與會議附件應走共用檔案或文件服務。

## Finance

主要資料表：

- `purchases`
- `purchase_items`
- `purchase_advances`
- `purchase_expense_proofs`
- `purchase_payment_requests`
- `purchase_payment_items`

注意：

- 請款可獨立申請。
- 支出證明必須掛請款。
- 財務資料可能衍生資產，需用 `entity_links`。

## Forms / Short Links / Counter

Forms：

- `forms`
- `form_questions`
- `form_responses`
- `form_response_answers`

Short Links：

- 短連結服務主要服務公開表單。
- 管理 UI 已移到 Forms。

Counter：

- 櫃台 PIN、交易、報名繳費與 QT 領取。

## Education / Attendance / QT

Education：

- `education_courses`
- `course_code` 使用 CL 對外編碼。

Attendance：

- 聚會統計與小家出席仍與 MSSQL 過渡資料有關。

QT：

- QT 訂購、庫存、調撥與舊系統匯入。

## Line App / LIFF

## QT Phase 2A Inventory Foundation

Migration: `database/20260613_qt_phase2a_inventory_foundation.sql`

新增資料表：

- `qt_inventory_monthly`

用途：

- QT 2026-09 起的新月度庫存主檔。
- 一筆資料代表同一會堂、同一 QT 月份、同一 QT 類型的庫存狀態。

主要欄位：

- `qt_month`: 6 碼年月，格式 `YYYYMM`。
- `qt_type`: `ADULT` 或 `CHILD`。
- `church_id`
- `physical_quantity`
- `reserved_quantity`
- `retail_quantity`
- `estimated_inbound_quantity`
- `actual_inbound_quantity`
- `status`
- `created_at`
- `updated_at`

約束：

- `(church_id, qt_month, qt_type)` 不可重複。
- `qt_month >= '202609'`，2026-08 含以前維持 legacy period。
- `qt_type IN ('ADULT', 'CHILD')`。
- 庫存數量不得小於 0。
- `physical_quantity = reserved_quantity + retail_quantity`。

既有表調整：

- `qt_inventory_movements` 新增 `inventory_id`、`qt_month`、`qt_type`、`metadata`，供 Phase 2A 後續異動紀錄與新模型關聯使用。
- 既有 `qt_inventory_movements` legacy rows 不會自動 backfill 到 `qt_inventory_monthly`。

主要 migration：

- `database/20260607_liff_foundation.sql`
- `database/20260609_line_app_member_management.sql`

主要資料表：

- `line_bot_channels`
- `line_bot_module_settings`
- `line_bot_rich_menus`
- `line_bot_links`
- `line_users`
- `line_liff_sessions`
- `member_accounts`

注意：

- 技術 key/path 仍是 `linebot`。
- UI 名稱是 Line App 會友管理系統。
- Webhook URL 規劃為 `https://api.topchurchplus.com/linebot/webhook`。
- 外部 HTTPS 未完成前不要切正式模式。

## Asset / Venue / Zoom / Admin Supply / Qrcode

Asset：

- 資產主檔、位置、來源關聯。
- 797 筆正式資產匯入仍需驗證。

Venue：

- 場地資源、預約、衝突檢查。

Zoom：

- Zoom 帳號預約，同帳號同時段排他。

Admin Supply：

- 行政物資主檔、庫存、異動。
- `GIANT_WAREHOUSE` 是行政物資專用倉庫位置。

Qrcode：

- 活動報到與櫃台掃描。

## QT Phase 2B Inventory Reservations

Migration: `database/20260613_qt_phase2b_inventory_reservations.sql`

新增資料表：

- `qt_inventory_reservations`

用途：

- 記錄 QT 月庫存的保留量。
- Phase 2B 僅提供 reservation foundation，不自動串接付款、領取、Line Bot、Transfer 或 Forecast。
- `reserved` reservation 會增加 `qt_inventory_monthly.reserved_quantity` 並減少 `retail_quantity`。
- `released` reservation 會減少 `reserved_quantity` 並恢復 `retail_quantity`。
- `physical_quantity` 在 reservation / release 時不變。

主要欄位：

- `reservation_id`
- `inventory_id`
- `order_id`
- `order_item_id`
- `member_id`
- `quantity`
- `status`: `reserved`, `released`, `fulfilled`, `cancelled`
- `reserved_at`
- `released_at`
- `fulfilled_at`
- `created_by_staff_id`
- `released_by_staff_id`
- `metadata`

限制：

- `quantity > 0`
- 同一 `order_item_id` 同時間只能有一筆 active `reserved` reservation。
- 所有 reservation 寫入需透過 transaction 更新 `qt_inventory_monthly` 並寫入 `qt_inventory_movements`。

`qt_inventory_movements` Phase 2B 新增欄位：

- `reservation_id`
- `order_id`
- `order_item_id`

索引：

- `idx_qt_inventory_reservations_inventory`
- `idx_qt_inventory_reservations_order`
- `idx_qt_inventory_reservations_member`
- `idx_qt_inventory_movements_reservation`
- `idx_qt_inventory_movements_order_item`

Legacy 邊界：

- 2026-08 含以前仍為 legacy period。
- Phase 2B 未自動 backfill 60 筆 paid-unfulfilled candidates。

## MSSQL Migration

相關腳本：

- `database/import_pastoral_from_sqlserver.ps1`
- `database/import_education_from_sqlserver.ps1`
- `database/import_attendance_from_sqlserver.ps1`
- `database/run_legacy_weekly_sync.ps1`

注意：

- 舊系統仍有正式資料時，不要建立雙寫衝突。
- 匯入邏輯需保留 TOP / CL 對外編碼。
