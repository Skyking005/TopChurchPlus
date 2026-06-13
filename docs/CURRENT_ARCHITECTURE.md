# TopChurchPlus Current Architecture

最後更新：2026-06-12

## 架構總覽

```text
Browser
  -> Google Apps Script Web App
    -> HTML partials and Script_*.html
    -> google.script.run
      -> 程式碼.gs
        -> NAS Node.js API
          -> PostgreSQL
          -> legacy MSSQL import/sync scripts
```

外部入口：

```text
LINE / LIFF / Public Forms
  -> API public routes or Apps Script public rendering
  -> PostgreSQL
```

## Frontend Layer

主要檔案：

- `Index.html`：include 各畫面與 script。
- `Login.html`：登入畫面。
- `Script_FeatureConfig.html`：功能入口靜態設定。
- `Script_Login.html`：登入流程、功能選單、主畫面切換、權限顯示。
- `<Module>.html`：模組畫面。
- `Script_<Module>.html`：模組前端邏輯。
- `Style.html`：共用樣式。

前端原則：

- 保留 Apps Script Web App，不做一次性 React/Vue 重寫。
- 新模組需接 `Index.html`、功能入口、Apps Script bridge、API route、feature permission。
- 功能卡片靜態資料已從 `Script_Login.html` 搬到 `Script_FeatureConfig.html`。

## Apps Script Bridge

主要檔案：`程式碼.gs`。

職責：

- 保存 API base URL / API key 設定。
- 統一 `apiRequest()`。
- 將前端 `google.script.run` 包裝成 API 呼叫。
- 公開表單短連結渲染。
- `MailQueueService`：統一 Email enqueue、quota 查詢、排程寄送與狀態回寫。

注意：

- 不要把大型商業邏輯新增回 `程式碼.gs`。
- 新 API 應優先放在 NAS API，Apps Script 只保留橋接。
- 模組不得直接呼叫 `MailApp.sendEmail()`；必須寫入 `mail_queue` 後由 `processPendingMails()` 發送。登入驗證碼為唯一核准的即時寄送例外。

## API Layer

入口：`api/src/index.js`。

共用元件：

- `api/src/db.js`：PostgreSQL pool / tx。
- `api/src/middleware/api-key.js`：API key。
- `api/src/middleware/request-context.js`：request id。
- `api/src/middleware/error-handler.js`：錯誤輸出。
- `api/src/shared/permissions.js`：feature permission。
- `api/src/shared/users.js`：current user / role helper。
- `api/src/shared/audit.js`：audit log。
- `api/src/shared/files.js`：files/file_links。
- `api/src/shared/cross-system.js`：entity_links/domain_events。
- `api/src/shared/id-rules.js`：中央編碼規則。

已註冊模組包含：

- admin-supply, asset, attendance, auth, core, counter, dev-management, documents, education, finance, forms, linebot, liff, mail, pastoral, project, qrcode, qt, shortlinks, system, sunday-message, venue, workflow, worklog, zoom。

## Database Layer

主資料庫：NAS PostgreSQL。

主要 schema/migration：

- `database/schema.sql`：目前整合快照。
- `database/core_platform_schema.sql`：files、audit、line/member identity foundation。
- `database/pastoral_schema.sql`。
- `database/pastoral_permissions_usage.sql`。
- `database/20260611_id_rules_and_meetings.sql`。
- `database/20260612_bpm_engine.sql`。

原則：

- migration 應可重跑或明確說明不可重跑。
- 新增 FK 必須補 index。
- 中文 seed 要驗證沒有 mojibake。

## Identity Boundary v2

系統有兩種身份域：

### Administrative Domain

用途：

- 同工後台登入。
- 系統功能入口權限。
- 管理員、超級管理者、全職同工等角色。

核心資料：

- `accounts`
- `account_roles`
- `role_feature_permissions`
- `system_usage_logs`
- `audit_logs`

