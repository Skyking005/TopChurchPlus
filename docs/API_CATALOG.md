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

### System

模組：`api/src/modules/system/routes.js`

用途：

- 系統管理。
- 使用者管理。
- 權限管理。
- 參數管理。
- 使用紀錄與系統日誌。

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

重要 endpoint：

- `GET /qt/stock-check`：未來 Line App / LIFF 下單前檢查庫存。

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
- 總量與各會堂庫存。
- 庫存異動。

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
