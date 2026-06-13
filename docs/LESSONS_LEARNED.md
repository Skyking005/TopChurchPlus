# TopChurchPlus Lessons Learned

最後更新：2026-06-12

本文件記錄 TopChurchPlus 開發、部署、資料庫、Apps Script、LINE Bot 與 AI Agent 工作流程中已知容易重複發生的問題。開始任務前應先閱讀本文件；若任務過程發現新坑或同類錯誤第二次出現，必須補充 Lesson。

每筆 Lesson 使用以下格式：

- Problem
- Root Cause
- Prevention
- Recommended Action

## Encoding

## Encoding-001

Problem

繁體中文檔案、SQL seed、Apps Script partial 或測試資料可能出現 mojibake、`????`、`���`，導致畫面文字、資料匯入或文件內容不可讀。

Root Cause

Windows PowerShell、批次檔、Apps Script 與 SQL 工具鏈混用時，預設編碼不一定是 UTF-8；若用 `Get-Content | Set-Content` 批次重寫中文檔案，可能改變 BOM、換行或內容編碼。

Prevention

專案文字檔視為 UTF-8；修改中文檔案優先使用 `apply_patch` 小範圍修改。送出中文 JSON 或 SQL seed 後必須讀回確認沒有 mojibake。

Recommended Action

修改前先檢查相關區塊是否可讀；驗證時使用 `tools/setup-utf8.ps1`、`tools/invoke-json-utf8.cmd` 或明確 UTF-8 的 .NET/Node client。若看到 mojibake，停止推論並回報，不要把亂碼當成正常內容重寫。

## PowerShell

## PowerShell-001

Problem

PowerShell 測試或部署命令可能因 Execution Policy、中文 JSON header、管線單筆 unwrap、`$LASTEXITCODE` 被後續 pipeline 干擾而失敗或誤判。

Root Cause

Windows PowerShell 對 `.ps1` 執行策略、字串轉義、中文 header、pipeline 型態與外部命令 exit code 的處理與 Bash/Node 不同；手刻巢狀 PowerShell 命令時 `$` 也可能被外層吃掉。

Prevention

優先使用專案 `.cmd` wrapper；需要 `.ps1` 時使用 `-ExecutionPolicy Bypass` 或 `tools/run-ps1.cmd`。API 測試使用 `tests/api/lib/topchurchplus-test.ps1` 的 helper 與 base64url current user，不要手刻含中文的 `x-current-user` header。

Recommended Action

執行前先載入 UTF-8 設定；計數用 `Measure-Object` 或 `Get-StableCount`；呼叫外部命令後立即保存 `$exitCode = $LASTEXITCODE`；複雜 JSON/SQL 不塞在一行命令裡，改用檔案或專案 helper。

## Apps Script

## AppsScript-001

Problem

Apps Script 使用 `UrlFetchApp` 呼叫 API 時曾出現 `Exception: 超過上限：UrlFetch URL 長度`，或因 API base URL 使用 `http://59.120.6.172:3000` / `http://api.topchurchplus.com:80` 導致登入卡住。

Root Cause

Apps Script `UrlFetchApp` 有 URL 長度限制；大量參數不適合塞在 GET query string。Script Properties 中的 API URL 也可能保留舊內網或 HTTP 設定，Google 伺服器無法穩定連到未公開或非 HTTPS 的 API。

Prevention

大型查詢改用 POST body 或縮短 query；Apps Script bridge 必須統一 normalize API base URL，正式外部呼叫優先使用 `https://api.topchurchplus.com`。

Recommended Action

新增 Apps Script wrapper 時先檢查 `apiRequest()` 行為與 URL 組合；若遇到 URL 長度錯誤，將 payload 從 query 改成 body。部署後執行 `push-to-google.cmd`，並確認 deployment 版本。

## AppsScript-002

Problem

PowerShell 文字替換 Apps Script HTML partial 時，若 replacement 使用單引號與跳脫字元，可能把 literal `` `r`n `` 或 `\"` 寫進 HTML，造成標籤結構錯誤或 UI 破版。

Root Cause

PowerShell 單引號字串不展開跳脫序列，且 mojibake 內容會讓 `apply_patch` 難以命中上下文。若直接用 regex 大段替換 HTML，容易把換行與引號當作普通文字寫入檔案。

Prevention

優先使用 `apply_patch`。若因 mojibake 必須用 PowerShell/.NET UTF-8 讀寫，replacement 需使用可展開的雙引號或先組合實際換行，並在寫入後立刻檢查目標 DOM ID、閉合標籤與是否存在 literal `` `r`n `` / `\"`。

Recommended Action

