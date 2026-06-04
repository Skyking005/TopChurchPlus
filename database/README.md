# Postgres Migration

## 1. 建立資料庫與帳號

```sql
CREATE USER project_app WITH PASSWORD 'change_this_password';
CREATE DATABASE project_management OWNER project_app;
GRANT ALL PRIVILEGES ON DATABASE project_management TO project_app;
```

連到 `project_management` 後執行：

```bash
psql -U project_app -d project_management -f database/schema.sql
```

## 2. 匯出 Google Sheets 現有資料

把 `database/export_from_apps_script.gs` 的內容暫時貼到 Apps Script 專案，執行：

```js
exportPostgresSeedJsonToDrive()
```

它會在 Google Drive 產生一個 JSON 檔，下載後放到 NAS/API 專案資料夾。

## 3. 匯入 Postgres

```bash
cd api
cp .env.example .env
npm install
npm run import:json -- ./project-management-export.json
```

匯入腳本會先清空相關資料表，再依 JSON 重建資料。
