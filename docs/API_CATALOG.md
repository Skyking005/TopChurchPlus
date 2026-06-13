# TopChurchPlus API Catalog

最後更新：2026-06-09

本文件是 API 端點索引。實際 request/response 以 `api/src/modules/*/routes.js` 為準。

## 共用規則

- API base URL 目前正式為 NAS API：`http://192.168.3.2:3000` 或對外轉址。
- 內部 API 需 `x-api-key`。
- 需要登入者資訊時，使用 `x-current-user`，內容為 base64url(JSON)。
- Apps Script bridge 由 `程式碼.gs` 的 `apiRequest()` 統一處理。
- LIFF public routes 在 `api/src/index.js` 設為 public prefix `/liff`，但 session 相關仍做 LINE token/session 驗證。

## Core / Auth / System

### Core

- `GET /health`：API 健康檢查。
- `GET /initial-data` 或 core 類 endpoint：供 Apps Script 初始化資料使用，依實作為準。

### Auth

模組：`api/src/modules/auth/routes.js`

用途：

- 內部登入。
- 陌生裝置或 IP 驗證。
- 登入紀錄。

### Mail Queue

模組：`api/src/modules/mail/routes.js`

用途：

- 統一 Email 佇列。
- 支援 Apps Script `MailApp` 配額管理與排程批次發送。
- 所有模組應 enqueue mail，不直接呼叫 `MailApp.sendEmail()`。

目前 endpoint：

- `POST /mail/queue`：新增單筆郵件佇列。
- `POST /mail/queue/bulk`：新增多筆郵件佇列，支援 `dedupeKey` 去重。
- `GET /mail/queue/pending`：排程取得待寄郵件，支援 `limit`、`priority`。
- `PATCH /mail/queue/:id/sent`：標記已寄送。
- `PATCH /mail/queue/:id/failed`：標記寄送失敗並累加 retry count。
- `PATCH /mail/queue/:id/skipped`：標記略過。
- `GET /mail/queue/stats`：查詢 pending / failed / 今日寄出統計。

#### Mail Queue Management Extension

Management and monitoring endpoints:
- `GET /mail/queue`: list mail queue items. Filters: `status`, `priority`, `moduleKey`, `recipientEmail`, `startDate`, `endDate`, `page`, `pageSize`.
- `GET /mail/queue/:id`: view one queue item, including `errorMessage`.
- `POST /mail/queue/:id/retry`: retry a `FAILED` item when `retry_count < 3`.
- `POST /mail/queue/:id/cancel`: cancel a `PENDING` item by marking it `SKIPPED`.
- `POST /mail/queue/:id/resend`: create a new `PENDING` queue item from a `SENT` item.
- `GET /mail/queue/dashboard`: dashboard data source.
- `GET /mail/queue/quota`: latest quota snapshot.
- `GET /mail/queue/health`: queue health status.
- `POST /mail/quota-snapshots`: Apps Script records `MailApp.getRemainingDailyQuota()` snapshots.

Apps Script helpers:
- `processMailQueue(limit)`: scheduled processor, max 20 per execution.
- `installMailQueueTriggers()`: installs 5-minute time-driven trigger.
- `checkMailQueueTriggers()`: reports current trigger status.

Rules:
- `HIGH > NORMAL > LOW`.
- `scheduled_at <= now()` and `retry_count < 3` for pending processing.
- `remainingQuota <= 10` sends only HIGH priority mail.
- Modules should enqueue mail; direct `MailApp.sendEmail()` is only allowed inside `processMailQueue()`.

### System

模組：`api/src/modules/system/routes.js`

用途：

- 系統管理。
- 使用者管理。
- 權限管理。
- 參數管理。
- 使用紀錄與系統日誌。

#### Config Key Management

Routes:
- `GET /system/config-keys`: list centralized configurable keys. Query: `namespace`, `keyword`.
- `POST /system/config-keys`: create a centralized config key.
- `PUT /system/config-keys/:namespace/:configKey`: update a centralized config key.

