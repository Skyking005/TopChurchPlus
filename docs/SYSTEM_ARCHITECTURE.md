# TopChurchPlus System Architecture

最後更新：2026-06-09

本文件是系統架構索引，目標是讓後續任務不用每次重新掃描整個專案。細節可再讀 `docs/HANDOFF.md`、`docs/core_platform_architecture.md`、`docs/WORKFLOW.md`。

## 整體架構

TopChurchPlus 目前採三層漸進式架構：

```text
Google Apps Script Web App
  - 使用者主要操作介面
  - 透過 google.script.run 呼叫 Apps Script bridge

Apps Script bridge：程式碼.gs
  - 保留既有前端呼叫方式
  - 將資料請求轉送至 NAS API

NAS Node.js API + PostgreSQL
  - 主要業務邏輯
  - 系統權限、資料存取、檔案、稽核、跨系統關聯
```

目前 domain `topchurchplus.com` 仍導向 Google Apps Script Web App。NAS API 正式路徑仍是 `/volume1/docker/project-api`，Docker service/container 仍是 `project-api`。

## 前端結構

主要檔案：

- `Index.html`：主頁組裝與 partial include。
- `Login.html`：登入入口。
- `Script_Login.html`：功能卡片、首頁入口、功能可見性、主畫面切換。
- `Style.html`：共用樣式。
- `<Module>.html`：模組畫面。
- `Script_<Module>.html`：模組前端邏輯。
- `程式碼.gs`：Apps Script bridge，將 `google.script.run` 接到 API。

前端原則：

- 保留 `google.script.run` 流程，除非任務明確要求遷移。
- 新模組需在 `Index.html`、`Script_Login.html`、`程式碼.gs` 接線。
- 中文文案修改前先確認沒有亂碼。
- 所有清單預設 20 筆一頁。

## API 結構

API 入口：

- `api/src/index.js`：註冊 middleware 與所有 route module。
- `api/src/app.js`：Express app 建立。
- `api/src/db.js`：PostgreSQL 連線。
- `api/src/middleware/*`：API key、request context、error handler。
- `api/src/shared/*`：共用 users、permissions、params、files、audit、cross-system、format。

API 模組位置：

```text
api/src/modules/<module>/routes.js
```

新模組建議逐步拆為：

```text
routes.js       HTTP request/response
service.js      商業邏輯
repository.js   SQL 存取
mapper.js       DB row 與 API payload 轉換
validators.js   輸入驗證
```

現況仍有許多模組集中在 `routes.js`；細部修正時以低風險改善為主，不做一次性大重構。

## 權限架構

系統入口權限：

- `role_feature_permissions` 控制各角色對系統功能的 `none/read/edit`。
- `Script_Login.html` 依 feature access 顯示功能卡片。
- 管理員、超級管理者可看多數後台資料；超級管理者保留系統層級變更。

模組內資料範圍權限：

- 專案：`project_permissions`。
- 牧養：`account_pastoral_church_permissions`。
- 其他模組依需求各自設計，例如未來場地、教育、Line App、會友外部入口。

注意：

- 外部會友入口不可沿用同工後台權限。
- 權限不足時不只前端隱藏，API 也要檢查。

## 共用底層

已落地或規劃中的共用底層：

- 共用權限：`role_feature_permissions` 與 `api/src/shared/permissions.js`。
- 共用參數：`param_categories`、`param_items`，舊 `params` 尚未完全停用。
- 共用檔案：`files`、`file_links`、`api/src/shared/files.js`。
- 共用稽核：`audit_logs`、`api/src/shared/audit.js`。
- 使用紀錄：`system_usage_logs`。
- 跨系統關聯：`entity_links`、`domain_events`、`api/src/shared/cross-system.js`。
- 外部身份橋接：`line_users`、`member_accounts`。

## 檔案管理

原則：

- 所有模組檔案先寫入 `files`。
- 再用 `file_links` 掛回業務 entity。
- 文件產出逐步移至 NAS API，不再依賴 Google Drive。

適用：

- 牧養照片、新人單。
- 財務報價單、收據、憑證、請款附件。
- 資產照片與保固文件。
- 專案 DOC/PDF。
- 表單與場地附件。

## 外部入口

外部入口包含：

- LIFF / Line App。
- 公開表單。
- 櫃台工作站。
- 未來會友 App。

外部入口原則：

- 使用者只能操作自己的資料或公開資料。
- 必須有 session/token 驗證。
- LIFF 入口已加入安全框架，但目前是監控模式。
- 公開表單停止或過期時，要阻止新增與編輯並清楚提示。

## 部署

NAS API：

```powershell
.\deploy-api.cmd
```

Google Apps Script：

```powershell
.\push-to-google.cmd
```

建議順序：

1. 本地檢查。
2. 部署 NAS API。
3. API 測試。
4. Git commit + push。
5. Push Apps Script，讓 deployment description 帶最新 commit。

## 災難復原

重建方案與每月維護檢查位於：

- `docs/DISASTER_RECOVERY_REBUILD.md`
- `tools/check-rebuild-readiness.cmd`

每月執行：

```powershell
.\tools\check-rebuild-readiness.cmd -RunSmoke
```

## 相關文件

- `docs/HANDOFF.md`
- `docs/WORKFLOW.md`
- `docs/DISASTER_RECOVERY_REBUILD.md`
- `docs/core_platform_architecture.md`
- `docs/DATABASE_MIGRATION_WORKFLOW.md`
- `docs/LEGACY_MSSQL_SYNC_WORKFLOW.md`
- `docs/API_CATALOG.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/MODULES.md`
- `docs/TEST_MATRIX.md`
