# TopChurchPlus Handoff

最後更新：2026-06-12

本文件給下一個 Codex `/new` 後快速接手使用。請先讀 `AGENTS.md`，再讀本文件。若任務涉及資料庫、LINE/LIFF、牧養身份、部署或 workflow，再讀對應文件。

## 現況一句話

TopChurchPlus 目前是 Google Apps Script 前端 + Apps Script bridge + NAS Node.js API + PostgreSQL 的漸進式重構系統；MSSQL 仍保留為部分舊資料來源；LINE/LIFF 已有 Phase 0-5 基礎，BPM workflow 已有 v1 engine，但部分報表快取與正式營運驗證仍待完成。

## 最新重要進度

- 最新 Git commit：`2e47ce4 Add AI context check and BPM workflow engine`
- NAS API 已 rebuild，`project-api` container 正常。
- NAS health：`http://192.168.3.2:3000/health`
- Apps Script 最新已知部署：`@138`
- `Script_Login.html` 第一階段已拆分，靜態常數在 `Script_FeatureConfig.html`。
- Workflow/BPM v1 已新增 DB、API、Apps Script wrappers。
- LINE Bot Phase 2-5 初版已新增：動態會員選單、LIFF 會員中心/領袖中心 API、後台管理中心 API、Rich Menu 三層指派策略。
- LINE Bot Phase 2-5 migration 已套用到 NAS PostgreSQL；套用前已有 DB dump 備份。
- `tools/check-ai-context-freshness.cmd` 已新增，可檢查 AI context 是否落後 Git HEAD。
- `.claspignore` 已排除 `CLAUDE_files/**`。
- QT 管理頁已重整為訂購、領取、財務、報表、庫存五個分頁；領取月份設定使用 `system_config.QT_OPEN_PICKUP_MONTH`；匯款審核、領取扣庫存防重與正式 ledger 請先看 `docs/reviews/QT_DBA_REVIEW.md`。

## 必讀文件

最小讀取順序：

1. `AGENTS.md`
2. `docs/PROJECT_OVERVIEW.md`
3. `docs/CURRENT_ARCHITECTURE.md`
4. `docs/DATABASE_SCHEMA.md`
5. `docs/ACTIVE_ROADMAP.md`
6. `docs/KNOWN_ISSUES.md`
7. `docs/AI_WORKFLOW.md`

背景文件：

- `PROJECT_STATE.md`
- `docs/API_CATALOG.md`
- `docs/MODULES.md`
- `docs/WORKFLOW.md`
- `docs/LOCAL_AI_TASK_GUIDE.md`
- `docs/LOCAL_AI_WORKFLOW.md`
- `docs/DISASTER_RECOVERY_REBUILD.md`

## 禁止事項

- 不要在未確認時修改業務邏輯程式碼。
- 不要把 Pastoral Domain 權限綁到後台 Account Role。
- 不要讓 LINE/LIFF 外部入口沿用後台 session 或 `role_feature_permissions`。
- 不要一次性重寫 Apps Script 前端。
- 不要未備份就做 DB migration。
- 不要改 GoDaddy、LINE webhook、正式 env、防火牆、憑證，除非使用者明確要求。
- 不要把 `.env`、API key、LINE secret、DB credential 放入文件或 AI context。

## Identity Boundary v2

這是接下來最重要的設計約束。

Administrative Domain：

- 後台同工登入。
- `accounts`、`account_roles`、`role_feature_permissions`。
- 控制行政功能入口與同工操作。

Pastoral Domain：

- 會友、牧養資料、LINE/LIFF 外部身份。
- `pastoral_members`、`member_accounts`、`line_users`、`line_liff_sessions`。
- 牧養資料範圍與會友自助權限。

硬規則：

- Pastoral Domain 權限不可依賴後台 Account Role。
- 後台角色只控制行政入口，不代表會友身份。
- 外部入口權限要走會友身份、LIFF session 或牧養專用權限。

## 目前架構

前端：

- `Index.html`
- `Login.html`
- `Script_FeatureConfig.html`
- `Script_Login.html`
- `<Module>.html`
- `Script_<Module>.html`

Bridge：

- `程式碼.gs`

API：

- `api/src/index.js`
- `api/src/modules/*/routes.js`
- `api/src/shared/*`

DB：

- `database/schema.sql`
- `database/20260612_bpm_engine.sql`
- `database/20260611_id_rules_and_meetings.sql`
- pastoral / forms / line / liff / finance / asset / venue migrations

## Workflow/BPM v1

已完成：

- `bpm_definitions`
- `bpm_instances`
- `bpm_history`
- `/workflow/definitions`
- `/workflow/instances`
- `/workflow/instances/:id/history`
- `/workflow/dashboard`
- Apps Script wrappers:
  - `getWorkflowDefinitions`
  - `saveWorkflowDefinition`
  - `getWorkflowInstances`
  - `getWorkflowDashboard`
  - `getWorkflowInstanceDetail`
  - `createWorkflowInstance`
  - `addWorkflowHistory`

下一步：

- 做 workflow 前端工作台。
- 補 tests/api workflow smoke。
- 決定第一個導入 BPM 的業務流程。

## LINE / External Access

已知：

- LINE webhook receiver 已存在。
- LIFF `/liff/member-center` 與 `/liff/leader-center` 已存在。
- `menu_items` 會產生 LIFF 會員中心動態選單。
- `line_leader_scope_rules` 用職稱對應領袖 scope；`attendance_summary` / `course_summary` 是領袖中心快取來源，目前表結構已建立，資料排程仍待補。
- 後台 Line App 會友管理系統已有管理中心分頁，可管理 config、notification templates、menu items 與檢視 audit logs。
- Rich Menu 採 Guest / Member / Leader 三層策略，實際權限仍由 LIFF 後端判斷，不依賴 Rich Menu。
- 內網 API health 正常。
- `api.topchurchplus.com` 規劃導向 NAS。
- 外部 HTTPS 曾可通，但正式 LINE webhook/LIFF 營運仍需以 LINE Developers Verify 與真機測試再次確認。
- Webhook signature mode 先保持準備/記錄模式，未完成外部 HTTPS 前不要切正式。

## 部署注意

NAS API：

- `deploy-api.cmd` 預期 SMB share，但目前 SMB 可能不可用。
- SSH key 可用：`%USERPROFILE%\.ssh\project_api_deploy`。
- 若 SMB 不通，可用 SSH/tar 傳檔後執行 docker compose rebuild。

Apps Script：

- `push-to-google.cmd`
- 推送前確認 `.claspignore` 不會包含 `api/**`、`database/**`、`docs/**`、`tools/**`、`tmp/**`、`CLAUDE_files/**`。

## 下一步建議

1. 重建 AI context snapshot，讓 `check-ai-context-freshness` 回 PASS。
2. 完成外部 HTTPS / LINE webhook 驗證。
3. 盤點 Identity Boundary v2，特別是 Pastoral/Line/LIFF。
4. 為 workflow engine 建立前端工作台與 smoke test。
5. 繼續拆分 `Script_Login.html`，一次只拆一個職責。
6. 將 SQL migration 納入部署 checklist 或工具。

## 常用驗證

```powershell
git status --short
tools\check-ai-context-freshness.cmd
tools\check-api.cmd -SkipHealth
tests\api\run-smoke.cmd
Invoke-RestMethod -Uri "http://192.168.3.2:3000/health"
```

## 本文件維護規則

- 任務完成若改變架構、部署、DB、身份邊界、AI workflow，必須更新本文件。
- 不要把每個 commit 都寫進來，只保留下一位接手者需要知道的現況。
