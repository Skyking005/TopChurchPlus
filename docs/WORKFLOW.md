# TopChurchPlus Development Workflow

## 原則

- 專案文字檔一律以 UTF-8 處理。
- 修改中文內容前，先確認相關區塊沒有亂碼。
- 手動修改優先使用 `apply_patch`，避免批次重寫中文檔。
- 每次任務只改與本次需求相關的檔案。
- 資料庫結構調整需先提出欄位、用途、索引與 MSSQL 對應，再確認後執行。
- 送出含中文的 API JSON 測試資料時，使用 `tools/invoke-json-utf8.cmd`，不要直接用 `Invoke-RestMethod -Body $json`。
- 寫入含中文的 Demo 或測試資料後，必須查回資料確認中文可讀，再結束任務。

## 常用工具

先啟用 PowerShell UTF-8：

```powershell
. .\tools\setup-utf8.ps1
```

檢查開發 CLI 是否可用：

```powershell
.\tools\check-dev-cli.cmd
```

若新開終端尚未吃到工具 PATH，先執行：

```powershell
.\tools\setup-dev-env.cmd
```

Windows PowerShell 常會因 Execution Policy 擋住直接執行 `.ps1`。本專案原則是不要直接執行 `.ps1`，優先使用對應 `.cmd` wrapper：

```powershell
.\tests\api\run-smoke.cmd
.\tools\check-api.cmd
.\tools\check-scripts.cmd
.\tools\deploy-all.cmd
```

若臨時需要執行沒有專用 wrapper 的 `.ps1`，使用通用入口：

```powershell
.\tools\run-ps1.cmd .\tests\api\smoke-dev-management.ps1
.\tools\run-ps1.cmd .\database\run_legacy_weekly_sync.ps1
```

PowerShell 管線在 0 筆、1 筆、多筆資料時可能回傳不同型態，測試腳本不要直接依賴 `Where-Object` 結果的 `.Count`。API smoke test 請使用 `tests\api\lib\topchurchplus-test.ps1` 的 `Get-StableCount`，或至少使用 `Measure-Object`：

```powershell
Assert-True ((($rows | Where-Object { $_.key -eq 'HANDOFF' }) | Get-StableCount) -eq 1) 'HANDOFF document should be listed.'
Assert-True ((($rows | Where-Object { $_.key -eq 'HANDOFF' }) | Measure-Object).Count -eq 1) 'HANDOFF document should be listed.'
```

PowerShell 呼叫原生命令後，如果要判斷 `$LASTEXITCODE`，請先把輸出與 exit code 存到變數，再做 pipeline 或其他處理：

```powershell
$output = & $command @args 2>&1
$exitCode = $LASTEXITCODE
$output | Select-Object -First 3
if ($exitCode -ne 0) { throw 'Command failed.' }
```

CLI 路徑集中記錄於 `tools/dev-cli-map.json`。若工具位置改變，優先更新這份地圖檔，不要讓檢查腳本每次掃描整個系統目錄。

本專案建議安裝並使用的免費 CLI：

- `rg`：快速搜尋檔案與內容。
- `jq`：檢查與壓縮 API JSON 回應。
- `yq`：檢查 YAML/JSON/TOML 等設定。
- `Playwright`：網頁互動與回歸測試。
- `clasp`：Google Apps Script push/deploy。
- `ast-grep`：結構化搜尋與同類程式碼定位。
- `SQLFluff`：SQL migration lint。
- `Repomix`：需要壓縮 repo context 或交接時產生 AI-friendly 摘要。

專案本地 Node CLI 使用 root `package.json` 管理，SQLFluff 安裝在 `.venv-tools`。

```powershell
npm run cli:check
npm run dev:playwright -- --version
npm run dev:clasp -- --version
npm run dev:ast-grep -- --version
npm run dev:repomix -- --version
npm run dev:sqlfluff -- --version
```

## 低 Token 開發順序

為降低大型專案任務的 Token 消耗，開發時請優先使用以下順序：

任務分流規則：

- 小修、單一檔案、明確錯誤訊息、文字或樣式微調：可由 Codex 直接讀相關檔案後處理，不強制跑 Local/Remote AI。
- 跨模組、大範圍 UI、資料庫設計或 migration、權限架構、全系統檢查、舊系統資料搬移、文件盤點：先跑 Local AI preflight；若本地模型不足或需要較大上下文，再改用 Remote AI preflight。
- Local/Remote AI 只做前置分析與檔案定位，不直接修改程式、不碰資料庫、不部署、不讀 secret。

