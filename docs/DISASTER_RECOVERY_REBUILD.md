# TopChurchPlus 災難復原與重建方案

最後更新：2026-06-09

## 目的

本文件用來處理下列情境：

- 本機開發電腦故障或遺失。
- NAS API 目錄毀損。
- Docker container 或 PostgreSQL 無法啟動。
- Google Apps Script 專案需要重新推送。
- 文件、部署腳本或環境設定需要重新確認。

核心原則：

- GitHub 是程式碼與文件的主要還原來源。
- NAS PostgreSQL 備份是資料還原來源。
- `.env`、API key、Line token、Google token、SSH private key 不進 Git，需另行安全保存。
- 每月執行一次 rebuild readiness check，確認真的需要重建時不會臨時找不到工具或文件。

## 每月維護指令

在本機專案目錄執行：

```powershell
cd D:\系統開發\topchurchplus
.\tools\check-rebuild-readiness.cmd -RunSmoke
```

這個檢查只讀取系統狀態，不會修改資料庫或部署 Google Apps Script。檢查項目包含：

- GitHub remote 是否指向 `Skyking005/TopChurchPlus`。
- 本機必要文件、部署腳本、Apps Script 設定是否存在。
- NAS share 與備份資料夾是否可讀。
- SSH deploy key 是否存在。
- NAS API `/health` 是否正常。
- 開發 CLI 是否可用。
- API smoke test 是否通過。

## 必備備份項目

| 項目 | 保存位置 | 備註 |
| --- | --- | --- |
| 程式碼與文件 | GitHub `Skyking005/TopChurchPlus` | 每次任務完成需 commit + push |
| NAS API 目錄 | `/volume1/docker/project-api` | `deploy-api.cmd` 會同步 `api/src`、`api/public`、`docs`、`AGENTS.md` |
| PostgreSQL 備份 | `/volume1/docker/project-api/backups/` | DB migration 或同步前必備 |
| NAS API `.env` | `/volume1/docker/project-api/.env` | 不進 Git，需安全備份 |
| 本機 API `.env` | `D:\系統開發\topchurchplus\api\.env` | 不進 Git，重建本機測試環境需要 |
| Apps Script `.clasp.json` | GitHub | 只含 scriptId，不含密碼 |
| Google clasp 登入狀態 | 使用者本機 profile | 新機器需重新 `clasp login` |
| SSH deploy key | `%USERPROFILE%\.ssh\project_api_deploy` | 不進 Git，需另存安全位置 |
| 測試資料 | `D:\系統開發\topchurchplus\測試資料` | 已忽略 Git，必要時另備份 |

## 本機開發電腦重建

1. 安裝 GitHub Desktop 或 Git。
2. 安裝 Node.js LTS。
3. Clone 專案：

```powershell
git clone https://github.com/Skyking005/TopChurchPlus.git D:\系統開發\topchurchplus
cd D:\系統開發\topchurchplus
```

4. 還原本機私密設定：

```text
D:\系統開發\topchurchplus\api\.env
%USERPROFILE%\.ssh\project_api_deploy
```

5. 安裝與檢查工具：

```powershell
npm install
.\tools\setup-dev-env.cmd
.\tools\check-dev-cli.cmd
```

6. 登入 clasp：

```powershell
clasp.cmd login
clasp.cmd status
```

若 PowerShell 擋 `.ps1`，使用專案 wrapper，不直接執行 `.ps1`：

```powershell
.\tools\run-ps1.cmd .\tests\api\smoke-health.ps1
```

7. 執行 rebuild readiness check：

```powershell
.\tools\check-rebuild-readiness.cmd -RunSmoke
```

## NAS API 重建

正式 NAS 目前使用：

```text
NAS path: /volume1/docker/project-api
SMB path: \\192.168.3.2\docker\project-api
Docker container/service: project-api
API port: 3000
```

若 NAS API 目錄仍存在但程式損毀，優先從本機重新部署：

```powershell
cd D:\系統開發\topchurchplus
.\deploy-api.cmd
Invoke-RestMethod -Uri 'http://192.168.3.2:3000/health'
```

若 NAS API 目錄需要從零建立：

1. 在 NAS 建立 `/volume1/docker/project-api`。
2. 建立或還原 `/volume1/docker/project-api/.env`。
3. 確認 Docker / Container Manager 可用。
4. 從本機執行：

```powershell
.\deploy-api.cmd
```

5. 驗證：

```powershell
Invoke-RestMethod -Uri 'http://192.168.3.2:3000/health'
.\tests\api\run-smoke.cmd
```

## PostgreSQL 還原

先找到最新可用備份：

```bash
cd /volume1/docker/project-api
ls -lh backups
```

還原前請再次備份目前狀態，避免覆蓋後無法回頭：

```bash
cd /volume1/docker/project-api
mkdir -p backups
sudo /usr/local/bin/docker exec -e PGPASSWORD='<password>' TopProject-postgres-1 pg_dump -U tcnschurch -d postgres > backups/topchurchplus_before_restore_$(date +%Y%m%d_%H%M%S).sql
```

還原指定備份：

```bash
sudo /usr/local/bin/docker exec -i -e PGPASSWORD='<password>' TopProject-postgres-1 psql -U tcnschurch -d postgres -v ON_ERROR_STOP=1 < backups/<backup_file>.sql
```

還原後執行：

```powershell
.\tests\api\run-smoke.cmd
```

注意：若備份是完整 `pg_dump`，還原方式需依備份格式調整。正式還原前先在測試資料庫演練一次。

## Google Apps Script 重建

若 Apps Script 端需要重新推送：

```powershell
cd D:\系統開發\topchurchplus
clasp.cmd login
clasp.cmd status
.\push-to-google.cmd
```

若要維持固定網址，應更新既有 deployment，不要建立新的 Web App 入口。正式 domain / DNS / forwarding 不在本流程內修改。

## 私密資料保管清單

這些資料不進 Git，但重建時一定需要：

- NAS API `.env`。
- 本機 API `.env`。
- PostgreSQL 使用者、密碼與 container 名稱。
- Apps Script 專案擁有者 Google 帳號登入權限。
- clasp 登入或可重新登入的 Google 帳號。
- SSH private key `%USERPROFILE%\.ssh\project_api_deploy`。
- LINE / LIFF / external service token。

建議每月由超級管理員確認這份清單仍可取得。

## 災難復原演練標準

每月維護至少完成：

1. `.\tools\check-rebuild-readiness.cmd -RunSmoke` 通過。
2. 確認 GitHub `main` 是最新。
3. 確認 NAS `/volume1/docker/project-api/backups/` 最近 30 天內有可用 DB 備份。
4. 確認 `docs/HANDOFF.md`、`docs/SYSTEM_ARCHITECTURE.md`、`docs/API_CATALOG.md`、`docs/DATABASE_SCHEMA.md` 已更新。
5. 確認 `.env`、SSH key、Google/clasp 權限、LINE token 有安全保存，不只存在單一電腦。

若任一項失敗，建立系統開發管理 issue，類型 `maintain`、優先度依風險設定。
