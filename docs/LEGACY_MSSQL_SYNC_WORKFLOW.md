# 舊 MSSQL 與 TopChurchPlus 同步工作流程

## 適用範圍

目前舊系統仍可能寫入 MSSQL，因此牧養資料與課程資料在正式切換前，先以 MSSQL 作為來源資料庫，TopChurchPlus PostgreSQL 作為新系統讀取與測試資料庫。

本流程適用資料：

- 牧養：`Newcomer`、`Shepherd`、`NewcomerTrack`、`ShepherdLeader` 與相關分類表。
- 課程：`CourseClassification`、`Course`、`CourseMember`。

## 重匯流程

每次重匯前一定先備份 PostgreSQL。

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

4. 備份 PostgreSQL 後再匯入 NAS PostgreSQL。

5. 匯入後執行比對：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\database\compare_mssql_postgres_pastoral_education.ps1
   ```

## 舊系統 CRUD 後如何確認同步

短期作法：

- 在舊系統仍可異動資料期間，固定每日或每次大量異動後執行重匯與比對腳本。
- 若比對腳本失敗，先不要使用新系統該模組資料做正式判斷。
- TopChurchPlus 若也開放編輯同一批資料，會有雙寫衝突風險；正式切換前建議牧養與課程以其中一邊為主。

中期建議：

- 在 MSSQL 建立 `LegacyChangeOutbox` 或類似異動佇列表。
- 舊系統在 `Newcomer`、`Shepherd`、`Course*` 做新增、修改、刪除時，同步寫一筆 outbox。
- TopChurchPlus API 定時讀取 outbox，只同步異動過的資料列。
- 每次同步寫入 `legacy_sync_runs`，記錄開始時間、結束時間、新增筆數、更新筆數、停用筆數、錯誤訊息。

正式切換建議：

- 切換前一天凍結舊系統相關 CRUD。
- 做一次 PostgreSQL 完整備份。
- 執行最後一次 MSSQL 重匯。
- 執行比對腳本通過後，才開放 TopChurchPlus 成為正式資料入口。

## 設計原則

- 會友主檔不硬刪，MSSQL 不存在的會友先改為 `is_active = false`，保留其他模組對會友 ID 的關聯。
- 課程修課紀錄以 `(member_id, course_id)` 去重，避免舊系統重複列造成新系統重複顯示。
- `churches` 只 upsert，不 cascade 清除，避免影響其他子系統。
