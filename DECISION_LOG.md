# TopChurchPlus Decision Log

## 2026-06-11

### D-001

決策：

保留 Google Apps Script 作為主要前端。

原因：

* 現有系統已大量使用 Apps Script
* 同工已熟悉目前操作模式
* 可快速部署到既有 Google App 環境
* 現階段核心目標是完成資料搬移與流程穩定，而不是重寫前端

替代方案：

* React
* Vue
* Next.js

未採用原因：

* 重構成本高
* 會延後資料搬移與內部上線
* 需要重新設計登入、權限、部署與使用者訓練

未來方向：

* 保留 Apps Script 作為營運前端
* 把複雜商業邏輯逐步下移到 API
* 若未來要重寫前端，先以模組為單位拆出

---

### D-002

決策：

PostgreSQL 作為 TopChurchPlus 未來主資料庫。

原因：

* 新 API 已以 PostgreSQL 為核心
* 適合承接跨系統關聯、JSON metadata、Audit Log 與 Domain Event
* NAS Docker 環境可穩定運行 PostgreSQL
* 便於後續 API、報表與自動化整合

替代方案：

* 繼續以 Google Sheet 作主資料庫
* 繼續以 MSSQL 作主資料庫

未採用原因：

* Google Sheet 不適合長期承載跨系統關聯與權限
* MSSQL 為舊系統資料源，資料模型與新系統需求不完全一致

未來方向：

* PostgreSQL 為主
* MSSQL 逐步退為匯入與核對來源

---

### D-003

決策：

MSSQL 暫時保留。

原因：

* QT、課程、點名與部分牧養資料仍依賴舊系統
* 完全切換前需要多次資料核對
* 舊系統資料仍是重要參照來源

替代方案：

* 立即停用 MSSQL
* 一次性匯入後不再同步

未採用原因：

* 資料風險過高
* 使用者流程尚未完全切到新系統
* 需要保留回溯與比對能力

未來方向：

* 逐步把會友、課程、QT、點名遷移到 PostgreSQL
* 匯入腳本保持可重跑
* 完成核對後再降低 MSSQL 依賴

---

### D-004

決策：

會友與課程保留整數主鍵，新增對外編碼 `member_code` / `course_code`。

原因：

* `pastoral_members.id` 與 `education_courses.course_id` 已被多個資料表作為外鍵使用
* 直接把主鍵改成 `TOP...` / `CL...` 會牽動大量關聯表與匯入腳本
* 保留內部主鍵可降低資料遷移風險
* 對外顯示仍可滿足 TOP / CL 編碼需求

替代方案：

* 將主鍵實體改為文字 ID
* 所有外鍵一起轉型為 text

未採用原因：

* 需要停機級 migration
* 外鍵、匯入、查詢與 UI 影響面過大
* 不利於短期穩定上線

未來方向：

* UI 優先顯示 `member_code` / `course_code`
* API 保留 `memberId` / `courseId` 作內部識別
* 若未來要全面改主鍵，需規劃獨立停機 migration

---

### D-005

決策：

專案編號直接遷移為 `PJ` 前綴。

原因：

* `projects.project_id` 原本就是 text 欄位
* 相關表也以 text 儲存 project_id
* 可透過 `ON UPDATE CASCADE` 同步更新關聯表
* 遷移成本低於會友與課程主鍵

替代方案：

* 新增 `project_code`，保留原 project_id

未採用原因：

* 既有 project_id 已是業務編號
* 沒有整數主鍵轉型問題
* 新增欄位反而增加雙軌維護成本

未來方向：

* 專案新建一律由 id_rules 產生 `PJ + 年月 + 流水碼`
* 保留可設定流水碼位數

---

### D-006

決策：

新增 `id_rules` 作為中央編碼規則。

原因：

* 專案、課程、會友、會議都需要不同前綴
* 未來可能調整是否帶年月碼與流水碼位數
* 硬寫在各 module 會造成維護困難
* 系統管理需要可調整入口

替代方案：

* 各 module 各自維護 generateId
* 使用 params 儲存規則

未採用原因：