Security:
- Super admin only.
- Secret values are masked in list/update responses.
- Secret update supports `keepExistingSecret` so the UI can leave the value blank without overwriting the stored secret.
- `ConfigService.get(namespace, key)`, `ConfigService.getSecret(namespace, key)`, and `ConfigService.set(namespace, key, value)` are the backend entry points for new module integrations.

### Dev Management

模組：`api/src/modules/dev-management/routes.js`

用途：

- 系統開發 Issue 提案。
- 核心文件 Review。
- 版本更新歷程。

目前 endpoint：

- `GET /dev-management/issues`
- `POST /dev-management/issues`
- `PUT /dev-management/issues/:issueId`
- `GET /dev-management/documents`
- `GET /dev-management/documents/:documentKey`
- `GET /dev-management/releases`
- `POST /dev-management/releases`

注意：

- 僅超級管理者可讀寫。
- 文件讀取使用白名單，避免任意讀取伺服器檔案。
- 文件 Review 目前包含 `HANDOFF`、`SYSTEM_ARCHITECTURE`、`DATABASE_SCHEMA`、`API_CATALOG`、`MODULES`、`WORKFLOW`、`TEST_MATRIX`、`DISASTER_RECOVERY_REBUILD`、`RECOVERY_SECRETS_CHECKLIST` 等核心文件。
- 新增/更新會寫入 `audit_logs`，system key 為 `dev_management`。

## Project

模組：`api/src/modules/project/routes.js`

用途：

- 專案清單與搜尋。
- 專案詳細資料。
- 專案新增/編輯/儲存。
- 專案權限。
- 會議紀錄。
- 專案文件產出。

注意：

- 專案資料權限不可只靠前端。
- 有完全控制權限者可保存專案。

## Finance

模組：`api/src/modules/finance/routes.js`

用途：

- 採購單。
- 預借單。
- 支出證明。
- 請款單。
- 獨立請款。
- 報價單 PDF 與文件列印。

注意：

- 支出證明需掛請款。
- 財務資料與資產、專案可能透過 `entity_links` 關聯。

## Pastoral

模組：`api/src/modules/pastoral/routes.js`

用途：

- 會友清單。
- 會友詳細。
- 會友新增/編輯/停用。
- 牧區、會堂、會友分類選項。
- 會友照片、新人單圖片。
- 牧養資料權限。

注意：

- 會友主檔是 Line App、教育、點名、表單的重要基礎。
- 修改 CRUD 時要測同名提醒、資料範圍權限、附件。

## Forms

模組：`api/src/modules/forms/routes.js`

用途：

- 表單建立。
- 題目管理。
- 外部公開填寫。
- 回覆與統計。
- 圖片附件。
- 編輯連結。

注意：

- 公開填寫需 Email。
- 停止或過期後不可新增/編輯。

## Counter

模組：`api/src/modules/counter/routes.js`

用途：

- 櫃台工作站。
- PIN Code 管理。
- 報名繳費與 QT 領取。
- QRCode 報到入口。

注意：

- PIN Code 需綁使用者與會堂。
- 金流與會堂追蹤很重要。

## QT

模組：`api/src/modules/qt/routes.js`

用途：

- QT 庫存。
- 庫存異動。
- 調撥。
- 訂購與庫存檢查。
- Dashboard 與領取月份設定。

重要 endpoint：

