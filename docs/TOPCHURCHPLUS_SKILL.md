# TopChurchPlus Skill 摘要

本文件是 Codex 本機 Skill `topchurchplus-dev-workflow` 的專案內摘要，方便在「系統開發管理」介面快速 review。實際 Skill 檔案仍放在 Codex 使用者設定目錄，主要規範如下。

## 使用時機

- 修改 TopChurchPlus 專案內 `.gs`、`.html`、`.js`、`.json`、`.sql`、`.md` 檔案。
- 觸及 PostgreSQL schema、seed、migration 或資料匯入。
- 部署 Synology NAS API、推送 Google Apps Script、提交 GitHub。
- 進行 UTF-8 繁體中文安全檢查、API/前端驗證與 Demo 測試。

## 核心流程

1. 先讀 `AGENTS.md`、`NEW_THREAD_GUIDE.md`、`HANDOFF.md`，再依任務類型讀相關文件。
2. 先設 PowerShell UTF-8，再用 `rg` / `rg -g` 搜尋相關檔案。
3. 修改前確認相關區塊沒有 mojibake。
4. 小修可直接處理；跨模組、資料庫、架構、全系統檢查與舊系統搬移任務，優先跑 Remote AI preflight。Local AI 只作為小型摘要或 Remote 不可用時的備援。
5. 手動修改優先使用 `apply_patch`，避免批次重寫中文檔案。
6. API 端用 Node 語法檢查，前端 HTML script partial 用 Node `new Function` 檢查。
7. 有 DB 異動時，先備份 NAS PostgreSQL，再套 migration，並確認索引與代表資料。
8. API 部署使用 `deploy-api.cmd`，Google Apps Script 推送使用 `push-to-google.cmd`。
9. 完成前依 `DOCUMENTATION_MAINTENANCE.md` 更新相關系統文件。
10. 完成後提交 GitHub，並在回覆中記錄測試、部署版本、DB 備份路徑與 commit。Token 與 Remote 運算紀錄寫在 commit body；若無法取得 Token，註明未取得。
11. 每月或災難復原相關任務需參照 `docs/DISASTER_RECOVERY_REBUILD.md` 與 `docs/RECOVERY_SECRETS_CHECKLIST.md`，並執行 `tools\check-rebuild-readiness.cmd -RunSmoke`。

## 固定工具

- `rg`：快速搜尋檔案與文字。
- `jq`：檢查 JSON / API 回應。
- `ast-grep`：找同類程式碼與結構化搜尋。
- `yq`：檢查 YAML。
- `SQLFluff`：SQL 風格檢查。
- `Playwright`：瀏覽器流程測試。
- `clasp`：Google Apps Script 推送。
- `Repomix`：必要時產生小型 repo 摘要。

## 注意事項

- PowerShell 不要用 `Get-Content | Set-Content` 批次重寫中文檔案。
- PowerShell 不要直接執行 `.ps1`；優先使用 `.cmd` wrapper。臨時腳本用 `tools\run-ps1.cmd <script.ps1>`，避免 Execution Policy 中斷。
- PowerShell smoke test 不要直接依賴 `Where-Object` 結果的 `.Count`；用 `Get-StableCount` 或 `Measure-Object`，避免單筆結果被 unwrap 後誤判。
- PowerShell 呼叫原生命令後，先保存 `$LASTEXITCODE` 到 `$exitCode`，再進行 pipeline 或輸出裁切。
- PowerShell inline SQL 若包含 `||`、複雜引號或中文，應改用 `.sql` 檔傳到 NAS 執行。
- API 測試若要送中文 JSON，使用 UTF-8 明確工具或 Node/.NET client，送完要讀回確認中文未變成 `????`。
- 每次 DB 變更要檢查外鍵與常用查詢索引。
- 每次任務完成都要檢查是否需更新 `HANDOFF`、`MODULES`、`API_CATALOG`、`DATABASE_SCHEMA`、`TEST_MATRIX`、`WORKFLOW` 或相關設計文件。
- `/new` 對話優先讀 `NEW_THREAD_GUIDE`，只載入本任務相關文件與程式碼。
