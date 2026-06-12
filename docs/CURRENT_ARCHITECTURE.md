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

注意：

- 不要把大型商業邏輯新增回 `程式碼.gs`。
- 新 API 應優先放在 NAS API，Apps Script 只保留橋接。

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

- admin-supply, asset, attendance, auth, core, counter, dev-management, documents, education, finance, forms, linebot, liff, pastoral, project, qrcode, qt, shortlinks, system, sunday-message, venue, workflow, worklog, zoom。

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
