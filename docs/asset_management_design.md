# 資產管理系統設計草案

## 原始資料分析

來源檔案：`D:\系統開發\專案管理系統\固定資產原始資料\活頁簿1.xlsx`

工作表：
- `總資產`：797 筆，14 欄。
- `存放位置`：152 筆，去重後 142 個位置。
- `參數`：設備類型、廠商、設備狀態。

資產主檔重點：
- `編號` 797 筆皆有值且唯一。
- 設備類型 7 類：音響設備 360、影視設備 165、燈光設備 154、電腦設備 85、其他設備 17、網路設備 11、錄音設備 5。
- 存放會堂 6 個：北大第二會堂 356、台北幸福會堂 211、桃園會堂 194、北大第一會堂 22、飛航福音中心 13、卓越大學教會 1。
- 購入價有 583 筆，合計 42,151,383。
- 購入日期有 417 筆。
- 狀態目前主要是使用中 773、已停用 23，另有 1 筆空白狀態，匯入時預設為 `使用中`。
- 序號只有 29 筆，且有重複值，因此不適合設唯一限制。

資料清理提醒：
- `存放位置` 主檔有重複位置，匯入檔已去重。
- 資產資料中有 2 個位置不在原本位置表：`台北幸福會堂 / B1 主會堂 / 右區天花板`、`台北幸福會堂 / B1 主會堂 / 左區天花板`，匯入檔已補入。
- 原位置表有 `台北幸福` 與 `台北幸福會堂` 兩種命名，建議正式上線前確認是否要統一。

## 系統功能規劃

第一階段：
- 資產清單：10 筆分頁、關鍵字搜尋、會堂/位置/類型/狀態篩選。
- 資產詳細資料：基本資料、購置資料、存放位置、狀態、備註。
- 新增/編輯資產。
- 位置管理：會堂、主位置、子位置，並預留 `可借用空間` 設定。
- 狀態異動：使用中、維修中、已報廢、已請購、已停用。
- 位置異動歷程。

本次前台實作：
- 功能選單新增 `資產管理系統`。
- 資產管理提供清單、搜尋、篩選、詳細、新增、編輯。
- 系統管理 Modal 取代原參數管理，內含 `參數管理` 與 `位置管理`。
- `位置管理` 控管 `asset_locations`，前台命名為 `locations`，作為未來場地借用與資產存放的共用位置主檔。
- `參數管理` 控管 `params`，並新增資產參數類型：`assetTypes`、`assetVendors`、`assetStatuses`。

權限規劃：
- 資產瀏覽：管理員、超級管理者、全職同工、技術同工。
- 資產新增/編輯：管理員、超級管理者、技術同工。
- 系統管理：僅超級管理者。
- locations 修改：僅超級管理者；若位置已有資產使用，不允許刪除。

第二階段：
- 維修紀錄。
- 盤點功能：盤點批次、盤點明細、盤點差異。
- QR Code / 條碼貼紙。
- 資產匯出 DOC 或清冊。

與場地借用系統整合：
- `asset_locations` 先作為共用位置主檔。
- 未來場地借用系統可引用同一張位置表，並用 `is_bookable` 決定是否可被預約。
- 資產可以掛在某個可借用場地底下，借用場地時可顯示該場地設備清單。

與財務/請款系統整合：
- 請款單結案或付款完成後，若請款明細被標記為「建立資產」，系統依數量產生資產主檔。
- `assets.source_purchase_id`、`assets.source_payment_id`、`assets.source_payment_item_id` 保留來源追蹤。
- `asset_acquisition_links` 可記錄一筆請款明細拆成多筆資產的關係。
- 若一筆請款明細數量為 5，應建立 5 筆資產，而不是只建立一筆數量 5 的資產，方便日後維修、移動、報廢。

## 建議資料表

已建立 SQL 草案：
- `database/assets_schema.sql`
- `database/assets_import.sql`

主要表：
- `asset_locations`：位置主檔，可支援未來場地借用。
- `assets`：資產主檔。
- `asset_location_history`：位置異動歷程。
- `asset_status_history`：狀態異動歷程。
- `asset_maintenance_records`：維修紀錄。
- `asset_acquisition_links`：財務請款與資產關聯。

匯入檔：
- `database/asset_import/asset_locations.csv`
- `database/asset_import/asset_params.csv`
- `database/asset_import/assets.csv`

## 匯入操作草案

在 NAS 專案目錄執行，先備份：

```bash
cd /volume1/docker/project-api
mkdir -p backups
sudo docker exec TopProject-postgres-1 pg_dump -U tcnschurch -d postgres > backups/before_assets_$(date +%Y%m%d_%H%M%S).sql
```

建立表：

```bash
sudo docker exec -i TopProject-postgres-1 psql -U tcnschurch -d postgres < database/assets_schema.sql
```

匯入資料：

```bash
sudo docker exec TopProject-postgres-1 mkdir -p /tmp/asset_import
sudo docker cp database/asset_import/asset_locations.csv TopProject-postgres-1:/tmp/asset_import/asset_locations.csv
sudo docker cp database/asset_import/asset_params.csv TopProject-postgres-1:/tmp/asset_import/asset_params.csv
sudo docker cp database/asset_import/assets.csv TopProject-postgres-1:/tmp/asset_import/assets.csv
sudo docker exec -i TopProject-postgres-1 psql -U tcnschurch -d postgres < database/assets_import.sql
```

匯入完成後可檢查筆數：

```bash
sudo docker exec -i TopProject-postgres-1 psql -U tcnschurch -d postgres -c "select count(*) from assets;"
sudo docker exec -i TopProject-postgres-1 psql -U tcnschurch -d postgres -c "select count(*) from asset_locations;"
```