* 各 module 硬寫會重複且容易不一致
* params 缺少型別、數字範圍與規則語意

未來方向：

* 所有新業務編號逐步改用 id_rules
* 規則調整需搭配資料驗證與權限限制

---

### D-007

決策：

短連結管理移到表單系統，且限管理員以上操作。

原因：

* 短連結目前主要服務公開表單
* 放在系統管理會讓表單管理者操作不直覺
* 短連結可導向外部 URL，需限制操作權限

替代方案：

* 繼續放在系統管理
* 所有表單編輯者皆可管理短連結

未採用原因：

* 系統管理入口與實際使用情境不一致
* 開放給所有表單編輯者會增加誤改與安全風險

未來方向：

* 把短連結管理 UI 獨立成可重用元件
* 可再細分為表單短連結與系統短連結

---

### D-008

決策：

會議管理先沿用既有 `meetings` 資料表，讓 `project_id` 可為空。

原因：

* 既有專案會議已使用 meetings
* 獨立會議與專案會議欄位高度相似
* 先擴充現有模型可快速支援獨立會議
* 可避免重複建立另一套會議資料表

替代方案：

* 建立 standalone_meetings 新表
* 建立完整 calendar/event 模型

未採用原因：

* 短期需求只需要獨立於專案的會議
* 新表會增加文件、附件與通知整合成本
* 完整 calendar 模型超出目前階段需求

未來方向：

* 補上獨立會議編輯、附件與通知
* 若會議需求擴大，再評估抽象成通用 event 模型

---

### D-009

決策：

NAS Docker 作為內部 API 執行環境。

原因：

* 現有 NAS 已可穩定運行 Docker
* 內網服務可直接提供 Apps Script API 與測試
* PostgreSQL 與 API 可放在同一 NAS 管理
* 部署與 rebuild 已可透過 SSH 執行

替代方案：

* Google Cloud Run
* VPS
* Synology Web Station

未採用原因：

* 現階段內部系統優先，NAS 成本與管理最直接
* Cloud Run 仍需處理 DB、私網與金鑰管理
* Web Station 不如 Docker 便於 Node API 部署

未來方向：

* 防火牆與 HTTPS 完成後提供 LINE webhook 外部入口
* 部署流程需補 SQL migration 自動化

---

### D-010

決策：

LINE webhook 先以準備模式與 `log_only` signature mode 運行。

原因：

* LINE Channel Secret 已有，但外部 HTTPS 尚未完全驗證
* 防火牆與憑證仍需資訊人員配合
* 先接收 webhook 與 smoke test，可降低正式切換風險

替代方案：

* 立即啟用嚴格 signature 驗證
* 等外部網路完成後才開發 webhook

未採用原因：

* 嚴格驗證在外部網路未完成前不利於分段測試
* 延後 webhook 開發會阻塞 LINE 整合進度

未來方向：

* 外部 HTTPS 通後改為正式 signature 驗證
* 增加 webhook event 處理與重送保護

---

### D-011

決策：

Remote AI / Local AI 只作輔助與 preflight，不直接修改正式系統。

原因：

* 避免 AI 直接接觸正式 secret、DB dump 或 NAS 資料
* 降低自動化誤改正式系統的風險
* 保留 Codex 作為主要執行與審核者

限制：

* 不直接部署
* 不直接改 DB
* 不直接 push Git
* 不讀取敏感資料

未來方向：

* 使用 `tools/build-ai-context.ps1` 建立安全 context snapshot
* Remote AI 可用於程式碼 preflight、摘要與風險提示

---

### D-012

決策：

採漸進式重構，不一次性重寫。

原因：

* 系統模組多，且同時有資料搬移與 LINE/NAS 串接
* 一次性重寫會造成上線時程與資料風險
* Apps Script、API、DB 可以分層逐步改善

替代方案：

* 全面重寫前端
* 全面重寫 API
* 先停用舊系統再開發新系統

未採用原因：

* 風險過高
* 會中斷現有行政流程
* 難以在短時間內完成資料核對

未來方向：

* 優先拆 routes.js service
* 優先補 smoke tests
* 逐步整理前端大型 Script 檔