修改 Apps Script HTML 後執行 `node -e` 或 `tools/check-scripts.cmd` 做語法檢查，並用 `Select-String` 搜尋 `` `r`n ``、`\"`、`/button`、`/label`、`/h5` 等疑似壞標籤。若 PowerShell 顯示亂碼，使用 .NET `ReadAllLines(..., UTF8)` 檢查實際行內容。

## AppsScript-003

Problem

MailApp quota management can be misread as a stable daily global value, causing immediate bulk sends or incorrect queue decisions.

Root Cause

`MailApp.getRemainingDailyQuota()` is only reliable for the current Apps Script execution. TopChurchPlus also runs mail delivery through scheduled Apps Script executions, not the NAS API directly.

Prevention

Treat MailApp quota as an execution-time guard. Record snapshots for monitoring, but check quota again immediately before each send.

Recommended Action

Use `MailQueueService.enqueueMail()` / `enqueueMails()` for module events, and let `processMailQueue()` perform actual `MailApp.sendEmail()` delivery. Keep each execution capped at 20 items, stop at zero quota, and send only HIGH priority mail when remaining quota is 10 or below. The only approved immediate-send exception is login verification code email, which must check quota before sending.

## PostgreSQL

## PostgreSQL-001

Problem

測試或新增資料時若帶不存在的 `staffId`，`audit_logs.staff_id`、`line_binding_requests.processed_by` 等 FK 欄位會觸發 FK 錯誤；新增 FK 若未補 index，也會造成查詢與刪除效能風險。

Root Cause

TopChurchPlus 的 PostgreSQL schema 使用正式 FK 保護資料一致性，並非所有測試使用者 ID 都存在於 `accounts`。部分 migration 需要人工確認 index 與查回驗證。

Prevention

測試 current user 使用已存在的 demo staff，例如測試 helper 的 `New-DemoCurrentUser`。新增 FK 時同 migration 補 index；schema 變更前先備份，變更後查回驗證。

Recommended Action

遇到 FK 錯誤先查 `accounts.staff_id` 是否存在，不要移除 FK。新增 migration 時同時寫 `CREATE INDEX IF NOT EXISTS`，並在 final 回報查回結果。

## PostgreSQL-002

Problem

使用 `ANY($1::text[])` 或分頁 `LIMIT/OFFSET` 參數時，API 在 PostgreSQL 回傳 `could not determine data type of parameter $n`。

Root Cause

Node `pg` 的 bind values 必須與 SQL placeholder 型別一致。若 SQL 期待 `$1::text[]`，values 必須傳入單一 JavaScript array，例如 `[['linebot', 'config']]`，不能把多個字串攤平成 `['linebot', 'config']`。部分 `LIMIT $n` / `OFFSET $n` 也需要明確 `::int` cast，避免 PostgreSQL 無法推斷型別。

Prevention

寫 SQL 時讓 placeholder 與 values array 位置逐一對齊；array parameter 一律包成單一陣列元素；分頁參數使用 `LIMIT $n::int OFFSET $m::int`。

Recommended Action

遇到此錯誤時先檢查 values 的形狀與 placeholder 編號，不要只看錯誤裡的 `$n` 表面位置。修正後直接打該 endpoint，確認 200，再跑 smoke test。

## PostgreSQL-003

Problem

Phase 2B reservation movement insert failed with `inconsistent types deduced for parameter $n`.

Root Cause

The same SQL placeholder was reused for both a `uuid` column (`reservation_id`) and a `text` column (`source_id`). PostgreSQL inferred conflicting types for one bind parameter.

Prevention

Do not reuse the same placeholder across columns with different PostgreSQL types, even when the logical value is the same ID.

Recommended Action

Use separate placeholders and explicitly pass a string value for text columns such as `source_id`. For UUID references, keep the UUID bind parameter separate so FK validation remains intact.

## Synology

## Synology-001

Problem

NAS 部署可能因 SMB `\\192.168.3.2\docker\project-api` 不可用、SSH key 權限、或 Synology 系統區資料被更新/重啟清除而中斷。

Root Cause

Synology Container Manager 的正式部署目錄在 shared folder 下；SMB 連線與 SSH 連線是兩條不同路徑。NAS 警示指出資料應存放在 shared folders，非 shared folder 位置可能在系統更新或重啟後遺失。

Prevention

部署檔案維持在 `/volume1/docker/project-api` 或 SMB 對應 shared folder。SMB 不通時使用 SSH/tar fallback，並用既有 deploy script 或 documented command rebuild container。

Recommended Action

部署前確認 `git status --short` 與變更範圍；部署後執行 `docker compose up -d --build`、檢查 container 啟動、跑 `/health` 與 smoke tests。不要把資料寫到 NAS 非 shared folder 位置。

## Docker

