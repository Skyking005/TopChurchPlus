# Remote Local AI And GitHub Workflow

本文件說明如何使用另一台透過 Tailscale 連線的 AI 運算主機，搭配 GitHub 作為文件溝通與任務交接中心，降低 Codex Token 消耗並提升大型任務前置分析效率。

## 目標

- 將較重的模型推理交給遠端 AI 主機。
- Codex 保留實際修改、測試、部署、資料庫與資安判斷。
- GitHub 作為雙方共用的系統文件、Issue、handoff 與版本紀錄來源。
- 避免 AI 主機直接持有 production secret 或直接操作資料庫。

## 建議分工

### 遠端 AI 主機負責

- 讀 GitHub 上的系統文件。
- 分析任務描述與相關文件。
- 產出前置分析：
  - 建議先讀文件
  - 可能相關檔案
  - 風險與注意事項
  - 建議 Codex 下一步
- 可協助做大型文件摘要、API catalog 對照、資料表規劃初稿。

### Codex 負責

- 根據遠端 AI 摘要讀取實際檔案。
- 確認是否有 mojibake。
- 小範圍修改程式碼與文件。
- 執行測試、部署 NAS API / Apps Script。
- 更新文件、commit、push GitHub。

### 不建議交給遠端 AI 主機

- 寫入 production database。
- 持有 `.env`、API key、LINE token、DB password。
- 自動 push 到 `main`。
- 直接部署 NAS API 或 Google Apps Script。

## 遠端 Ollama 設定

遠端主機需讓 Ollama API 只在 Tailscale 網路可連線。不要直接對外開放 `11434`。

## 何時使用 Remote AI

Remote AI 是 Local AI preflight 的升級方案，不是每次任務都要用。

建議使用：

- 本地模型摘要不完整，或任務需要較大上下文。
- 跨模組架構分析、舊系統搬移、資料庫設計、全系統效能或風險盤點。
- 需要先整理大量文件或程式碼關聯，但還不到實際修改階段。

不建議使用：

- 單一檔案小修、明確錯誤訊息、簡單 UI 或文字調整。
- 需要 secret、production DB、部署權限或瀏覽器登入狀態的工作。

使用 Remote AI 後，Codex commit body 需記錄：

```text
Remote compute: 已使用（任務與模型）
Remote token saving: 估算節省值與依據
```

遠端主機可設定：

```powershell
$env:OLLAMA_HOST = '0.0.0.0:11434'
ollama serve
```

或依該主機作業系統使用服務方式啟動。

已知模型：

- `qwen2.5-coder:14b`：適合程式碼、架構、重構、diff review。
- `qwen3.5:4b`：適合較快的中文摘要、文件整理、任務前置分析。

## TopChurchPlus 使用遠端模型

一次性測試：

```powershell
.\tools\local-ai-preflight.cmd `
  -Task "分析財務系統請款單編輯功能" `
  -OllamaHost "http://<tailscale-ip-or-magicdns>:11434" `
  -Model "qwen2.5-coder:14b"
```

若要固定使用遠端主機：

```powershell
[Environment]::SetEnvironmentVariable('TOPCHURCHPLUS_OLLAMA_HOST', 'http://<tailscale-ip-or-magicdns>:11434', 'User')
$env:TOPCHURCHPLUS_OLLAMA_HOST = 'http://<tailscale-ip-or-magicdns>:11434'
```

之後可直接執行：

```powershell
.\tools\local-ai-preflight.cmd -Task "分析牧養系統 CRUD 風險" -Model "qwen2.5-coder:14b"
```

輸出仍會產生在：

```text
tmp/local-ai/task_context.md
tmp/local-ai/relevant_files.json
tmp/local-ai/risks.md
```

## GitHub 文件溝通流程

建議使用 GitHub 作為「事實來源」：

1. Codex 完成任務後更新核心文件：
   - `docs/HANDOFF.md`
   - `docs/REMOTE_AI_GUARDRAILS.md`
   - `docs/MODULES.md`
   - `docs/API_CATALOG.md`
   - `docs/DATABASE_SCHEMA.md`
   - `docs/TEST_MATRIX.md`
   - `docs/WORKFLOW.md`
   - `docs/LOCAL_AI_WORKFLOW.md`
   - `docs/REMOTE_LOCAL_AI_GITHUB_WORKFLOW.md`
2. Codex commit 並 push 到 GitHub。
3. 遠端 AI 主機定期 pull GitHub。
4. 遠端 AI 只讀 repo 文件與指定檔案，產生分析摘要。
5. Codex 讀取摘要後再執行實際修改。

## 建議的遠端 AI 輸出格式

遠端 AI 開始前必須先讀 `docs/REMOTE_AI_GUARDRAILS.md`。若發現 mojibake、secret、production DB、部署或 branch 異常，依該文件停止並回報。

遠端 AI 的輸出建議固定為 Markdown：

```markdown
# Remote AI Preflight

## 任務摘要

## 建議先讀文件

## 可能相關檔案

## 風險與注意事項

## 建議 Codex 下一步

## 不確定或需要人工確認
```

## 可選：用 GitHub Issue 作任務入口

若使用 GitHub Issue 管理需求，建議 Issue 欄位保持簡潔：

- 類型：`feature`、`issue`、`maintain`
- 狀態：`提案`、`取消`、`完成`
- 優先度：`低`、`中`、`高`
- 描述

遠端 AI 可以根據 Issue 描述產出前置分析，但不要直接改程式。Codex 依分析結果建立實作 commit。

## 安全原則

- Tailscale ACL 建議只允許開發電腦連遠端 AI 主機的 `11434`。
- 遠端 AI 主機不放 `.env`、DB password、API key。
- 遠端 AI 主機若需要 repo，使用只讀方式較安全。
- 若使用 GitHub token，使用 read-only token；不要給 production deploy 權限。
- 所有正式變更仍由 Codex 在本機依 TopChurchPlus workflow 執行。

## 測試遠端連線

```powershell
Invoke-RestMethod -Uri "http://<tailscale-ip-or-magicdns>:11434/api/tags" -Method GET
```

測試模型：

```powershell
$body = @{
  model = 'qwen2.5-coder:14b'
  stream = $false
  prompt = '請用繁體中文回覆：TopChurchPlus remote AI ready'
} | ConvertTo-Json -Depth 6

Invoke-RestMethod `
  -Uri "http://<tailscale-ip-or-magicdns>:11434/api/generate" `
  -Method POST `
  -ContentType 'application/json; charset=utf-8' `
  -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
```

## 建議模型選擇

- 快速文件摘要：`qwen3.5:4b`
- 程式碼修改前分析：`qwen2.5-coder:14b`
- 架構重構提案：`qwen2.5-coder:14b`
- Issue 初步分類：`qwen3.5:4b`

若遠端主機效能足夠，TopChurchPlus preflight 建議預設使用 `qwen2.5-coder:14b`。