### Pastoral Domain

用途：

- 會友資料。
- 牧養資料範圍。
- LINE/LIFF 外部身份。
- 會友自助服務。

核心資料：

- `pastoral_members`
- `pastoral_groups`
- `account_pastoral_church_permissions`
- `member_accounts`
- `line_users`
- `line_liff_sessions`

規則：

- Pastoral Domain 權限不可依賴後台 Account Role。
- 後台同工角色不等於會友身份。
- 外部會友入口不可沿用後台 session。
- 牧養資料授權要用牧養專用權限或會友身份橋接。

## Workflow / BPM v1

目的：提供未來簽核流程的基礎引擎。

目前已完成：

- `bpm_definitions`
- `bpm_instances`
- `bpm_history`
- `/workflow/definitions`
- `/workflow/instances`
- `/workflow/instances/:id/history`
- `/workflow/dashboard`
- Apps Script wrappers in `程式碼.gs`

目前限制：

- 尚未有完整前端工作台。
- v1 不主動通知，只由 dashboard query pending nodes。
- 業務狀態與 BPM 狀態分離，尚未自動同步。
- 附件使用既有 `files` / `file_links`，history 只保存 `file_link_ids`。

## QT Notification & Reporting Phase 1

QT Refactor Phase 1 已完成程式驗收，仍停留在 Phase 1 範圍，未進入庫存核心重構或付款/領取流程重構。

目前架構：

- 管理端 `Qt.html` / `Script_Qt.html` 提供手動按鈕寄送未領取通知與即將到期通知。
- Apps Script bridge 先呼叫 `GET /qt/notifications/:type/preview` 取得收件人與信件內容。
- Apps Script 使用既有 `MailApp.sendEmail` 實際寄送 Email。
- 寄送完成後，Apps Script 呼叫 `POST /qt/notifications/:type/results`，API 寫入 `notification_logs` 與 `audit_logs`。
- QT API 明確保留 `QT_AUTO_NOTIFICATIONS_ENABLED = false`，目前沒有排程或自動寄送 QT Email。
- 牧區統計新增 `GET /qt/reports/pastoral-tree`，前端以 Tree 展開會堂、牧區/小組與方案統計。

邊界：

- 不修改 `qt_inventory_movements` 的核心計算方式。
- 不修改 `qt_orders` 付款狀態流程。
- 不修改 `qt_order_items` 領取流程。
- Phase 2 前仍需以 `plan/qt/QT_MIGRATION_PLAN.md` 與 DBA migration review 確認庫存模型。

## QT Inventory Foundation Phase 2A

QT Refactor Phase 2A 已建立新庫存基礎，但尚未進入付款、領取、Line Bot、跨會堂調撥或 forecast 邏輯。

目前架構：

- 新增 `qt_inventory_monthly` 作為 2026-09 起的 QT 月度庫存主檔。
- `qt_month` 使用 `YYYYMM`，後端驗證 6 碼年月格式。
- `qt_type` 使用固定值 `ADULT` / `CHILD`，前端顯示為成人 QT / 兒童 QT。
- DB 約束 `(church_id, qt_month, qt_type)` 不可重複。
- DB 約束 `physical_quantity = reserved_quantity + retail_quantity`。
- DB 約束 2026-08 含以前不可寫入新月度庫存主檔，legacy period 維持查詢與對帳用途。
- 管理端 QT 庫存頁以年份/月分下拉產生 `qt_month`，不提供手動輸入年月文字。
- QT 異動紀錄查詢支援 `startDate` / `endDate`。

邊界：

- 未自動 backfill 60 筆 paid-unfulfilled legacy candidates。
- 未修改 QT 訂單付款流程。
- 未修改匯款審核流程。
- 未修改領取 / fulfill 流程。
- 未修改 Line Bot 訂購流程。
- 未修改行政物資管理系統。

## QT Inventory Reservations Phase 2B

