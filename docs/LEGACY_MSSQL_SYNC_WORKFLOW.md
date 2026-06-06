# 舊 MSSQL 與 TopChurchPlus 同步工作流程

## 適用範圍

目前舊系統仍可能寫入 MSSQL，因此牧養資料與課程資料在正式切換前，先以 MSSQL 作為來源資料庫，TopChurchPlus PostgreSQL 作為新系統讀取與測試資料庫。

本流程適用資料：

- 牧養：`Newcomer`、`Shepherd`、`NewcomerTrack`、`ShepherdLeader` 與相關分類表。
- 課程：`CourseClassification`、`Course`、`CourseMember`。
- QT：`QuietTimePrice`、`QuietTimeOrderPaymentType`、`QuietTimeInventory*`、`QuietTimeOrder`、`QuietTimeOrderItem`。
- 聚會點名：`WorshipWeekend`、`RollcallType`、`NewcomerWorshipRecord`。

## 重匯流程

每次重匯前一定先備份 PostgreSQL。

建議固定使用總控腳本執行完整同步，避免手動漏掉其中一步：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\database\run_legacy_weekly_sync.ps1
```

總控腳本會依序執行牧養匯出、牧養安全 SQL 產生、課程匯出、聚會點名匯出、PostgreSQL 備份、牧養/課程/聚會點名匯入、QT 匯入，以及 MSSQL/PostgreSQL 筆數比對。執行紀錄會保存於 `logs\legacy_sync\`，每次同步都會產生一份新的 `.log`。

若需要分段排查，可依照以下步驟手動執行。

1. 從 MSSQL 產生最新牧養 SQL：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\database\import_pastoral_from_sqlserver.ps1 -GenerateOnly
   ```

2. 產生安全版牧養 SQL：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\database\build_safe_pastoral_import.ps1
   ```

   安全版不會 `TRUNCATE churches CASCADE`，避免誤清 QT、QRCode、行政物資等其他模組資料。

3. 從 MSSQL 產生最新課程 SQL：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\database\import_education_from_sqlserver.ps1
   ```

4. 備份 PostgreSQL 後，匯入牧養與課程資料到 NAS PostgreSQL。

5. 從 MSSQL 匯入最新 QT 資料：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\database\import_qt_from_sqlserver.ps1
   ```

   QT 匯入會先備份 PostgreSQL。訂單、領取明細、付款方式以 MSSQL 為準重建；價格方案 upsert；舊系統庫存只重建 `source_system = 'legacy_quiet_time'` 的 initial stock，保留新系統人工庫存異動與 Demo 異動。

6. 從 MSSQL 匯入最新聚會點名資料：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\database\import_attendance_from_sqlserver.ps1
   ```

   點名匯入會重建 `attendance_events`、`attendance_types`、`attendance_records`，並只匯入有對應會友、聚會週次與點名類型的有效資料。牧養系統的會友詳情會使用這份資料顯示最近兩個月主日與小家狀況。

6. 匯入後執行比對：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\database\compare_mssql_postgres_pastoral_education.ps1
   ```

## 舊系統 CRUD 後如何確認同步

短期作法：

- 在舊系統仍可異動資料期間，固定每日或每次大量異動後執行重匯與比對腳本。
- 若比對腳本失敗，先不要使用新系統該模組資料做正式判斷。
- TopChurchPlus 若也開放編輯同一批資料，會有雙寫衝突風險；正式切換前建議牧養與課程以其中一邊為主。
- QT 若舊系統與新系統同時開放訂購或領取，衝突風險更高；正式切換前建議 QT 訂單與領取仍以 MSSQL 為主，新系統先做查詢、報表與庫存預警。

中期建議：

- 在 MSSQL 建立 `LegacyChangeOutbox` 或類似異動佇列表。
- 舊系統在 `Newcomer`、`Shepherd`、`Course*`、`QuietTime*` 做新增、修改、刪除時，同步寫一筆 outbox。
- TopChurchPlus API 定時讀取 outbox，只同步異動過的資料列。
- 每次同步寫入 `legacy_sync_runs`，記錄開始時間、結束時間、新增筆數、更新筆數、停用筆數、錯誤訊息。

正式切換建議：

- 切換前一天凍結舊系統相關 CRUD。
- 做一次 PostgreSQL 完整備份。
- 執行最後一次 MSSQL 重匯。
- 執行比對腳本通過後，才開放 TopChurchPlus 成為正式資料入口。

## 每週自動同步

目前採用每週完整重匯方式，適合舊系統與新系統並行測試期使用。預設排程建議設為每週一早上 06:00 執行，讓主日或週末異動可以在週初同步到 TopChurchPlus。

每週同步範圍：

- 牧養資料：會友、牧區、關懷紀錄、分類、職分、職業、婚姻狀態。
- 課程資料：課程分類、課程、修課紀錄。
- QT 資料：訂購方案、付款方式、訂單、領取明細、舊系統庫存。
- 聚會點名資料：聚會週次、點名類型、會友出席紀錄。

每週同步會產生：

- PostgreSQL 備份檔，保存在 NAS 的 `/volume1/docker/project-api/backups/`。
- 本機同步 log，保存在 `logs\legacy_sync\`。
- MSSQL 與 PostgreSQL 筆數比對結果。

若排程失敗，優先檢查最新的 `logs\legacy_sync\legacy_sync_*.log`，再檢查 NAS 備份目錄是否有產生當次備份。

## 設計原則

- 會友主檔不硬刪，MSSQL 不存在的會友先改為 `is_active = false`，保留其他模組對會友 ID 的關聯。
- 課程修課紀錄以 `(member_id, course_id)` 去重，避免舊系統重複列造成新系統重複顯示。
- `churches` 只 upsert，不 cascade 清除，避免影響其他子系統。
- QT 領取明細只匯入有對應訂單的有效資料，避免孤兒明細破壞外鍵。
- QT 舊庫存與新系統庫存異動分開管理，避免重匯時清掉新系統人工調整、調撥、Demo 測試紀錄。
- 聚會點名紀錄只匯入有對應會友、聚會週次與點名類型的有效資料；統計查詢使用去重視圖，避免舊系統重複自然鍵讓出席人數膨脹。
