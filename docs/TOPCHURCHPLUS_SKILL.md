# TopChurchPlus Skill 摘要

本文件是 Codex 本機 Skill `topchurchplus-dev-workflow` 的專案內摘要，方便在「系統開發管理」介面快速 review。實際 Skill 檔案仍放在 Codex 使用者設定目錄，主要規範如下。

## 使用時機

- 修改 TopChurchPlus 專案內 `.gs`、`.html`、`.js`、`.json`、`.sql`、`.md` 檔案。
- 觸及 PostgreSQL schema、seed、migration 或資料匯入。
- 部署 Synology NAS API、推送 Google Apps Script、提交 GitHub。
- 進行 UTF-8 繁體中文安全檢查、API/前端驗證與 Demo 測試。

## 核心流程

1. 先讀 `AGENTS.md`、`HANDOFF.md`、`MODULES.md`、`API_CATALOG.md`。
2. 先設 PowerShell UTF-8，再用 `rg` / `rg -g` 搜尋相關檔案。
3. 修改前確認相關區塊沒有 mojibake。
4. 手動修改優先使用 `apply_patch`，避免批次重寫中文檔案。
5. API 端用 Node 語法檢查，前端 HTML script partial 用 Node `new Function` 檢查。
6. 有 DB 異動時，先備份 NAS PostgreSQL，再套 migration，並確認索引與代表資料。
7. API 部署使用 `deploy-api.cmd`，Google Apps Script 推送使用 `push-to-google.cmd`。
8. 完成後提交 GitHub，並在回覆中記錄測試、部署版本、DB 備份路徑與 commit。

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
- PowerShell inline SQL 若包含 `||`、複雜引號或中文，應改用 `.sql` 檔傳到 NAS 執行。
- API 測試若要送中文 JSON，使用 UTF-8 明確工具或 Node/.NET client，送完要讀回確認中文未變成 `????`。
- 每次 DB 變更要檢查外鍵與常用查詢索引。
