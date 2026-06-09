# TopChurchPlus Modules

最後更新：2026-06-09

本文件列出目前系統模組、狀態、主要檔案與細部修正注意事項。若要修某一模組，先讀本文件對應章節，再讀模組 route 與前端 partial。

## 系統管理

Feature key：`system`

主要檔案：

- `api/src/modules/system/routes.js`
- `Script_Login.html`

狀態：

- 使用者管理、權限管理、參數管理、系統日誌、使用紀錄已逐步納入。
- 系統管理不用 modal，是獨立系統頁。

注意：

- 只有超級管理者可做系統層級調整。
- 管理員是應用層權限，不等同超級管理者。

## 系統開發管理

Feature key：`dev_management`

主要檔案：

- `DevManagement.html`
- `Script_DevManagement.html`
- `api/src/modules/dev-management/routes.js`
- `database/20260609_dev_management.sql`

狀態：

- 超級管理者專用。
- 可提交 Issue 提案，欄位包含類型、狀態、優先度、描述。
- 可 review `NEW_THREAD_GUIDE`、`HANDOFF`、`DOCUMENTATION_MAINTENANCE`、`SYSTEM_ARCHITECTURE`、`DATABASE_SCHEMA`、`API_CATALOG`、`MODULES`、`WORKFLOW`、`TEST_MATRIX`、`AGENTS`、Skill 摘要等文件。
- 可記錄版本更新歷程、部署狀態與驗證摘要。

注意：

- 管理員不可看此模組。
- 文件讀取採 API 白名單，不允許任意讀檔。
- Issue 與版本新增/更新會寫入 audit log。

## 專案管理

Feature key：`project`

主要檔案：

- `ProjectDetail.html`
- `Script_ProjectDetail.html`
- `Script_ProjectSave.html`
- `Script_MeetingModal.html`
- `api/src/modules/project/routes.js`

狀態：

- 專案清單、搜尋、詳細、保存、權限、會議與文件產出已存在。
- 專案可與財務請購建立關聯。

注意：

- 全職同工仍需加入專案權限才能看到特定專案。
- 有完全控制權限者可保存，不限專案登入人。
- 新增專案時若尚無專案編號，會議與權限管理要避免直接操作造成錯誤。

## 財務管理

Feature key：`finance`

主要檔案：

- `Purchase.html`
- `Script_Purchase.html`
- `api/src/modules/finance/routes.js`

狀態：

- 採購、預借、支出證明、請款、獨立請款、報價 PDF、支出憑證類型已逐步完成。

注意：

- 請款申請清單需能瀏覽/編輯/印出請款與支出證明。
- 支出證明一定掛請款。
- 採購單可為專案採購、一般採購、維修採購、其他採購。
- 財務資料會產生資產時，需建立跨系統關聯。

## 牧養管理

Feature key：`pastoral`

主要檔案：

- `Pastoral.html`
- `Script_Pastoral.html`
- `api/src/modules/pastoral/routes.js`

狀態：

- 會友主檔、會堂資料權限、照片/新人單方向已建立。
- 舊 MSSQL 仍是重要資料來源。

注意：

- 保存時若偵測同名資料，要跳出警示。
- 會友詳細建議直接切編輯畫面，不用 modal。
- 牧區欄位過長時需合理排版。
- 會友資料會影響教育、點名、Line App、表單、場地。

## 表單系統

Feature key：`forms`

主要檔案：

- `Forms.html`
- `Script_Forms.html`
- `api/src/modules/forms/routes.js`

狀態：

- 表單建立、公開填寫、Email 必填、編輯連結、停止/過期提示、圖片附件、回覆統計為目前方向。

注意：

- 表單停止或過期後不可新增/修改回覆。
- 外部連結過長可搭配短連結。
- 如有收費，需與櫃台系統串接。

## 櫃台工作台

Feature key：`counter`

主要檔案：

- `Counter.html`
- `Script_Counter.html`
- `api/src/modules/counter/routes.js`

狀態：

- 與內部系統入口分開。
- PIN Code 需要使用者、狀態、所屬會堂。
- 登入後可顯示當前會堂，也允許手動調整。

注意：

- PIN 規則為第一碼英文後五碼數字。
- QRCode 報到要放在櫃台工作站。
- 金流需能追蹤到會堂。

## QT 管理

Feature key：`qt`

主要檔案：

- `Qt.html`
- `Script_Qt.html`
- `api/src/modules/qt/routes.js`

