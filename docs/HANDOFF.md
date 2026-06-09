# TopChurchPlus Handoff

最後更新：2026-06-09

本文件給下一個任務或下一位協作者快速接手使用。開始任何細部修正前，請先讀本文件、`AGENTS.md`、`docs/WORKFLOW.md`，再依任務需要讀相關模組文件。

## 目前定位

TopChurchPlus 是卓越行道會行政與會友服務整合系統，目前採漸進式重構：

- 前端仍以 Google Apps Script Web App 為主要入口。
- 資料與主要業務邏輯逐步搬到 NAS 上的 Node.js API 與 PostgreSQL。
- 舊 MSSQL 系統仍是部分正式資料來源，短期需要同步或匯入規劃。
- 新系統模組以共用權限、共用參數、共用檔案、共用稽核、跨系統關聯為底層，避免各系統各自為政。

目前正式部署資訊：

- GitHub repo：`Skyking005/TopChurchPlus`
- 本地路徑：`D:\系統開發\topchurchplus`
- NAS API 實體路徑：`/volume1/docker/project-api`
- Docker service/container：`project-api`
- Apps Script 部署作業 ID：`AKfycbwqO5FTVL_5iWCwHPGQH0ZhXM9IOH4U17UnTGKm7SVrP0NqZd4wEer-1z82B7HFTKkw`
- 最新 Apps Script 版本：`@127`
- 最新 Git commit：`bba2bf8 Add LIFF entry security framework`

## 文件入口

為降低後續任務 Token 消耗，新任務建議先讀下列文件，不要每次重新掃描整個專案：

- `AGENTS.md`：不可違反的編碼、資料庫、部署與任務規則。
- `docs/HANDOFF.md`：目前交接摘要。
- `docs/SYSTEM_ARCHITECTURE.md`：前端、API、DB、權限、外部入口架構。
- `docs/DATABASE_SCHEMA.md`：主要資料表、欄位語意、關聯與同步注意事項。
- `docs/API_CATALOG.md`：API 模組與 endpoint 索引。
- `docs/MODULES.md`：各系統模組狀態、主要檔案與修正注意事項。
- `docs/TEST_MATRIX.md`：各模組合法/非法流程測試清單。
- `docs/WORKFLOW.md`：日常開發、部署、測試工具與新模組流程。

任務開場建議只讀：

```text
AGENTS.md
docs/HANDOFF.md
docs/<本任務相關文件>
```

例如修財務，就讀 `HANDOFF`、`MODULES` 的財務章節、`DATABASE_SCHEMA` 的財務章節、`API_CATALOG` 的 Finance 章節。

## 必守規則

- 所有 `.gs`、`.html`、`.js`、`.json`、`.sql`、`.md` 一律視為 UTF-8。
- 修改中文檔案前，先確認相關區塊沒有 mojibake 或不可讀中文。
- 不要用 PowerShell `Get-Content | Set-Content` 批次重寫中文檔案。
- 手動修改優先使用 `apply_patch` 小範圍修改。
- PowerShell 先設定 UTF-8，或使用 `.\tools\setup-utf8.ps1`。
- 含中文 JSON 的 API 測試不要直接用 `Invoke-RestMethod -Body $json`，請使用 `tools/invoke-json-utf8.cmd` 或明確 UTF-8 的 HttpClient。
- 寫入中文 Demo 或測試資料後，必須讀回確認中文可讀。
- 有資料庫 schema 或資料 migration 時，先備份 NAS PostgreSQL，再執行 migration，最後查回驗證。
- 不要修改 GoDaddy DNS、正式 Apps Script URL、LINE webhook、production env，除非使用者明確確認。

## 常用流程

建議每個任務都照以下順序：

1. 讀 `AGENTS.md` 與本文件。
2. 檢查 `git status --short --branch`。
3. 用 `rg` 查檔案與文案，PowerShell 檔案過濾用 `rg -g`。
4. 小範圍修改。
5. API 檔跑 Node 語法檢查。
6. Apps Script HTML partial 用 `new Function()` 解析 script。
7. 如有 API 變更，部署 NAS API：`.\deploy-api.cmd`。
8. 如有前端變更，先 commit，再執行：`.\push-to-google.cmd`，讓部署說明帶最新 commit。
9. Commit 訊息要寫清楚完成內容、驗證結果、DB 備份與部署版本。
10. Push GitHub。

