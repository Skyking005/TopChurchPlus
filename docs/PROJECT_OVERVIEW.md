# TopChurchPlus Project Overview

最後更新：2026-06-12

## 專案定位

TopChurchPlus 是卓越行道會的行政、會友服務、內部營運與 LINE/LIFF 入口整合系統。現階段不是重寫全部前端，而是以漸進式方式把原本 Apps Script / 舊系統流程逐步移到 NAS API 與 PostgreSQL。

## 目前階段

Phase 2：核心系統建置、資料搬移、NAS API 部署與外部入口準備。

## 主要技術組成

- Google Apps Script Web App：主要使用者介面。
- Apps Script bridge：`程式碼.gs`，負責將前端 `google.script.run` 呼叫轉送到 API。
- Node.js Express API：`api/src`。
- PostgreSQL：NAS 上的主資料庫。
- MSSQL：舊系統來源，短期仍保留匯入/同步。
- NAS Docker：`/volume1/docker/project-api`，container/service `project-api`。
- LINE / LIFF：外部會友入口與 webhook 正在準備。

## 已上線或可用模組

- Core：登入、權限、參數、Audit Log、Usage Log、檔案、Entity Link、ID Rules。
- Project：專案清單、詳細、權限、預算、會議、文件產出。
- Meeting：獨立會議與專案會議共用 `meetings`。
- Forms：表單建立、公開填寫、回覆、統計、短連結。
- Short Links：短碼、目標網址、點擊紀錄、過期/停用。
- Finance：採購、預借、支出證明、請款。
- Asset：資產主檔、位置、來源關聯。
- Pastoral：會友主檔、牧區、牧養權限、附件，仍在 Beta。
- Education：課程、學員狀態、CL 對外編碼，仍在 Beta。
- Attendance：聚會統計 API 與小家統計，仍需 UI 強化。
- Line Bot / LIFF：資料表、LIFF、webhook receiver 已準備，外部 HTTPS 待驗。
- QT、QRCode、Counter、Venue、Zoom、Sunday Message、Dev Management。
- Workflow/BPM：v1 engine 已新增 API、DB、Apps Script wrapper，尚未建立完整前端工作台。

## 近期完成

- 系統名稱已改為 TopChurchPlus。
- 專案 ID 前綴 PJ，課程 ID 對外編碼 CL，會友 ID 對外編碼 TOP。
- 系統管理已可調整編碼規則。
- 短連結管理移入表單系統，限管理者以上。
- 使用者管理部門支援多選方向。
- 新增會議管理入口。
- 新增 `Script_FeatureConfig.html`，從 `Script_Login.html` 抽離靜態常數。
- 新增 BPM workflow engine v1。
- 新增 `tools/check-ai-context-freshness.cmd`。

## 不要混淆的名詞

- Administrative Domain：後台同工系統。
- Pastoral Domain：會友、牧養、LINE/LIFF 外部身份。
- `linebot`：目前內部技術 key/path，介面名稱是 Line App 會友管理系統。
- `project-api`：NAS 上 API 實體資料夾與 docker service 名稱，雖然產品名稱是 TopChurchPlus。

## 重要邊界

Identity Boundary v2 是目前最重要的設計約束：

- Administrative Domain 與 Pastoral Domain 必須解耦。
- Pastoral Domain 權限不可依賴後台 Account Role。
- 後台角色只管行政系統入口，不代表會友身份或牧養資料授權。