標準順序：

1. 先讀 `AGENTS.md`、`docs/NEW_THREAD_GUIDE.md`、`docs/HANDOFF.md`，再依任務類型讀 `docs/DOCUMENTATION_MAINTENANCE.md` 指定的相關文件。
2. 依任務分流規則決定是否執行 `tools\local-ai-preflight.cmd`。若已產出 `tmp/local-ai/task_context.md`，Codex 需優先讀取該摘要。
3. 用 `rg` 找相關檔案、函式、feature key、endpoint。
4. 用 `ast-grep` 找同類程式碼或可安全套用的結構模式。
5. 小範圍修改，避免批次格式化。
6. 用 `jq` 檢查 API JSON 回應，避免貼整包 JSON。
7. 有 UI 變更時，用 Playwright 跑瀏覽器流程或產生測試。
8. 有 SQL 變更時，用 SQLFluff 與資料庫備份流程檢查。
9. 提交前依 `docs/DOCUMENTATION_MAINTENANCE.md` 更新相關系統文件。
10. 跑最小驗證、commit、push，必要時部署 NAS API 與 Google Apps Script。

任務完成後，Token 與 Remote 運算紀錄寫在 GitHub commit body，不放在系統介面。若無法取得精準 Token 值，需註明「未取得」；若沒有調用 Remote 運算，註明「未使用」。若有使用 Remote 運算，需記錄任務、估算節省 Token 與估算依據。

建議 commit body 固定包含：

```text
Token usage: 未取得 / 估算值
Remote compute: 未使用 / 已使用（任務與工具）
Remote token saving: N/A / 估算節省值與依據
```

常用搜尋範例：

```powershell
rg "featureKey|linebot|finance" -g "*.html" -g "*.gs" -g "*.js"
npm run dev:ast-grep -- --pattern "apiRequest($$$ARGS)" --lang js
```

檢查 API 與 Apps Script 語法：

```powershell
.\tools\check-scripts.cmd
```

檢查 API 語法與 health：

```powershell
$env:TOPCHURCHPLUS_API_BASE_URL = 'http://192.168.3.2:3000'
$env:TOPCHURCHPLUS_API_KEY = '<不要提交到 Git 的 API Key>'
.\tools\check-api.cmd
```

送出含中文 JSON 的 API 測試資料時，請先將 payload 存成 UTF-8 檔案，再用 `-BodyFile`。不要把完整 JSON 直接放在命令列參數中，Windows `.cmd` 轉交時可能拆壞引號。

```powershell
$body = @{
  currentUser = $currentUser
  link = @{
    targetUrl = 'https://www.topchurch.com.tw/'
    title = '中文測試資料'
  }
} | ConvertTo-Json -Depth 8 -Compress

Set-Content -LiteralPath .\tmp\payload.json -Value $body -Encoding utf8

.\tools\invoke-json-utf8.cmd `
  -Method POST `
  -Uri 'http://192.168.3.2:3000/short-links' `
  -BodyFile .\tmp\payload.json `
  -CurrentUserBase64 $currentUserBase64
```

GET 或沒有 body 的請求可以直接呼叫：

```powershell
.\tools\invoke-json-utf8.cmd `
  -Method GET `
  -Uri 'http://192.168.3.2:3000/short-links' `
  -CurrentUserBase64 $currentUserBase64
```

一鍵檢查並部署 NAS API 與 Google Apps Script：

```powershell
.\tools\deploy-all.cmd
```

部署後同步跑 API smoke test：

```powershell
.\tools\deploy-all.cmd -RunSmoke
```

`deploy-api.cmd` 會 recreate container，部署後若第一次 `/health` 出現短暫連線中斷，先等 3 秒再重試一次，避免把 container 啟動時序誤判為功能錯誤。

部署後同步建立並保留 Demo 測試資料：

```powershell
.\tools\deploy-all.cmd -RunSmoke -WriteSmokeDemo
```

每月重建能力維護檢查：

```powershell
.\tools\check-rebuild-readiness.cmd -RunSmoke
```

如果只想跑部署、不跑 health：

```powershell
.\tools\deploy-all.cmd -SkipHealth
```

建立新模組骨架：

```powershell
.\tools\new-module.cmd `
  -ModuleName admin-supply `
  -FeatureKey admin_supply `
  -Title '行政物資管理系統' `
  -Description '管理行政消耗品、各會堂庫存與庫存異動。'