## Docker-001

Problem

API 檔案複製到 NAS 後，如果沒有 rebuild/recreate container，Node.js 服務仍可能執行舊程式碼。

Root Cause

`project-api` 是 Docker/Container Manager 服務；檔案同步與容器映像重建是兩個步驟。只複製 `src` 不一定會讓執行中的 container 重新載入。

Prevention

有 API 變更時，部署流程必須包含 `docker compose up -d --build`，並在完成後做健康檢查與 smoke test。

Recommended Action

使用 `deploy-api.ps1` 或 SSH 到 `/volume1/docker/project-api` 執行 `sudo -n /usr/local/bin/docker compose up -d --build`。回報時列出 rebuild 結果與 health/smoke 結果。

## Reverse Proxy

## ReverseProxy-001

Problem

LINE webhook、Apps Script、外部 API 會因 reverse proxy、DNS、防火牆或 NAT 未同步設定而內網可通、外部不可通。

Root Cause

內網 `http://192.168.3.2:3000` 與外部 `https://api.topchurchplus.com` 不是同一條路徑；外部路徑依賴 DNS、路由器/防火牆 port forwarding、Synology reverse proxy 與 SSL 憑證。

Prevention

不要只用內網 health 當作外部 LINE webhook 完成證明；需要同時測內網 API、外部 HTTPS health、LINE Developers Verify。

Recommended Action

調整外部入口時列出來源 host、目標 host/port、協定與憑證。正式切換前測 `https://api.topchurchplus.com/health` 與 `https://api.topchurchplus.com/linebot/webhook`，並保留 reverse proxy 設定截圖或文件。

## SSL

## SSL-001

Problem

LINE Developers webhook 驗證要求公開 HTTPS 可達；HTTP、過期憑證、憑證鏈不完整或 proxy 指到錯誤服務都會讓 LINE webhook 無法驗證。

Root Cause

LINE 平台從外部伺服器呼叫 webhook，不會使用內網 NAS 位址；憑證與 reverse proxy 必須在公開網域上正確完成。

Prevention

LINE webhook 正式模式切換前，先確認 `https://api.topchurchplus.com/health` 從外部回 HTTP 200，且 LINE Developers Verify 通過。

Recommended Action

遇到 webhook 驗證失敗時，先分層檢查 DNS、port forwarding、防火牆、Synology reverse proxy、SSL certificate、API container health。不要先改 webhook 程式邏輯。

## LINE Bot

## LineBot-001

Problem

LINE/LIFF 綁定與 webhook 若沒有明確分段，容易把 channel secret、access token、LIFF ID、ID token 驗證、外部 HTTPS 與 member binding 混在一起排查。

Root Cause

LINE Bot 整合橫跨 LINE Developers、公開 HTTPS、NAS API、PostgreSQL identity tables、Apps Script 後台與 LIFF browser runtime；任一層失敗都可能表現為「打不通」。

Prevention

LINE 整合分段驗證：API health、webhook receiver、LINE Developers Verify、LIFF config、ID token verification、session 建立、member binding、admin review。Secret 只存 `.env`、Script Properties 或 `system_config`，不得寫入文件或 AI context。

Recommended Action

排查時先確認 webhook 是否收到事件，再查 `line_bot_webhook_events`、`line_users`、`line_liff_sessions`、`line_binding_requests`。涉及會友權限時遵守 Identity Boundary v2，不使用後台 Account Role 決定 LIFF 會友權限。

## QT / Counter

## QTCounter-001

Problem

QT 領取、付款與庫存流程容易同時出現在 QT 管理系統與 Counter 櫃台工作台，若兩邊各自實作完整業務邏輯，會造成狀態更新、庫存扣減與金流紀錄不一致。

Root Cause

Counter 是櫃台操作入口，QT 是業務管理主模組；兩者共享訂單、領取與庫存資料，但使用情境不同。若沒有明確界線，Counter 可能變成第二套 QT 管理系統。

Prevention

QT 訂購、領取狀態、庫存、調撥與報表的主邏輯應集中在 QT API/module；Counter 僅保留櫃台快速操作、相容入口或導引。若 Counter 需要執行 QT 領取，必須呼叫同一組 QT 後端流程，不可另寫一套扣庫存或狀態邏輯。

Recommended Action

新增 QT 領取或金流功能時，先檢查 `Qt.html`、`Script_Qt.html`、`api/src/modules/qt/routes.js` 與 `Counter.html`、`Script_Counter.html`、`api/src/modules/counter/routes.js` 的職責分工。正式扣庫存或付款狀態更新應由 QT API 提供單一路徑，Counter 只做掃描/收款 UI 與導引。

## QTCounter-002

Problem