常用檢查：

```powershell
.\tools\check-scripts.cmd
.\tools\check-api.cmd
.\tests\api\run-smoke.cmd
```

一鍵部署：

```powershell
.\tools\deploy-all.cmd
.\tools\deploy-all.cmd -RunSmoke
```

## 系統框架現況

### 前端

主要仍是 Apps Script HTML partial：

- `Index.html` 組裝主要畫面。
- `Script_Login.html` 管理系統入口、功能卡片、權限可見性。
- 各系統使用 `<Module>.html` 與 `Script_<Module>.html`。
- Apps Script bridge 集中在 `程式碼.gs`，維持 `google.script.run` 對前端的相容性。

新增前端模組時要確認：

- `Index.html` include 模組 HTML 與 Script。
- `Script_Login.html` 加功能卡片、icon、開啟函式與可見性。
- `程式碼.gs` 加 API bridge。
- 需要權限時，確認 feature key 與 `role_feature_permissions`。

### API

主要 API 位於 `api/src/modules/*/routes.js`，目前已逐步模組化：

- `auth`：登入、陌生裝置驗證、登入紀錄。
- `system`：initial data、使用者管理、權限、參數、使用紀錄、系統日誌。
- `project`：專案清單、專案詳細、會議、專案權限、文件產出。
- `finance`：採購、預借、支出證明、請款與附件。
- `pastoral`：會友、牧區、會堂資料權限、會友附件。
- `asset`：資產、位置、資產來源關聯。
- `forms`：表單、公開填寫、回覆統計。
- `counter`：櫃台工作台、PIN Code。
- `qt`：QT 庫存、訂購、庫存檢查。
- `qrcode`：QRCode 報到。
- `venue`：場地借用。
- `zoom`：Zoom 帳號借用。
- `attendance`：小家點名與聚會統計。
- `education`：課程與培育進度。
- `sunday-message`：主日信息管理。
- `linebot` / `liff`：Line App 會友入口、Rich Menu、LIFF 綁定與安全框架。

新 API 模組建議拆分：

```text
api/src/modules/<module>/
  routes.js
  service.js
  repository.js
  mapper.js
  validators.js
```

現有很多模組仍集中在 `routes.js`，細部修正時可以低風險抽 helper，但不要一次大重構。

### 資料庫

主要資料庫：NAS PostgreSQL。

資料庫文件：

- `database/README.md`
- `docs/DATABASE_MIGRATION_WORKFLOW.md`
- `docs/LEGACY_MSSQL_SYNC_WORKFLOW.md`
- `database/templates/migration_proposal_template.md`
- `database/templates/mssql_mapping_template.md`

底層已逐步導入：

- `role_feature_permissions`：系統入口權限。
- `system_usage_logs`：功能使用紀錄。
- `audit_logs`：敏感操作稽核。
- `files`、`file_links`：共用檔案管理。
- `entity_links`、`domain_events`：跨系統關聯與事件。
- `param_categories`、`param_items`：結構化參數。
- `line_users`、`member_accounts`：外部會友身份橋接。

外鍵索引是每次 DB 異動檢查項目。新增 FK 欄位時要同步補 index。

### 跨系統關聯

已建議使用 `entity_links` 與 `domain_events`，不要讓模組彼此寫死欄位：

- 專案可產生請購。
- 請購可產生請款。
- 請款可衍生資產。
- 會友資料會被課程、點名、Line App、表單、場地借用等系統引用。

細部修正時，若某資料是「由另一系統產生或引用」，優先考慮建立 entity link，而不是只在單一表塞文字。

## 已開發模組摘要

### 專案管理

- 已有專案清單、搜尋、詳細資料、專案權限、會議紀錄、DOC/PDF 產出。
- 專案權限包含完全控制等資料範圍。
- 會議已有全選與依部門快速勾選需求，帳號已有部門欄位/多部門方向。
- 文件產出逐步從 Google Drive 移往 NAS 文件服務。