```

此工具會建立：

- `<Module>.html`
- `Script_<Module>.html`
- `api/src/modules/<module>/routes.js`
- `database/<yyyymmdd>_<module>.sql`
- `tmp/<Module>_bridge.gs.txt`

工具只產生骨架，不會自動修改 `Index.html`、`程式碼.gs`、`api/src/index.js` 或權限選單；這些仍需人工 review 後用 `apply_patch` 接線。

API smoke test：

```powershell
$env:TOPCHURCHPLUS_API_BASE_URL = 'http://192.168.3.2:3000'
$env:TOPCHURCHPLUS_API_KEY = '<不要提交到 Git 的 API Key>'
.\tests\api\run-smoke.cmd
```

若需要保留 Demo 資料：

```powershell
.\tests\api\run-smoke.cmd -WriteDemo
```

## 建議任務流程

1. 讀取 `AGENTS.md`。
2. 讀取 `docs/NEW_THREAD_GUIDE.md`，依任務類型只讀相關文件。
3. 檢查目前分支與工作區狀態。
4. 修改前確認相關中文區塊可讀。
5. 判斷任務類型：前端、API、資料庫、文件產出、外部公開頁、權限設定。
6. 新模組優先用 `.\tools\new-module.cmd` 產生骨架，再人工接線。
7. 小範圍修改。
8. 若有 API 異動，新增或更新 `tests/api/smoke-<module>.ps1`。
9. 依 `docs/DOCUMENTATION_MAINTENANCE.md` 更新相關文件；若不需更新，最終回覆說明原因。
10. 執行最小驗證；可用 `.\tests\api\run-smoke.cmd` 跑可重複 API 測試。
11. 需要時執行 `.\tools\deploy-all.cmd`，或 `.\tools\deploy-all.cmd -RunSmoke`。
12. Commit 訊息寫清楚本次完成內容、驗證結果、DB 備份與部署資訊。
13. Push 到 GitHub。

## 任務完成文件更新規則

每次任務完成前都要檢查 `docs/DOCUMENTATION_MAINTENANCE.md`：

- 新增/修改模組：更新 `docs/MODULES.md`。
- 新增/修改 API：更新 `docs/API_CATALOG.md`。
- 新增/修改資料表、欄位、索引、seed：更新 `docs/DATABASE_SCHEMA.md`。
- 新增/修改測試流程：更新 `docs/TEST_MATRIX.md`。
- 新增除錯雷點或工具規則：更新 `docs/WORKFLOW.md` 與 `docs/TOPCHURCHPLUS_SKILL.md`。
- 新增/修改全站 UI 基礎樣式：更新 `docs/TEST_MATRIX.md`，必要時更新 `docs/MODULES.md`。
- 影響後續接手的重大背景：更新 `docs/HANDOFF.md`。

文件更新也屬於任務完成的一部分，除非本次任務真的沒有影響任何系統文件。

## 新模組接線檢查表

新功能模組至少確認：

- `api/src/modules/core/catalog.js` 已加入 feature key。
- `Script_Login.html` 已加入功能卡片、fallback role access 與 icon。
- `Index.html` 已 include `<Module>.html` 與 `Script_<Module>.html`。
- `Script_Login.html` 的 `MAIN_VIEW_IDS` 已加入新 view，開啟模組時優先用 `showMainView('<viewId>')`。
- `api/src/index.js` 已 register route。
- `程式碼.gs` 已加入 Apps Script bridge。
- migration 已包含資料表、索引、grant、`role_feature_permissions` seed。
- 若有中文寫入 API，smoke test 會寫入後再讀回確認中文可讀。
- Demo 資料命名使用 `Codex` 或 `DEMO` 前綴，方便日後辨識。

## Git 注意事項

如果 PowerShell 找不到 `git`，請重新開啟終端機，或確認使用者 PATH 包含 GitHub Desktop 的 git：

```text
C:\Users\資訊部\AppData\Local\GitHubDesktop\app-3.5.2\resources\app\git\cmd
```