- `GET /qt/options`：QT 類型、價格方案與會堂選項。
- `GET /qt/dashboard`：訂購、付款與指定月份領取摘要。
- `GET /qt/settings`：QT 模組設定，目前包含開放領取月份。
- `PUT /qt/settings`：更新 QT 模組設定，使用既有 `system_config`。
- `GET /qt/orders`：QT 訂單列表。
- `GET /qt/orders/:orderId`：QT 訂單明細與領取項目。
- `GET /qt/reports/:type`：QT 報表，支援 `finance`、`pickup`、`expiring`、`pastoral-summary`、`pastoral-tree`。
- `GET /qt/notifications/:type/preview`：預覽 QT 手動 Email 通知收件人，`type` 支援 `unreceived`、`expiring`。
- `POST /qt/notifications/:type/results`：Apps Script 手動寄送 QT Email 後回寫每位收件人的成功/失敗結果，並記錄 `notification_logs` 與 `audit_logs`。
- `GET /qt/inventory`：QT 月庫存。
- `GET /qt/inventory/reconciliation`：Phase 3B-2 只讀庫存盤點，支援 `qtMonth`、`qtType`、`churchId`，回傳 Physical / Reserved / Retail、active reservations 與 reconciliation exceptions；不會自動修復資料。
- `POST /qt/inventory/monthly`：建立 QT Phase 2A 月度庫存主檔，使用 `qtMonth`、`qtType`、`churchId`、`physicalQuantity`、`reservedQuantity`、`retailQuantity`、`estimatedInboundQuantity`、`actualInboundQuantity`。
- `GET /qt/inventory/movements`：QT 庫存異動紀錄，支援 `startDate`、`endDate`、`churchId`、`qtMonth`、`qtType` 查詢。
- `POST /qt/inventory/movements`：新增 QT 庫存異動。
- `POST /qt/inventory/transfers`：QT 跨會堂庫存調撥。
- `GET /qt/stock-check`：未來 Line App / LIFF 下單前檢查庫存。

注意：

- 開放領取月份目前使用 `system_config.QT_OPEN_PICKUP_MONTH`，不需 migration。
- QT Email 通知目前不自動寄送；管理端按鈕會透過 Apps Script `MailApp.sendEmail` 手動寄送，再回寫 API 紀錄結果。
- QT Phase 2A 新庫存主檔從 `202609` 開始，`qtType` 使用 `ADULT` / `CHILD`；2026-08 含以前 legacy 資料不會自動匯入 Reserved/Retail/Physical 模型。
- 匯款證明審核、領取自動扣庫存防重、正式 stock ledger/月結、QT 與 Counter 金流關聯需先看 `docs/reviews/QT_DBA_REVIEW.md`。

### QT Phase 2B Reservation API

- `GET /qt/inventory/reservations`：查詢 QT reservation records，支援 `reservationId`, `inventoryId`, `qtMonth`, `qtType`, `churchId`, `orderId`, `orderItemId`, `memberId`, `status`。
- `POST /qt/inventory/reservations`：建立 QT reservation。會在 transaction 內鎖定 `qt_inventory_monthly`，增加 Reserved Inventory、減少 Retail Inventory、保持 Physical Inventory 不變，並寫入 `qt_inventory_movements` 與 `audit_logs`。
- `POST /qt/inventory/reservations/:reservationId/release`：釋放 QT reservation。會在 transaction 內恢復 Retail Inventory、減少 Reserved Inventory、保持 Physical Inventory 不變，並寫入 `qt_inventory_movements` 與 `audit_logs`。
- `POST /qt/orders/:orderId/payment/approve`：Phase 3B-1/3B-2 受控付款審核入口。僅處理 2026-09 含以後 QT 訂單項目，將待審核付款轉為 `posted`，在同一 transaction 建立 active reservation、扣減 Retail Inventory、寫入 inventory log 與 audit log；不修改 fulfill、Line Bot、Transfer 或 Forecast。
- `POST /qt/order-items/:orderItemId/fulfill`：Package A 同堂領取入口。僅處理 2026-09 含以後、已付款且已有 active reservation 的 QT order item；在同一 transaction 將 reservation 轉 `fulfilled`、更新 `qt_order_items.is_received`、扣減 Physical / Reserved Inventory，並寫入 inventory log 與 audit log。不支援跨堂領取。

限制：

