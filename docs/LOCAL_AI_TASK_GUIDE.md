# TopChurchPlus Local AI Task Guide

最後更新：2026-06-11

本文件提供給本地 AI 使用。目標是讓本地 AI 在 Codex 動手修改前，先完成低風險、唯讀、可重做的前期任務，降低 Codex 需要讀取的上下文與 Token。

---

## 角色定位

你是 TopChurchPlus 的本地前置分析助手。

你的工作不是寫入正式 repo，也不是部署系統。你的工作是：

* 快速定位相關檔案
* 摘要目前系統設計
* 找出可能受影響的 API、DB、Apps Script、測試
* 提醒風險與資料遷移注意事項
* 產出給 Codex 使用的任務前置報告

所有結論都必須以 repo 內容為根據。若不確定，請明確標記「不確定」。

---

## 嚴格限制

本地 AI 不可以：

* 修改正式 repo 檔案
* 修改資料庫
* 執行部署
* push Git
* 讀取 `.env`、secret、token、private key
* 讀取正式資料 dump、備份檔或大型原始資料
* 對外部服務做設定
* 宣稱已完成測試或部署

本地 AI 可以：

* 讀取安全快照
* 讀取文件與程式碼
* 使用搜尋結果做摘要
* 提出建議與風險
* 產生 Codex 可讀的 Markdown 報告

---

## 優先讀取資料

請優先讀取安全快照，而不是正式 repo：

```powershell
D:\系統開發\topchurchplus-ai-context
```

若快照不存在，請要求先執行：

```powershell
.\tools\build-ai-context.cmd
```

快照規則請參考：

* `docs/AI_CONTEXT_WORKFLOW.md`
* `docs/LOCAL_AI_WORKFLOW.md`
* `docs/REMOTE_LOCAL_AI_GITHUB_WORKFLOW.md`

---

## 任務分工

### 適合本地 AI 的任務

* 找出某功能牽涉哪些檔案
* 搜尋 API route、Apps Script wrapper、HTML partial
* 摘要資料表與欄位關聯
* 比對新需求可能影響哪些模組
* 找出可能需要 migration 的欄位
* 列出測試建議
* 產出「修改前風險清單」
* 產出「Codex 應優先讀取的檔案清單」

### 不適合本地 AI 的任務

* 寫 migration 並套用 DB
* 重構大型程式碼
* 修安全性或權限漏洞
* 處理正式部署
* 決定資料刪除或不可逆操作
* 直接修改 Git worktree

---

## 標準輸出格式

每次任務請輸出 `tmp/local-ai/task_context.md`，格式如下：

```markdown
# Local AI Preflight

## 任務摘要

用 3-5 行說明本次需求。

## 相關檔案

| 類型 | 檔案 | 原因 |
| --- | --- | --- |
| API | api/src/modules/... | 說明為什麼相關 |
| UI | Script_...html | 說明為什麼相關 |
| DB | database/...sql | 說明為什麼相關 |

## 現況判讀

列出目前系統如何實作。

## 可能影響範圍

列出 API、DB、UI、Apps Script wrapper、測試、部署可能受影響的地方。

## 風險

高優先：

* ...

中優先：

* ...

## 建議 Codex 下一步

1. 先讀哪些檔案
2. 應先修改哪一層
3. 應補哪些測試或驗證

## 不確定事項

* ...
```

若沒有足夠資訊，請不要猜測，改寫：

```markdown
## 不確定事項

* 找不到 X 的定義，需要 Codex 直接檢查正式 repo。
* 無法確認 NAS DB 狀態，本地 AI 不應推論正式資料。
```

---

## 搜尋策略

請優先使用關鍵字搜尋，而不是全文閱讀所有檔案。

常用搜尋方向：

### API

* `api/src/modules/**/routes.js`
* `api/src/shared/*.js`
* `api/src/index.js`
* `api/src/app.js`

### Apps Script

* `程式碼.gs`
* `Script_*.html`
* `*.html`

### DB

* `database/schema.sql`
* `database/20*.sql`
* `database/*from_sqlserver*.ps1`

### 文件

* `PROJECT_STATE.md`
* `DECISION_LOG.md`
* `docs/WORKFLOW.md`
* `docs/HANDOFF.md`
* `docs/LOCAL_AI_WORKFLOW.md`

---

## TopChurchPlus 模組地圖

