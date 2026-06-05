# Database Change And MSSQL Import Workflow

## 目的

目前系統開發資料庫使用 PostgreSQL，但正式資料來源仍以 MSSQL 為主。每次異動資料庫結構時，除了確認新功能可用，也要確認未來正式啟用時，MSSQL 舊資料可以可靠匯入 PostgreSQL。

這份流程適用於：

- 新增資料表。
- 新增、改名、移除欄位。
- 調整欄位型別、必填、預設值。
- 新增索引、唯一限制、外鍵。
- 調整狀態值、參數值、中文欄位語意。
- 新增資料匯入腳本或修改匯入邏輯。

## 分支規則

- 資料庫結構與匯入腳本集中在 `codex/database-core` 或單一資料庫任務分支處理。
- 功能分支如果需要 schema change，先建立資料庫異動提案，不直接修改 `database/schema.sql`。
- 不要讓多個實驗分支同時修改正式資料庫結構。

## 異動前檢查

每次資料庫異動前，先建立一份 mapping 文件，可從 `database/templates/mssql_mapping_template.md` 複製。

必填內容：

- 異動目的。
- 受影響系統模組。
- PostgreSQL 目標資料表與欄位。
- MSSQL 來源資料表與欄位。
- 欄位型別與轉換規則。
- 必填、預設值與空值處理。
- 主鍵、外鍵、唯一鍵、索引。
- 每個外鍵欄位是否已有以該欄位為開頭的索引；若沒有，需說明不建立的原因。
- 狀態值或參數值對照。
- 無法對應或需人工處理的資料。

## 異動實作順序

1. 先寫 mapping 文件。
2. 備份 PostgreSQL。
3. 撰寫 migration SQL。
4. 在測試資料庫或可回復環境執行 migration。
5. 撰寫或更新 MSSQL 匯入腳本。
6. 匯入一小批 MSSQL 樣本資料。
7. 比對筆數、關聯、必填欄位、狀態值。
8. 檢查外鍵欄位索引覆蓋率。
9. API 與前端使用新結構做最小流程測試。
10. Commit 訊息記錄 schema change、mapping 文件、匯入驗證結果。

## PostgreSQL 備份

正式或共用資料庫異動前必須備份。NAS Docker 環境可使用類似指令：

```bash
cd /volume1/docker/project-api
mkdir -p backups
sudo docker exec TopProject pg_dump -U tcnschurch -d postgres > backups/topchurchplus_before_<change_name>_$(date +%Y%m%d_%H%M%S).sql
```

備份檔路徑需寫入 commit message 或任務回報。

## 匯入驗證標準

至少檢查：

- 來源 MSSQL 筆數與 PostgreSQL 目標筆數是否一致。
- 主檔與明細表關聯是否完整。
- 必填欄位是否沒有空值。
- 日期、金額、電話、身分證、Line ID、會堂、牧區、帳號等欄位是否轉換正確。
- 中文狀態值是否仍為可讀繁體中文。
- 無法對應資料是否輸出到 unmatched CSV 或 migration report。
- API 清單與詳細資料能讀出匯入後資料。

## 外鍵索引檢查

PostgreSQL 會替 primary key 和 unique constraint 建索引，但不會自動替 foreign key 欄位建索引。每次新增外鍵或調整資料表關聯時，都要確認外鍵欄位是否已有索引，尤其是明細表、紀錄表、清單常用篩選欄位。

可用下列查詢列出「外鍵欄位沒有以該欄位為開頭的索引」的項目：

```sql
WITH fk AS (
  SELECT
    c.conname,
    c.conrelid,
    c.conkey,
    rel.relname AS table_name,
    ref.relname AS referenced_table,
    rel.reltuples::bigint AS estimated_rows,
    array_agg(att.attname ORDER BY key_ord.ord) AS columns
  FROM pg_constraint c
  JOIN pg_class rel ON rel.oid = c.conrelid
  JOIN pg_namespace ns ON ns.oid = rel.relnamespace
  JOIN pg_class ref ON ref.oid = c.confrelid
  JOIN unnest(c.conkey) WITH ORDINALITY AS key_ord(attnum, ord) ON true
  JOIN pg_attribute att ON att.attrelid = c.conrelid AND att.attnum = key_ord.attnum
  WHERE c.contype = 'f'
    AND ns.nspname = 'public'
  GROUP BY c.conname, c.conrelid, c.conkey, rel.relname, ref.relname, rel.reltuples
)
SELECT table_name, columns, referenced_table, estimated_rows, conname
FROM fk
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_index i
  WHERE i.indrelid = fk.conrelid
    AND i.indisvalid
    AND (
      SELECT array_agg(k ORDER BY n)
      FROM unnest(i.indkey::int2[]) WITH ORDINALITY AS u(k,n)
      WHERE n <= array_length(fk.conkey, 1)
    ) = fk.conkey
)
ORDER BY estimated_rows DESC NULLS LAST, table_name, conname;
```

不一定每個小型參數表外鍵都必須立即建立索引，但若符合下列任一條件，預設應建立：

- 明細表或紀錄表。
- 資料量已超過數百筆，且會持續成長。
- API 常用該欄位查詢、join、排序或刪除關聯資料。
- 來源資料未來會從 MSSQL 大量匯入。

## 需要停止並確認的情況

遇到以下情況先停止，不繼續修改正式結構：

- MSSQL 來源欄位語意不明。
- PostgreSQL 現有欄位與 MSSQL 欄位一對多或多對一，且沒有明確轉換規則。
- 需要改名既有中文狀態值或參數值。
- 需要刪除欄位或資料表。
- 需要破壞性 migration。
- 匯入後筆數或關聯比對失敗。

## Commit 訊息建議

```text
Add <module> database migration

Completed changes:

- Add/alter PostgreSQL tables: ...
- Add MSSQL mapping document: ...
- Add/update import script: ...
- Add indexes/constraints: ...

MSSQL mapping:

- Source tables: ...
- Target tables: ...
- Unmatched data report: ...

Verification:

- PostgreSQL backup: ...
- Sample import row counts: ...
- API checks: ...
```
