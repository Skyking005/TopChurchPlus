# 聚會統計與會友點名同步設計

## 舊系統資料分析

本次分析來源為 MSSQL `TopChurch` 的三張表：

- `WorshipWeekend`
- `RollcallType`
- `NewcomerWorshipRecord`

舊系統主要介面參考：

- `Views/LineBotWebHook/RollcallManagement.cshtml`
- `Views/LineBotWebHook/SpiritualLifeManagement.cshtml`
- `Models/NewcomerWorshipRecord.cs`
- `Models/WorshipWeekend.cs`
- `Models/RollcallType.cs`

### WorshipWeekend

用途：聚會週次或統計日期主檔。

欄位：

- `WorshipWeekend001`：舊系統序號。
- `WorshipWeekend002`：聚會日期，舊註解稱為星期日。

目前資料：

- 筆數：315。
- 日期範圍：2020-05-31 至 2026-06-07。

### RollcallType

用途：點名類型主檔。

欄位：

- `RollcallType001`：舊系統序號。
- `RollcallType002`：點名類型名稱，例如主日、小家、晨禱。
- `RollcallType003`：是否分區統計。
- `RollcallType004` 至 `RollcallType010`：星期一至星期日是否可使用此點名類型。

目前資料：

- 筆數：17。
- `NewcomerWorshipRecord` 中真正大量使用的是 `1 主日` 與 `2 小家`。
- 其他類型目前在 `NewcomerWorshipRecord` 內幾乎沒有標準化資料。

### NewcomerWorshipRecord

用途：會友在某個聚會週次、某個點名類型的標準化出席紀錄。

欄位：

- `NewcomerWorshipRecord001`：舊系統序號。
- `NewcomerWorshipRecord002`：聚會週次，對應 `WorshipWeekend.WorshipWeekend001`。
- `NewcomerWorshipRecord003`：會友序號，對應 `Newcomer.Newcomer001`。
- `NewcomerWorshipRecord004`：點名類型，對應 `RollcallType.RollcallType001`。
- `NewcomerWorshipRecord005`：出席方式，舊註解為 `0 實體`、`1 線上`。
- `NewcomerWorshipRecord006`：建立或點名時間。

目前資料：

- 筆數：521,166。
- 主日：340,011。
- 小家：181,125。
- 台北大學教會：30。
- 無孤兒資料：聚會週次、會友、點名類型都能對應到主檔。
- 有 291 組重複自然鍵：`聚會週次 + 會友 + 點名類型`。

## 舊系統行為判斷

舊系統其實有兩種點名資料：

- `NewcomerRollcall`：LINE BOT、QRCode 或掃描產生的原始簽到紀錄。
- `NewcomerWorshipRecord`：聚會統計用的標準化出席紀錄。

本次指定的三張表屬於第二層，也就是比較適合做正式統計與牧養查看的資料。第一版建議先同步 `NewcomerWorshipRecord`，等 LINE BOT 新系統實作時，再把即時簽到寫入新的原始事件表，並同步更新標準化出席表。

## 新系統模組規劃

功能入口：聚會統計系統。

聚會統計系統內分成兩個主要功能：

- 小家統計
- 聚會統計

兩者分開處理，避免小家牧養分析與全教會聚會報表混在一起。

### 小家統計

用途：

- 以牧區架構查看小家出席狀況。
- 讓牧養同工快速知道小家近期出席、缺席、連續缺席、出席率。

建議畫面：

- 日期區間：預設最近 8 週。
- 點名類型：預設小家。
- 會堂篩選。
- 牧區篩選，可依 `pastoral_groups` 階層展開。
- 表格欄位：
  - 會堂
  - 牧區分類
  - 牧區
  - 大家
  - 小家
  - 牧區人數
  - 出席人次
  - 平均出席
  - 出席率
  - 連續缺席人數
  - 功能：查看名單

查看名單時顯示：

- 會友姓名
- 目前牧區
- 最近 8 週出席格狀圖
- 最近一次小家日期
- 連續缺席週數
- 電話
- 跟進同工

