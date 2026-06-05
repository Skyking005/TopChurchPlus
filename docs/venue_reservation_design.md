# 場地預約系統設計

## 場地來源

場地資源以 `asset_locations` 現有資料為基礎，使用：

- `hall`：會堂
- `main_location`：主要位置

系統先以 `hall + main_location` 分組成可查詢的場地資源。因為固定資產的位置資料可能還沒有完整整理成「可借用」狀態，第一版不以 `is_bookable` 作為嚴格篩選條件，只顯示是否曾有任一子位置標記可借用。

## 行事曆綁定

新增 `venue_resource_calendars`，用來保存每個 `hall + main_location` 對應的 Google 行事曆 ID。

Apps Script 端透過 `CalendarApp.getCalendarById(calendarId)` 讀取事件，原因是目前前端仍部署在 Google Apps Script，使用 CalendarApp 可以沿用部署者的 Google 授權，不需要在 NAS API Server 另外建置 Google OAuth 流程。

## 可用狀態判斷

查詢時段由前端送出：

- `startAt`
- `endAt`
- `hall`
- `mainLocation`

API 回傳：

- 場地資源
- 本系統資料庫中的 `venue_reservations`

Apps Script 再補上 Google Calendar 事件，最後前端依資源顯示：

- `可使用`：已綁定行事曆，且查詢時段沒有占用事件
- `使用中`：資料庫或 Google 行事曆有重疊事件
- `未綁定行事曆`：尚未設定 calendar ID
- `行事曆錯誤`：calendar ID 無效或部署者沒有讀取權限

## 後續延伸

下一階段可加入：

- 建立場地預約單並寫入 `venue_reservations`
- 預約成立時同步建立 Google Calendar event
- 預約取消時同步取消 Google Calendar event
- 與專案、財務、表單系統建立 `entity_links`
- 場地借用開放給會友時，加入外部使用者身份與驗證流程