QT Refactor Phase 2B 已新增 reservation foundation。

已完成：

- 新增 `qt_inventory_reservations`。
- 新增 reservation service：建立 reservation 與釋放 reservation。
- 建立 reservation 時，系統會在 transaction 內鎖定 `qt_inventory_monthly`。
- 建立 reservation 只會增加 `reserved_quantity`、減少 `retail_quantity`，不改 `physical_quantity`。
- 釋放 reservation 會減少 `reserved_quantity`、恢復 `retail_quantity`，不改 `physical_quantity`。
- 每次 reservation / release 都會寫入 `qt_inventory_movements` 與 `audit_logs`。

未變更：

- 未修改 QT 付款流程。
- 未修改 QT 領取流程。
- 未修改 Line Bot / LIFF 訂購流程。
- 未新增跨會堂 Transfer 流程。
- 未實作 Forecast。
- 未自動 backfill 2026-08 含以前 legacy paid-unfulfilled candidates。

## Central Config Key Management

TopChurchPlus now has a centralized configurable key foundation:

- Database table: `system_config_keys`
- Backend service: `api/src/shared/config-service.js`
- Admin routes: `/system/config-keys`
- Apps Script wrappers: `getSystemConfigKeys()` and `saveSystemConfigKey()`
- Admin UI: System Management / Config Key Management

The MVP supports namespace classification, value type validation, enable/disable, descriptions, and secret masking. Secret values are not returned in full to the UI and are masked in audit before/after payloads. Legacy `system_config` remains available for compatibility; mapped flat keys such as `LINE_*` and `QT_OPEN_PICKUP_MONTH` are synchronized into the new namespace model.

Known transition sources not fully converged yet:

- Apps Script Script Properties still hold runtime `API_BASE_URL` and `API_KEY`.
- Venue Google Calendar resource mappings still use `venue_resource_calendars`.
- Some module constants remain code-level defaults until each module is refactored to `ConfigService`.

## Mail Queue Management

Mail Queue is the centralized Email path for Apps Script MailApp delivery.

- Queue table: `mail_queue`
- Quota monitoring table: `mail_quota_snapshots`
- API module: `api/src/modules/mail/routes.js`
- Apps Script service: `MailQueueService`
- Scheduled processor: `processMailQueue()`

Current rules:
- Modules enqueue mail instead of calling `MailApp.sendEmail()` directly.
- The normal production `MailApp.sendEmail()` call should be inside `processMailQueue()`.
- Exception: login verification code email is sent immediately by `sendLoginVerificationEmail()` so the login challenge is not delayed by queue scheduling.
- Each execution processes at most 20 queue items.
- Pending selection is ordered by `HIGH`, `NORMAL`, then `LOW`.
- Only `scheduled_at <= now()` and `retry_count < 3` items are processed.
- `MailApp.getRemainingDailyQuota()` is checked during the execution; when remaining quota is 10 or below, only HIGH priority mail is sent.
- Failed sends write `error_message`; successful sends write `sent_at`.

Admin data sources now support queue listing, retry, cancel, resend, dashboard, quota status, health check, and trigger inspection via Apps Script.
The Apps Script admin UI exposes these controls through the `Email 服務管理系統` feature entry for administrator roles.

## Deployment

NAS API：

- 正常目標：`deploy-api.cmd`。
- 若 SMB 不通，可使用 SSH/tar 傳到 `/volume1/docker/project-api`。
- Rebuild：`docker compose up -d --build`。

Apps Script：

- `push-to-google.cmd`
- 最新已知部署版本：`@138`。

健康檢查：

- `http://192.168.3.2:3000/health`

## External Access

- `topchurchplus.com`：導向 Apps Script Web App。
- `api.topchurchplus.com`：規劃作 LINE webhook / 外部 API HTTPS 入口。
- 內網 NAS API health 正常。
- 外部 HTTPS 仍需防火牆、憑證、反向代理最終測試。