### 聚會統計

用途：

- 以聚會類型、會堂、日期區間做整體趨勢統計。
- 主日、線上、晨禱、禱告會、青年崇拜等未來都可納入。

建議畫面：

- 日期區間。
- 聚會類型。
- 會堂。
- 出席方式：全部、實體、線上。
- 統計卡片：
  - 總出席人次
  - 平均每次出席
  - 最高出席
  - 近期趨勢
- 趨勢圖：
  - 日期 x 出席人數。
  - 可切換會堂或聚會類型。
- 明細表：
  - 日期
  - 聚會類型
  - 會堂
  - 實體人數
  - 線上人數
  - 總人數

## 建議 PostgreSQL 資料結構

依照目前系統命名，建議新增 `attendance` 模組資料表。

### attendance_events

聚會日期或點名事件主檔。

欄位：

- `id`：新系統序號。
- `legacy_worship_weekend_id`：舊 `WorshipWeekend001`。
- `event_date`：聚會日期。
- `title`：聚會標題，預設可用日期或類型組合。
- `created_at`
- `updated_at`

建議唯一鍵：

- `legacy_worship_weekend_id`
- `event_date`

### attendance_types

點名類型主檔。

欄位：

- `id`：新系統序號，可沿用舊 `RollcallType001`。
- `name`：點名類型名稱。
- `is_area_based`：是否分區統計。
- `active_weekdays`：建議使用 `smallint[]` 儲存可用星期，避免沿用 `RollcallType004` 到 `RollcallType010` 這種固定欄位。
- `is_active`
- `sort_order`
- `created_at`
- `updated_at`

### attendance_records

會友出席標準化紀錄。

欄位：

- `id`：新系統序號。
- `legacy_record_id`：舊 `NewcomerWorshipRecord001`。
- `event_id`：對應 `attendance_events.id`。
- `member_id`：對應 `pastoral_members.id`。
- `attendance_type_id`：對應 `attendance_types.id`。
- `attendance_mode`：`physical`、`online`。
- `recorded_at`：舊 `NewcomerWorshipRecord006`。
- `source_system`：例如 `legacy_mssql`、`linebot`、`manual`。
- `source_id`
- `created_at`
- `updated_at`

建議唯一鍵：

- `legacy_record_id`，保留舊資料可追溯。

建議去重鍵：

- `event_id, member_id, attendance_type_id, attendance_mode`

說明：

舊資料有少量自然鍵重複，因此匯入時不應直接用 `event_id, member_id, attendance_type_id` 當唯一鍵。建議先保留每筆舊紀錄，統計查詢時用 `COUNT(DISTINCT member_id)` 或在匯入產生 `attendance_record_dedup_view`。

### attendance_group_snapshots

可選，但建議第二階段加入。

用途是保存點名當下的牧區歸屬快照，避免會友未來換小家後，歷史統計被重新歸到新牧區。

欄位：

- `attendance_record_id`
- `church_id`
- `group_id`
- `group_path`
- `group_level_no`
- `captured_at`

第一版若先不做快照，也可以即時計算目前牧區，但要知道歷史統計會隨牧區調整而改變。

## 匯入策略

第一版建議做完整重匯：

1. 從 MSSQL 匯出 `WorshipWeekend` 到 `attendance_events`。
2. 從 MSSQL 匯出 `RollcallType` 到 `attendance_types`。
3. 從 MSSQL 匯出 `NewcomerWorshipRecord` 到 `attendance_records`。
4. 只匯入有對應 `pastoral_members`、`attendance_events`、`attendance_types` 的資料。
5. 匯入後比對：
   - `WorshipWeekend` 筆數。
   - `RollcallType` 筆數。
   - `NewcomerWorshipRecord` 有效筆數。
   - 主日、小家分類筆數。

建議納入既有每週同步總控腳本：

- `database/run_legacy_weekly_sync.ps1`

