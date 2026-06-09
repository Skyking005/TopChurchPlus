# Local AI Preflight Workflow

本文件說明 TopChurchPlus 如何使用本機 Ollama 做任務前置分析。因本機模型效能與摘要品質有限，大型任務預設優先使用 Remote AI preflight；Local AI 主要作為快速小摘要、關鍵字初篩、低風險搜尋整理，或 Remote AI 不可用時的備援。

## 目前設定

- 本機 AI 工具：Ollama
- 預設快篩模型：`qwen3:0.6b`
- 進階前置分析備用模型：`qwen3:1.7b`
- 深入分析備用模型：`qwen3:4b`
- Qwen3 API 呼叫必須設定 `think = false`，否則可能只產生 `thinking` 欄位，正式 `response` 會是空字串。
- Ollama 執行檔：`%LOCALAPPDATA%\Programs\Ollama\ollama.exe`
- 模型目錄：`D:\ollama-models`
- 專案工具入口：`tools\local-ai-preflight.cmd`
- 產出目錄：`tmp\local-ai\`

重要：不要使用預設的 `C:\Users\<使用者>\.ollama` 模型目錄。本機 Windows 使用者路徑含中文時，Ollama 的 llama-server 曾發生路徑 mojibake，導致模型無法載入。因此本專案固定使用 ASCII 路徑 `D:\ollama-models`。

## AI Context Snapshot

內部 RTX / Local AI 主機不要直接讀正式 repo，請讀乾淨快照：

```text
D:\系統開發\topchurchplus-ai-context
```

產生快照：

```powershell
.\tools\build-ai-context.cmd
```

快照規則見 `docs/AI_CONTEXT_WORKFLOW.md`。此快照會排除 `.env`、secret、備份、測試資料、原始資料與大型依賴，適合提供給 RAG、Open WebUI、AnythingLLM、Continue 或其他 Local AI 工具做唯讀索引。

## Local AI 負責的工作

Local AI 只做前置分析，不直接修改系統：

- 依任務描述萃取關鍵字。
- 讀取最小核心文件摘要。
- 用 `rg` 找可能相關檔案。
- 產生建議 Codex 先讀的文件與檔案。
- 列出可能風險與需要人工確認的地方。

Local AI 不負責：

- 修改 `.gs`、`.html`、`.js`、`.json`、`.sql`、`.md`。
- 直接執行資料庫 schema migration。
- 讀取或推測 `.env`、secret、token、password、API key。
- 部署 NAS API 或 Google Apps Script。
- 取代 Codex 的實際程式碼 review、測試與部署判斷。

## 使用方式

在專案根目錄執行：

```powershell
.\tools\local-ai-preflight.cmd -Task "我要修改財務系統請款單編輯功能"
```

使用 Tailscale 遠端 Ollama 主機：

```powershell
.\tools\local-ai-preflight.cmd `
  -Task "我要修改財務系統請款單編輯功能" `
  -OllamaHost "http://<tailscale-ip-or-magicdns>:11436" `
  -Model "qwen2.5-coder:14b"
```

也可以用環境變數固定遠端 host：

```powershell
[Environment]::SetEnvironmentVariable('TOPCHURCHPLUS_OLLAMA_HOST', 'http://<tailscale-ip-or-magicdns>:11436', 'User')
```

遠端 AI client 端請打 proxy port `11436`，不要直接打原生 Ollama `11434`，否則遠端 AI proxy log 不會記錄本次分析。

遠端主機與 GitHub 文件溝通流程見 `docs/REMOTE_LOCAL_AI_GITHUB_WORKFLOW.md`。遠端 AI 防雷規則見 `docs/REMOTE_AI_GUARDRAILS.md`。

若只想產生搜尋結果，不呼叫 Ollama：

```powershell
.\tools\local-ai-preflight.cmd -Task "我要修改財務系統請款單編輯功能" -NoAi
```

輸出檔案：

- `tmp\local-ai\task_context.md`：給 Codex 優先讀取的任務前置分析。
- `tmp\local-ai\task_context.raw.md`：未經 Local AI 整理的原始文件與搜尋摘要。
- `tmp\local-ai\relevant_files.json`：`rg` 找到的可能相關檔案。
- `tmp\local-ai\risks.md`：風險摘要或 fallback 訊息。

`tmp/` 已在 `.gitignore` 中，這些輸出不會進入 Git。

## 建議的新任務流程

1. 先依任務大小決定是否執行 preflight。

   優先使用 Remote AI preflight：

   - 跨模組功能或大範圍 UI 調整。
   - 資料庫設計、migration、索引、資料搬移。
   - 權限架構、系統框架、共用服務、檔案管理、稽核紀錄。
   - 全系統測試、效能分析、文件盤點、舊系統轉移分析。

   Local AI 適用：

   - Remote AI 不可用時的備援。
   - 小型文件摘要、關鍵字初篩、低風險搜尋整理。
   - 使用 `-NoAi` 只產生搜尋摘要。

   可略過 preflight：

   - 單一檔案小修、明確錯誤訊息、小範圍文字或樣式調整。
   - 使用者已指定完整檔案、函式與預期修改。

2. 執行 Local AI preflight：

   ```powershell
   .\tools\local-ai-preflight.cmd -Task "<本次任務描述>"
   ```

3. Codex 優先讀：

   ```text
   tmp/local-ai/task_context.md
   docs/NEW_THREAD_GUIDE.md
   docs/HANDOFF.md
   ```

4. 再依 Local AI 建議讀相關文件，例如：

   - `docs/MODULES.md`
   - `docs/API_CATALOG.md`
   - `docs/DATABASE_SCHEMA.md`
   - `docs/TEST_MATRIX.md`

5. Codex 使用 `rg` / `ast-grep` 精準定位檔案。
6. Codex 小範圍修改、測試、部署、更新文件、commit、push。
7. Commit body 記錄是否有使用 Local/Remote AI，以及 Remote compute 的 Token 節省估算。

## 檢查 Ollama 狀態

```powershell
$env:OLLAMA_MODELS = 'D:\ollama-models'
ollama list
ollama run qwen3:0.6b "請用繁體中文回覆：TopChurchPlus Local AI ready"
```

如果 `ollama` 不在 PATH，可直接使用：

```powershell
$ollama = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"
& $ollama list
```

## 常見問題

### 模型載入失敗並出現中文路徑亂碼

症狀可能包含：

```text
failed to load model from C:\Users\���T��\.ollama\models\...
```

處理方式：

```powershell
New-Item -ItemType Directory -Force -Path D:\ollama-models
[Environment]::SetEnvironmentVariable('OLLAMA_MODELS', 'D:\ollama-models', 'User')
$env:OLLAMA_MODELS = 'D:\ollama-models'
Get-Process *ollama* -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Process -FilePath "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" -ArgumentList 'serve' -WindowStyle Hidden
ollama pull qwen3:0.6b
```

### Local AI 產出的建議不準

Local AI 的結果只能當成「前置搜尋摘要」。如果與實際程式碼衝突，以原始碼、資料庫 schema、測試結果為準。

### 是否可以把所有分析都交給 Local AI

不建議。Local AI 適合做低風險、低權限、可重做的小型前置工作。大型任務優先交給 Remote AI preflight；實際修改、部署、資料庫變更、權限與資安判斷仍由 Codex 按專案流程處理。