QT Email 通知若放在 API 自動排程或多個入口直接寄送，容易造成重複通知、漏寫 audit log，或在未確認收件名單時批次寄出。

Root Cause

TopChurchPlus 目前主要前端仍是 Apps Script，既有 Email 寄送能力在 Apps Script `MailApp`；NAS API 則負責資料查詢、權限與 audit log。若沒有明確分工，通知寄送與通知結果紀錄會分散在不同層，後續難以追查。

Prevention

QT Email 通知採管理端手動觸發。Apps Script 先向 API 預覽收件人，使用 `MailApp.sendEmail` 實際寄送，再把每位收件人的成功/失敗結果回寫 API，由 API 寫入 `notification_logs` 與 `audit_logs`。不要新增 QT 自動寄送排程，除非另有明確設計與驗收。

Recommended Action

新增 QT 通知類型時，沿用 `GET /qt/notifications/:type/preview` 與 `POST /qt/notifications/:type/results` 模式；UI 必須有人工確認，API 必須記錄 batch id、notification type、success/failed/skipped counts。部署後用少量月份資料先測試 Apps Script MailApp 配額與 audit log 寫入。

## AI Agent Mistakes

## AIAgent-003

Problem

Centralizing configurable keys can accidentally break existing modules if old flat keys, Script Properties, or module-specific config tables are removed before each caller is migrated.

Root Cause

TopChurchPlus has a mixed runtime: Apps Script Script Properties, legacy `system_config`, module tables, and code-level defaults. A single ConfigService cutover without compatibility mapping can silently remove LINE, QT, Mail, Calendar, or Apps Script settings.

Prevention

Introduce centralized config in layers. Keep legacy sources readable during transition, map known flat keys into `system_config_keys`, and document remaining non-converged sources.

Recommended Action

New modules should use `ConfigService.get(namespace, key)`, `ConfigService.getSecret(namespace, key)`, and `ConfigService.set(namespace, key, value)`. Existing modules should migrate one namespace at a time. Secret values must be masked in API/UI responses and audit before/after data.

## AIAgent-002

Problem

`tests/api/run-smoke.cmd` can fail before exercising the API when `TOPCHURCHPLUS_API_BASE_URL` is not set.

Root Cause

The smoke test runner expects an explicit target API base URL. A fresh shell or Codex session may not inherit the deployment/test environment variables, so the command stops with `Missing TOPCHURCHPLUS_API_BASE_URL.`.

Prevention

Before running smoke tests, verify the target environment variables and choose the intended target explicitly: local API, NAS API, or public HTTPS API.

Recommended Action

Run smoke tests with a clear target, for example setting `TOPCHURCHPLUS_API_BASE_URL` in the current PowerShell session first. If the target API is not running or the API key is unavailable, record the smoke test as blocked instead of treating it as an application failure.

## AIAgent-001

Problem

AI Agent 容易在文件已過期、AI context snapshot 落後、或使用者有未提交變更時，根據舊資訊做錯修改或覆蓋使用者工作。

Root Cause

TopChurchPlus 文件與程式快速演進，且工作樹可能包含使用者或前一階段變更。Local/Remote AI snapshot 是分析用，不保證等於最新 repo。

Prevention

任務開始先讀 `AGENTS.md`、`docs/HANDOFF.md`、`docs/LESSONS_LEARNED.md`，並執行 `git status --short`。用 `rg` 查實際程式碼，不只依賴記憶或舊文件。

Recommended Action

若 AI context freshness 失敗，先重建或把 snapshot 當背景參考。遇到不屬於本任務的 dirty files 不要 revert；若文件與程式衝突，以實際程式、schema 與使用者最新要求為準。

## ReverseProxy-002

Problem

外部直連 `59.120.6.172:3000/health` 逾時曾被誤判為 API 異常。

Root Cause

外部 direct 3000 port 已因安全考量關閉；正式外部入口只應走 443 與 `api.topchurchplus.com`。內網 `192.168.3.2:3000` 可用只代表 NAS container 正常，不代表 Synology reverse proxy、憑證與外部 443 路徑正確。

Prevention

外部驗證只使用 `https://api.topchurchplus.com/health` 與 `https://api.topchurchplus.com/linebot/webhook`。若 LINE webhook 沒有進 API log，優先檢查 DNS、防火牆或 443 forwarding、Synology Reverse Proxy / Web Station / Portal、SSL certificate，以及是否誤導到 DSM 5001。

Recommended Action

不要再測試 `59.120.6.172:3000`。若需要 smoke test，設定 `TOPCHURCHPLUS_API_BASE_URL=https://api.topchurchplus.com` 與本機 `TOPCHURCHPLUS_API_KEY` 後再執行。
