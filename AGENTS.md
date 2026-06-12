# TopChurchPlus Codex Agent Guide

最後更新：2026-06-12

本文件是給 Codex / AI coding agent 的工作規範，不是使用者 README。開始任何任務前，先讀本文件與 `docs/HANDOFF.md`；若任務涉及資料庫、部署、LINE、牧養身份、簽核或舊系統同步，再讀對應文件。

## Prime Directive

- 先檢查 `git status --short`，保留使用者既有變更。
- 沒有明確要求時，不要改 GoDaddy、正式 Apps Script deployment、LINE webhook、正式環境變數、防火牆或 NAS 系統設定。
- 修改範圍只限目前任務；不要順手重構無關模組。
- 文件任務只改文件，不改業務邏輯程式碼。
- 任何資料庫 schema 或資料 migration，必須先說明風險、備份方式、驗證方式；正式執行後要查回驗證。
- 看到 mojibake 或不可讀中文時，先回報，不要把亂碼當成正常內容繼續重寫。

## Required Reading Order For `/new`

1. `AGENTS.md`
2. `docs/HANDOFF.md`
3. `docs/PROJECT_OVERVIEW.md`
4. `docs/CURRENT_ARCHITECTURE.md`
5. `docs/ACTIVE_ROADMAP.md`
6. 任務相關文件，例如 `docs/DATABASE_SCHEMA.md`、`docs/API_CATALOG.md`、`docs/LOCAL_AI_TASK_GUIDE.md`

若 token 不足，至少讀 `AGENTS.md`、`docs/HANDOFF.md`、`PROJECT_STATE.md`。

## Encoding And File Editing

- 專案文字檔視為 UTF-8，包含 `.gs`、`.html`、`.js`、`.json`、`.sql`、`.md`。
- Apps Script 與 HTML partial 有大量繁體中文；保留原文，不要任意改名。
- 優先用 `apply_patch` 小範圍修改。
- 避免用 PowerShell `Get-Content | Set-Content` 批次重寫中文檔案，容易改到 BOM、換行或造成 mojibake。
- PowerShell 搜尋檔案時使用 `rg`，例如 `rg "pattern" -g "*.html" -g "*.gs"`。
- 含中文 JSON 的 API 測試不要直接用 `Invoke-RestMethod -Body $json`；使用 `tools/invoke-json-utf8.cmd` 或明確 UTF-8 的 .NET HttpClient。

## Identity Boundary v2

TopChurchPlus 必須維持兩個身份邊界：

- Administrative Domain：同工後台、`accounts`、`account_roles`、`role_feature_permissions`、系統入口權限。
- Pastoral Domain：會友、牧養資料、`pastoral_members`、`member_accounts`、`line_users`、LIFF/LINE 入口、牧養資料範圍。

硬性規則：

- Pastoral Domain 權限不可依賴後台 Account Role。
- 會友可看/可改的資料不能因為某個 `accounts.role` 而自動授權。
- 後台角色只控制行政系統入口與同工操作，不等於會友身份。
- 牧養資料範圍應由牧養專用權限或會友身份橋接控制，例如 `account_pastoral_church_permissions`、`member_accounts`、LIFF session。
- LINE/LIFF 外部入口不可沿用同工後台 session 或 `role_feature_permissions`。

修改 Pastoral、Line App、LIFF、Education、Attendance、Forms 會友資料時，先確認是否跨越此邊界。

## Architecture Snapshot

- 前端：Google Apps Script Web App。
- Apps Script bridge：`程式碼.gs`，保留 `google.script.run` 對前端的相容性。
- API：NAS Docker 上 Node.js Express，路徑 `/volume1/docker/project-api`，container/service `project-api`。
- DB：NAS PostgreSQL，舊 MSSQL 仍作為會友、課程、QT、點名等過渡來源。
- 主要組裝：`Index.html` include HTML partial 與 `Script_*.html`。
- 功能入口設定：`Script_FeatureConfig.html` 保存 `SYSTEM_FEATURES`、`ROLE_FEATURE_ACCESS`、`MAIN_VIEW_IDS`。
- 登入與功能選單：`Script_Login.html`。

## Development Workflow

1. 檢查 `git status --short`。
2. 讀本次任務相關文件與模組檔案。
3. 用 `rg` 找引用，不靠猜。
4. 小範圍修改。
5. 最小驗證：
   - API/JS：`tools/check-api.cmd -SkipHealth`
   - Apps Script partial：`tools/check-scripts.cmd`
   - API smoke：`tests/api/run-smoke.cmd`
6. 有 API 變更時，部署 NAS API 並測 `/health`。
7. 有 Apps Script 變更時，執行 `push-to-google.cmd`。
8. 更新必要文件。
9. Commit/push 只有在使用者要求或任務流程要求時做。

## Deployment Notes

- `deploy-api.cmd` 預設透過 SMB `\\192.168.3.2\docker\project-api` 複製檔案；目前 SMB 可能不可用。
- SSH key：`%USERPROFILE%\.ssh\project_api_deploy`。
- 若 SMB 不可用，可用 SSH/tar 傳送到 `/volume1/docker/project-api`，再執行：

```powershell
ssh -i "$env:USERPROFILE\.ssh\project_api_deploy" cetu@192.168.3.2 "cd /volume1/docker/project-api && sudo -n /usr/local/bin/docker compose up -d --build"
```

- Apps Script 推送：`push-to-google.cmd`。
- `.claspignore` 必須排除 `api/**`、`database/**`、`docs/**`、`tools/**`、`tmp/**`、`CLAUDE_files/**`。

## Database Safety

- 實際 schema 以 `database/*.sql` 與 PostgreSQL 為準；文件是索引，不取代 migration。
- 新增 FK 必須補 index。
- 與 MSSQL 搬移相關欄位不要任意改名或改型別。
- `files` + `file_links` 是共用附件模型，不要為新模組輕易另建附件表。
- `audit_logs` 記錄敏感操作；測試使用者若帶不存在的 `staffId` 會觸發 FK 錯誤，這是正常防護。

## Current High-Risk Areas

- Identity Boundary v2 尚需全面落實，特別是 Pastoral/Line/LIFF。
- `Script_Login.html` 已抽出靜態常數，但仍過大。
- `api/src/modules/project/routes.js`、部分大型 `routes.js` 尚未拆 service。
- SQL migration 尚未完整整合到 deploy 流程。
- LINE webhook 外部 HTTPS 仍依賴防火牆、憑證與反向代理最終確認。
- Apps Script 與 API 職責仍在漸進式整理。

## AI / Local Model Workflow

- Local/Remote AI 只能做前期分析、摘要、preflight，不直接改正式 repo、DB、NAS、GitHub。
- 使用 `tools/build-ai-context.cmd` 建立安全 snapshot。
- 使用 `tools/check-ai-context-freshness.cmd` 判斷 snapshot 是否落後 Git HEAD。
- AI context 若落後，只能當背景參考，不能當最新事實來源。

## Final Response Expectations

回報時用繁體中文，包含：

- 修改檔案清單。
- 完成內容。
- 驗證結果。
- 未完成或阻塞事項。
- 若執行部署，列出 NAS/API/Apps Script 結果。