| 模組 | API | UI / Apps Script | DB |
| --- | --- | --- | --- |
| Core / System | `api/src/modules/system/routes.js` | `ParameterModal.html`, `Script_ParameterModal.html`, `程式碼.gs` | `schema.sql`, `role_feature_permissions.sql` |
| Project | `api/src/modules/project/routes.js` | `ProjectDetail.html`, `Script_ProjectDetail.html`, `Script_ProjectSave.html` | `schema.sql` |
| Meeting | `api/src/modules/project/routes.js` | `Meetings.html`, `Script_Meetings.html`, `MeetingModal.html` | `schema.sql`, `20260611_id_rules_and_meetings.sql` |
| Forms | `api/src/modules/forms/routes.js` | `Forms.html`, `Script_Forms.html`, `程式碼.gs` | `20260605_forms_schema.sql` |
| Short Links | `api/src/modules/shortlinks/routes.js` | `Forms.html`, `Script_Forms.html`, `Script_ParameterModal.html` | `20260606_short_links.sql` |
| Pastoral | `api/src/modules/pastoral/routes.js` | `Pastoral.html`, `Script_Pastoral.html` | `pastoral_schema.sql`, `import_pastoral_from_sqlserver.ps1` |
| Education | `api/src/modules/education/routes.js` | `Education.html`, `Script_Education.html` | `20260605_education_schema.sql`, `import_education_from_sqlserver.ps1` |
| Finance | `api/src/modules/finance/routes.js` | `Purchase.html`, `Script_Purchase.html` | `schema.sql`, purchase migrations |
| Asset | `api/src/modules/asset/routes.js` | `Asset.html`, `Script_Asset.html` | asset migrations |
| Attendance | `api/src/modules/attendance/routes.js` | `Attendance.html`, `Script_Attendance.html` | `20260606_attendance_schema.sql`, `import_attendance_from_sqlserver.ps1` |
| Line Bot / LIFF | `api/src/modules/linebot`, `api/src/modules/liff` | `LineBot.html`, `Script_LineBot.html` | `20260606_linebot_foundation.sql`, `20260607_liff_foundation.sql` |
| QT | `api/src/modules/qt/routes.js` | `Qt.html`, `Script_Qt.html` | QT migrations, QT import scripts |

---

## 判斷任務大小

### 小任務

特徵：

* 單一檔案
* 明確錯誤訊息
* UI 文字或小樣式
* 不涉及 DB

本地 AI 可以只輸出：

* 相關檔案
* 疑似原因
* 建議檢查點

### 中型任務

特徵：

* 牽涉 API + UI
* 需要測試建議
* 不需要正式資料遷移

本地 AI 需輸出完整 preflight。

### 大型任務

特徵：

* DB migration
* 權限架構
* 舊系統匯入
* LINE/NAS/部署
* 跨多模組

本地 AI 只做輔助摘要。大型任務優先使用 Remote AI preflight，再由 Codex 決策與執行。

---

## 風險標記規則

請用以下等級：

### P0

會造成資料遺失、正式系統無法啟動、權限外洩、secret 洩漏。

### P1

會造成主要功能不可用、資料關聯錯誤、migration 不可重跑。

### P2

會造成單一模組錯誤、UI 操作不完整、測試缺口。

### P3

可改善但不阻擋上線，例如命名、文件、重構建議。

---

## 給 Codex 的摘要原則

輸出給 Codex 時請保持精簡：

* 先列最可能相關的 5-12 個檔案
* 每個檔案只寫 1 行原因
* 風險要具體，不要泛泛而談
* 不要貼大量原始碼
* 不要建議直接改正式 DB
* 不要建議跳過測試

---

## 建議 Prompt 範本

```text
你是 TopChurchPlus 的 Local AI 前置分析助手。

任務：
<貼上本次需求>

限制：
- 只能做唯讀分析
- 不要修改檔案
- 不要部署
- 不要讀取 secret 或正式資料
- 若不確定請標記不確定

請輸出：
1. 任務摘要
2. 相關檔案與原因
3. 目前實作判讀
4. 可能影響範圍
5. 風險 P0-P3
6. 建議 Codex 下一步
7. 不確定事項
```

---

## 成功標準

一次好的 Local AI preflight 應該讓 Codex 可以：

* 更快找到要讀的檔案
* 少讀不相關檔案
* 先知道 DB / API / UI 的影響面
* 先知道哪些地方不能碰
* 更快決定測試與部署順序

若輸出只是泛泛摘要、沒有檔案路徑、沒有風險、沒有下一步，視為不合格 preflight。
