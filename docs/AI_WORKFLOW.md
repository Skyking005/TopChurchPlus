# TopChurchPlus AI Workflow

最後更新：2026-06-12

## 目的

本文件定義 Codex、Local AI、Remote AI 在 TopChurchPlus 專案中的分工。目標是降低 token 消耗，同時避免 AI 直接接觸正式 secret、正式資料或部署權限。

## 角色分工

### Codex

可執行：

- 讀取正式 repo。
- 修改程式或文件。
- 執行測試。
- 在使用者要求或任務需要時 commit/push。
- 經確認後部署 NAS API / Apps Script。

必須負責：

- 最終判斷。
- 保護使用者既有變更。
- 驗證與回報。

### Local AI

用途：

- 讀取安全 AI context snapshot。
- 摘要大型檔案。
- 做前期風險盤點。
- 產生候選方案。

限制：

- 不讀正式 repo。
- 不讀 `.env`、secret、DB dump。
- 不直接改檔。
- 不部署、不 push、不改 DB。

### Remote AI

用途：

- preflight。
- 額外模型分析。
- 大型上下文摘要。

限制：

- 不直接操作正式系統。
- 不取得 production credentials。
- 不接觸 NAS 寫入、DB 寫入、GitHub push。

## Context Snapshot

建立：

```powershell
tools\build-ai-context.cmd
```

檢查 freshness：

```powershell
tools\check-ai-context-freshness.cmd
```

預設 snapshot 位置：

```text
D:\系統開發\topchurchplus-ai-context
```

可用環境變數覆寫：

```text
TOPCHURCHPLUS_AI_CONTEXT_DIR
```

結果語意：

- `[PASS]` exit `0`：snapshot 不早於 Git HEAD。
- `[WARN]` exit `2`：snapshot 比 Git HEAD 舊，只能作參考。
- `[FAIL]` exit `1`：snapshot 缺失或不可讀。

## `/new` 最小讀取順序

Codex 新對話先讀：

1. `AGENTS.md`
2. `docs/HANDOFF.md`
3. `docs/PROJECT_OVERVIEW.md`
4. `docs/CURRENT_ARCHITECTURE.md`
5. `docs/ACTIVE_ROADMAP.md`

再依任務讀：

- DB：`docs/DATABASE_SCHEMA.md`
- API：`docs/API_CATALOG.md`
- 模組：`docs/MODULES.md`
- LINE/LIFF：`docs/CURRENT_ARCHITECTURE.md`、`docs/KNOWN_ISSUES.md`
- AI context：`docs/LOCAL_AI_TASK_GUIDE.md`、`docs/LOCAL_AI_WORKFLOW.md`

## 禁止事項

- 不把 `.env`、API key、LINE secret、DB credentials 放進 AI context。
- 不讓 Local/Remote AI 直接執行部署。
- 不讓 Local/Remote AI 直接寫 repo。
- 不讓 AI 產生 SQL 後未審核就執行。
- 不讓 AI 跨越 Identity Boundary v2，尤其不可用後台 role 授權會友外部入口。

## Preflight 輸出格式

Local/Remote AI 給 Codex 的輸出應包含：

- 本次任務理解。
- 相關檔案清單。
- 可能影響的模組。
- 風險與資料邊界。
- 建議驗證方式。
- 不應修改的檔案或資料。

Codex 只能把此輸出當建議，仍需讀正式 repo 確認。