### 財務管理

- 包含採購、預借、支出證明、請款。
- 請款可獨立申請，支出證明必須掛請款。
- 採購單支援報價 PDF 上傳。
- 支出憑證已有一般與鐘點費支出憑證類型方向。
- 未來財務資料會衍生資產，需保留跨系統關聯。

### 牧養管理

- 會友 CRUD 是核心基礎，會影響 Line App、教育、點名、表單、場地等。
- 會友資料包含主檔、聯絡、地址、信仰、家庭、牧區、照片/新人單附件。
- 牧養資料權限依帳號可看會堂範圍，多選。
- 會友詳細需顯示最近兩個月聚會狀況。
- 舊 MSSQL 的 `Newcomer`、`Shepherd`、課程與點名資料仍是重要來源。

### 表單系統

- 方向參考 Google Form。
- 支援外部公開填寫、必填 Email、回覆後寄送編輯連結。
- 表單停止或過期時，外部填寫與編輯都需明確顯示停止/過期。
- 需要支援圖片附加與回覆統計表。

### 櫃台工作台

- 登入入口與內部系統分開。
- 使用 PIN Code；目前規則已調整為第一碼英文後五碼數字，設定時綁使用者、狀態、所屬會堂。
- 櫃台工作包含報名繳費、QT 領取、QRCode 報到。
- QRCode 報到已從內部系統移到外部櫃台工作站方向。

### QT 管理

- 以 `QuietTime*` 舊資料規劃。
- 支援每月各會堂庫存、價格方案、異動、調撥、庫存檢查。
- 未來 Line App 或 LIFF 下單前要查 `/qt/stock-check`，避免無庫存下單。

### 教育管理

- 參考 `Course*` 舊資料。
- 包含課程管理、學員狀態、講師班表。
- 培育階段有順序：E1、成長班、E2、門徒班、E3、領袖班。
- 需要預估可開班學員數量，牧養系統個人資料也要看課程狀態。

### 資產與行政物資

- 資產管理已有資產清單、詳細、位置管理。
- 位置資料未來與場地借用共用。
- 行政物資管理是庫存管理方向，需要總量與各分堂數量。

### 場地與 Zoom 預約

- 場地與 Zoom 都要支援週檢視。
- 預約需排他：同一場地/帳號同時段不可重疊，不同時段可借。
- 場地可借用狀態由位置/場地管理設定。

### 主日信息管理

- 只有秘書部與主任牧師可看。
- 管理信息主題，例如 `OO牧者-XXXXX`。
- 可記錄各會堂分享狀態，也支援非會堂場合，例如特會、婦女會。
- 外請講員也要納入主日信息管理，不應放到系統管理參數。

### Line App 會友管理

近期完成：

- 將使用者介面由 `LINE BOT 管理系統` 更名為 `Line App會友管理系統`。
- 內部 feature key 與 API path 暫保留 `linebot`，降低大規模改名風險。
- Rich Menu 管理可設定：
  - 對象：未綁定、已綁定、進階、自訂等。
  - 點擊動作：開啟 LIFF、回覆提示、外部連結。
  - 提示標題。
  - 未綁定提示。
  - 已綁定提示。
  - LIFF 路徑或外部 URL。
- LIFF 綁定流程改為姓名 + 手機號碼。
- 綁定成功會更新 `line_users` 與 `pastoral_members.line_user_id`。
- 已建立 `DEMO Line App 會友選單` 供展示。

LINE API 串接目前只預備：

- 新增 `api/src/modules/linebot/line-api-client.js`。
- Channel 設定有 `LINE API 串接預備` 區塊。
- 模式有：僅預備設定、演練模式、正式呼叫。
- 預設 `enabled=false`、`mode=prepare`，不會呼叫 LINE API。
- readiness endpoint 只檢查設定，不做正式呼叫。

LIFF 安全框架已納入：