- Phase 3B 付款審核僅限受控管理端入口，不會自動 backfill legacy 資料。
- Package A 領取僅限同堂，不處理跨堂 Transfer。
- Phase 2B 不會修改 Line Bot、Transfer 或 Forecast。

## Asset / Admin Supply

### Asset

模組：`api/src/modules/asset/routes.js`

用途：

- 資產清單。
- 資產詳細與保存。
- 位置管理。
- 從請款或採購建立資產。

### Admin Supply

模組：`api/src/modules/admin-supply/routes.js`

用途：

- 行政消耗品庫存。
- 總量與各會堂/倉庫位置庫存。
- 庫存異動，包含異動人與交接人。
- 低庫存狀態由 API 回傳到每個庫存位置。
- 新增物資未填流水號時，由 API 產生 `I0001` 格式流水號。
- 物資移除採 `isActive: false` 停用標註，不做 hard delete。

## Venue / Zoom

### Venue

模組：`api/src/modules/venue/routes.js`

用途：

- 場地管理。
- 場地借用週檢視。
- 借用申請與排他檢查。

### Zoom

模組：`api/src/modules/zoom/routes.js`

用途：

- Zoom 帳號管理。
- Zoom 帳號借用週檢視。
- 同時段排他。

## Education / Attendance

### Education

模組：`api/src/modules/education/routes.js`

用途：

- 課程管理。
- 學員狀態。
- 培育階段預估。
- 講師班表。

### Attendance

模組：`api/src/modules/attendance/routes.js`

用途：

- 小家點名統計。
- 聚會統計。
- 會友最近聚會狀況。

## Qrcode

模組：`api/src/modules/qrcode/routes.js`

用途：

- 活動報到設定。
- QRCode 掃描報到。
- 報到名單。

注意：

- 掃描工作區應在櫃台工作站，而不是內部後台。

## Documents

模組：`api/src/modules/documents/routes.js`

用途：

- NAS 端 DOCX/PDF 文件產出。
- 減少對 Google Drive 的依賴。

注意：

- 文件模板與簽核欄位需依各模組規格處理。

## Line App / LIFF

### Line App 會友管理

模組：`api/src/modules/linebot/routes.js`

目前主要 endpoint：

- `GET /linebot/dashboard`
- `GET /linebot/users`
- `GET /linebot/channels`
- `POST /linebot/channels`
- `PUT /linebot/channels/:channelId`
- `GET /linebot/channels/:channelId/line-api-readiness`
- `GET /linebot/links`
- `POST /linebot/links`
- `PUT /linebot/links/:linkId`
- `DELETE /linebot/links/:linkId`
- `GET /linebot/modules`
- `PUT /linebot/modules/:moduleKey`
- `GET /linebot/rich-menus`
- `POST /linebot/rich-menus`
- `PUT /linebot/rich-menus/:richMenuId`
- `GET /linebot/events`

注意：

- 內部技術 key/path 仍是 `linebot`，介面名稱是 `Line App會友管理系統`。
- LINE API 目前只預備，不主動呼叫。

### LIFF

模組：`api/src/modules/liff/routes.js`

目前 endpoint：

- `GET /liff`
- `GET /liff/config`
- `POST /liff/session`
- `GET /liff/me`
- `POST /liff/bind-member`
- `GET /liff/portal-links`

注意：

- `/liff/session` 驗證 LINE ID Token。
- `/liff/me`、`/liff/bind-member`、`/liff/portal-links` 需 LIFF session。
- LIFF security 目前預設監控模式，不阻擋。

## Short Links

模組：`api/src/modules/shortlinks/routes.js`

用途：

- 外部表單與活動連結短網址。

注意：

- 可用於表單發佈與 Line App 分享。

## Smoke Tests

API smoke test 位於：

- `tests/api/run-smoke.cmd`
- `tests/api/smoke-*.ps1`

新增 API 或修正高風險流程時，優先補對應 smoke test。