同步順序建議放在牧養資料之後，因為出席紀錄需要 `pastoral_members` 先存在。

## API 規劃

新增模組：

- `api/src/modules/attendance/routes.js`

建議 API：

- `GET /attendance/options`
  - 回傳會堂、牧區、點名類型、日期範圍。
- `GET /attendance/small-groups`
  - 小家統計清單。
- `GET /attendance/small-groups/:groupId/members`
  - 小家成員近期出席明細。
- `GET /attendance/meetings`
  - 聚會統計趨勢與摘要。
- `GET /attendance/members/:memberId/recent`
  - 會友最近 2 個月聚會狀況。

權限：

- 使用 `attendance` 系統功能權限。
- 小家統計需要同時套用牧養資料會堂權限。
- 超級管理者與管理員可看全部。
- 牧養同工若未來要開放，應依 `account_pastoral_church_permissions` 限制。

## 前端規劃

新增：

- `Attendance.html`
- `Script_Attendance.html`

調整：

- `Index.html` include 新檔案。
- `Script_Login.html` 將 `attendance` 從 coming soon 改為 `openAttendanceSystem`。
- `MAIN_VIEW_IDS` 增加 `attendanceView`。

畫面內 tab：

- 小家統計
- 聚會統計

### 小家統計 UI

建議採用表格加趨勢摘要，不使用 modal 作為主體。

資料列可點開下方明細區：

- 統計清單在上。
- 點選小家後，下方顯示小家成員最近 8 週出席格。
- 避免一次載入全部成員明細，先載入清單，再按需載入。

### 聚會統計 UI

建議先做簡化版：

- 統計卡片。
- 趨勢表格。
- 明細清單。

圖表可第二階段加入。

## 會友詳細資料調整

在 `Pastoral.html` 會友詳情加入一個區塊：

- 標題：最近聚會狀況
- 位置：建議放在「課程狀態」上方或下方。
- 期間：最近 2 個月。

內容：

- 主日：
  - 最近 8 週出席格。
  - 出席次數。
  - 最近一次出席日期。
  - 最近一次出席方式。
- 小家：
  - 最近 8 週出席格。
  - 出席次數。
  - 最近一次出席日期。
  - 連續未出席週數。

視覺建議：

- 綠色：有出席。
- 灰色：無資料或未出席。
- 藍色角標：線上。
- 實體不額外標示，減少干擾。

## 索引建議

`attendance_events`：

- `event_date`
- `legacy_worship_weekend_id`

`attendance_records`：

- `legacy_record_id`
- `event_id, attendance_type_id`
- `member_id, event_id`
- `attendance_type_id, member_id`
- `recorded_at`

若小家統計大量查詢：

- `attendance_group_snapshots(group_id, attendance_record_id)`
- `attendance_group_snapshots(church_id, group_id)`

## 實作順序建議

1. 建立 `attendance` schema migration。
2. 建立 MSSQL 匯入腳本與比對腳本。
3. 將點名同步加入 `database/run_legacy_weekly_sync.ps1`。
4. 建立 API `attendance` 模組。
5. 在聚會統計系統建立小家統計與聚會統計兩個 tab。
6. 在會友詳細資料加入最近 2 個月聚會狀況。
7. 用舊資料驗證：
   - 2026-05 主日、小家筆數。
   - 任一小家近 8 週清單。
   - 任一會友近 2 個月聚會狀況。

## 需要確認的決策

1. 歷史統計是否要保存牧區快照。
   - 建議保存，否則未來調整牧區會改變歷史統計歸屬。
2. `NewcomerWorshipRecord` 的重複自然鍵是否保留。
   - 建議原始資料保留，統計時去重。
3. 第一版是否只支援主日與小家。
   - 建議第一版 UI 先聚焦主日與小家，資料表保留所有 `RollcallType`。
4. LINE BOT 即時點名是否本階段同步寫入新系統。
   - 建議先匯入歷史資料；LINE BOT 新系統完成後，再讓新點名直接寫入 `attendance_records`。