狀態：

- QT 庫存、調撥、異動、庫存檢查已建立。

注意：

- 未來 LIFF 下單前必須查庫存。
- 舊 QuietTime 資料需要定期同步或匯入。

## 教育管理

Feature key：`education`

主要檔案：

- `Education.html`
- `Script_Education.html`
- `api/src/modules/education/routes.js`

狀態：

- 參考 Course 系列資料。
- 課程管理、學員狀態、培育階段、講師班表為核心。

注意：

- E1、成長班、E2、門徒班、E3、領袖班有順序限制。
- 牧養會友詳細要看課程狀態。

## 資產管理

Feature key：`asset`

主要檔案：

- `Asset.html`
- `Script_Asset.html`
- `api/src/modules/asset/routes.js`

狀態：

- 資產清單、詳細、位置管理與資產來源關聯已建立。

注意：

- 位置資料與場地借用有關。
- 從請款建立資產時要保存來源關聯。

## 行政物資管理

Feature key：`admin_supply`

主要檔案：

- `AdminSupply.html`
- `Script_AdminSupply.html`
- `api/src/modules/admin-supply/routes.js`

狀態：

- 用於行政消耗品庫存管理。
- 需支援總數量與各分堂數量。

## 場地預約

Feature key：`venue`

主要檔案：

- `Venue.html`
- `Script_Venue.html`
- `api/src/modules/venue/routes.js`

狀態：

- 場地可借用設定與預約清單已建立。

注意：

- 應以週檢視為主。
- 同場地同時段不可重疊。
- 已借出的場地在新增時需鎖定。

## Zoom 帳號管理

Feature key：`zoom`

主要檔案：

- `Zoom.html`
- `Script_Zoom.html`
- `api/src/modules/zoom/routes.js`

狀態：

- 管理 Zoom 帳號借用，以行事曆方式呈現。

注意：

- 同帳號同一天不同時段可重複借用。
- 只要時間衝突就不可借。

## QRCode 活動管理

Feature key：`qrcode`

主要檔案：

- `Qrcode.html`
- `Script_Qrcode.html`
- `api/src/modules/qrcode/routes.js`

狀態：

- 活動 QRCode 報到與櫃台掃描方向已建立。

注意：

- 攝影機權限需要瀏覽器允許。
- 外部櫃台工作站更適合掃描，不應只放內部後台。

## 聚會統計

Feature key：`attendance`

主要檔案：

- `Attendance.html`
- `Script_Attendance.html`
- `api/src/modules/attendance/routes.js`

狀態：

- 小家統計與聚會統計分開。
- 來源包含 `NewcomerWorshipRecord`、`WorshipWeekend`、`RollcallType`。

注意：

- 會友詳細需顯示最近兩個月聚會狀況。

## 主日信息管理

Feature key：`sunday_message`

主要檔案：

- `SundayMessage.html`
- `Script_SundayMessage.html`
- `api/src/modules/sunday-message/routes.js`

狀態：

- 秘書部與主任牧師可看。
- 管理信息主題、講員、會堂分享狀態、非會堂場合。

注意：

- 相關參數放在此模組，不放系統管理。
- 外請講員也要納入。

## Line App 會友管理

Feature key：`linebot`

主要檔案：

- `LineBot.html`
- `Script_LineBot.html`
- `api/src/modules/linebot/routes.js`
- `api/src/modules/liff/routes.js`
- `api/src/modules/liff/security.js`
- `api/public/liff/*`

狀態：

- 介面名稱為 `Line App會友管理系統`。
- 內部 key/path 暫保留 `linebot`。
- Rich Menu、會友綁定、LIFF 入口、LINE API 預備、LIFF 安全框架已建立。

注意：

- LINE API 預設不正式呼叫。
- LIFF 安全預設監控模式，不阻擋。
- 綁定流程為姓名 + 手機號碼。

## 個人工作日誌

主要檔案：

- `WorkLogModal.html`
- `Script_WorkLog.html`
- `api/src/modules/worklog/routes.js`

狀態：

- 登出旁個人工作日誌，欄位簡化為日期、工作項目。

## 文件產出

主要檔案：

- `api/src/modules/documents/routes.js`
- `api/src/modules/documents/docx-builder.js`

狀態：

- DOCX/PDF 產出逐步搬到 NAS。

注意：

- 新文件產出優先走 NAS 文件服務，不再新增 Google Drive 依賴。
