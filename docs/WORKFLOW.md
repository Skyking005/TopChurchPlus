# TopChurchPlus Development Workflow

## 原則

- 專案文字檔一律以 UTF-8 處理。
- 修改中文內容前，先確認相關區塊沒有亂碼。
- 手動修改優先使用 `apply_patch`，避免批次重寫中文檔。
- 每次任務只改與本次需求相關的檔案。
- 資料庫結構調整需先提出欄位、用途、索引與 MSSQL 對應，再確認後執行。

## 常用工具

先啟用 PowerShell UTF-8：

```powershell
. .\tools\setup-utf8.ps1
```

檢查 API 與 Apps Script 語法：

```powershell
.\tools\check-scripts.cmd
```

檢查 API 語法與 health：

```powershell
$env:TOPCHURCHPLUS_API_BASE_URL = 'http://192.168.3.2:3000'
$env:TOPCHURCHPLUS_API_KEY = '<不要提交到 Git 的 API Key>'
.\tools\check-api.cmd
```

一鍵檢查並部署 NAS API 與 Google Apps Script：

```powershell
.\tools\deploy-all.cmd
```

如果只想跑部署、不跑 health：

```powershell
.\tools\deploy-all.cmd -SkipHealth
```

## 建議任務流程

1. 讀取 `AGENTS.md`。
2. 檢查目前分支與工作區狀態。
3. 修改前確認相關中文區塊可讀。
4. 小範圍修改。
5. 執行最小驗證。
6. 需要時執行 `.\tools\deploy-all.cmd`。
7. Commit 訊息寫清楚本次完成內容、驗證結果與部署資訊。
8. Push 到 GitHub。

## Git 注意事項

如果 PowerShell 找不到 `git`，請重新開啟終端機，或確認使用者 PATH 包含 GitHub Desktop 的 git：

```text
C:\Users\資訊部\AppData\Local\GitHubDesktop\app-3.5.2\resources\app\git\cmd
```
