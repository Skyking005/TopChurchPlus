# API Smoke Tests

這個資料夾放每次功能調整後可重複執行的 API smoke test。測試腳本使用 `.NET HttpClient` 與明確 UTF-8 JSON，避免 PowerShell 預設編碼造成中文 Demo 資料變成問號亂碼。

## 執行前設定

```powershell
$env:TOPCHURCHPLUS_API_BASE_URL = 'http://192.168.3.2:3000'
$env:TOPCHURCHPLUS_API_KEY = '<本機環境設定，不要提交到 Git>'
```

## 只做讀取測試

```powershell
.\tests\api\run-smoke.cmd
```

## 建立並保留 Demo 資料

```powershell
.\tests\api\run-smoke.cmd -WriteDemo
```

目前已包含：

- `smoke-health.ps1`：API health。
- `smoke-error-context.ps1`：錯誤回應需包含 `requestId`，方便對照 Docker log。
- `smoke-admin-supply.ps1`：行政物資選項、20 筆分頁清單、可選擇建立 Demo 物資與庫存異動。

新增模組時，請建立 `smoke-<module>.ps1`，並把它加入 `run-smoke.ps1`。