- 新增 `api/src/modules/liff/security.js`。
- LIFF session 建立時記錄 IP prefix 與 User-Agent hash。
- ID Token 驗證補上 `aud` 與 `exp` 檢查。
- Channel 可設定：
  - Session 天數。
  - 是否要求 HTTPS。
  - Origin 檢查：監控或強制。
  - Session 裝置檢查：監控或強制。
  - 允許來源清單。
- 預設為監控模式，不阻擋目前使用者。
- 正式 LIFF 網域確認後，才能逐步改成強制模式。

## 外部入口與資安原則

外部入口包含：

- LIFF / Line App。
- 公開表單。
- 櫃台工作站。
- 未來會友 App 或其他公開頁。

必守設計：

- 外部使用者不能沿用同工後台權限。
- 外部 API 只允許操作自己的資料、自己的申請或公開資料。
- LIFF 入口需要 ID Token 驗證、Session Token、來源檢查、裝置/IP 監控。
- 公開表單需處理停止、過期、編輯連結、Email 必填。
- 櫃台工作站 PIN 需記錄使用者與會堂，方便金流追蹤。
- Token、secret、API key 類參數只能存在 DB metadata 或 env，不要寫死到 repo。

## 部署與驗證現況

最近部署紀錄：

- `8526913 Build Line App member management foundation`
  - Apps Script `@125`
  - Line App 會友管理、Rich Menu prompt、LIFF 姓名+手機綁定。
- `6ccc059 Prepare optional LINE API integration`
  - Apps Script `@126`
  - LINE API 預備設定，預設不呼叫 LINE API。
- `bba2bf8 Add LIFF entry security framework`
  - Apps Script `@127`
  - LIFF 安全框架，預設監控模式。

常用部署：

```powershell
.\deploy-api.cmd
.\push-to-google.cmd
```

若有 API 和前端同時改動，建議：

1. 本地檢查。
2. 部署 NAS API。
3. API 行為測試。
4. Git commit + push。
5. `.\push-to-google.cmd`，讓 Apps Script deploy description 帶最新 commit。

## 下一階段細部修正建議

接下來進行細部系統修正時，建議每次只處理一個模組或一條流程：

- 財務：請款、支出證明、PDF 附件、印出流程。
- 牧養：會友照片/新人單、牧區排版、同名提醒、最近聚會狀況。
- 表單：公開填寫穩定性、圖片附件、統計表、過期/停止提示。
- 場地/Zoom：週檢視與排他驗證。
- 櫃台：PIN 管理與會堂金流追蹤。
- Line App：先完善管理設定與 LIFF 頁面，不要直接正式替換舊 Line Bot。

每個細部修正都要保留 Demo 測試資料，除非使用者明確要求刪除。

## 已知雷區

- PowerShell 容易把中文 JSON 或 SQL 變成 `????`。
- PowerShell 會解析 SQL 的 `||`、引號、分號，遠端 SQL 請用檔案或工具。
- Windows shell 的 wildcard 對 `rg` 不穩，使用 `rg -g`。
- `git` 有時不在 PATH，必要時使用 GitHub Desktop 內建 git。
- NAS 不一定支援 scp subsystem；傳中文 SQL 可用 base64 ASCII 方式，並比對 hash。
- Apps Script 每次 push 前，若 deploy description 需要最新 commit，必須先 commit。
- LIFF 安全強制模式不可太早開，否則可能因正式網域/反代/Origin 還沒整理好而擋住使用者。
- LINE API 目前只預備，不要把 mode 切 live，也不要啟用自動 Rich Menu 切換，除非使用者確認正式轉換。

## 接手前快速檢查清單

- `git status --short --branch` 是否乾淨。
- 是否在 `D:\系統開發\topchurchplus`。
- 相關檔案中文是否可讀。
- 任務是否牽涉 DB；若是，先備份與寫 migration。
- 任務是否牽涉 Apps Script；若是，最後要 push-to-google。
- 任務是否牽涉 API；若是，部署 NAS API 並測 `/health`。
- 是否需要保留 Demo 資料；若有中文寫入，要讀回確認。
- 是否要同步 GitHub；目前規則是每次功能調整後 commit 並 push。
