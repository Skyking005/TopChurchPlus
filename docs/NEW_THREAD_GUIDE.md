# TopChurchPlus /new 對話啟動指南

最後更新：2026-06-09

本文件用於降低 `/new` 對話的 Token 消耗。新對話開始時，不要先掃描整個專案；先依任務類型讀最少文件，再用 `rg` 定位檔案。

## AI 前置分析

新任務先依任務大小決定是否執行 preflight。大任務優先使用 Remote AI，小修可略過。

Local AI / RAG 工具應優先讀 `D:\系統開發\topchurchplus-ai-context` 這份安全快照，不直接讀正式 repo。快照產生方式見 `docs/AI_CONTEXT_WORKFLOW.md`。

Local AI 備援指令：

```powershell
.\tools\local-ai-preflight.cmd -Task "<本次任務描述>"
```

若產生 `tmp/local-ai/task_context.md`，Codex 需優先讀取。Remote/Local AI 只做前置分析，不可直接修改程式碼、資料庫、secret 或部署設定。詳細規則見 `docs/REMOTE_LOCAL_AI_GITHUB_WORKFLOW.md`、`docs/REMOTE_AI_GUARDRAILS.md`、`docs/LOCAL_AI_WORKFLOW.md`。

建議優先執行 Remote AI preflight 的任務：

- 跨模組功能、系統框架、權限架構、資料庫設計或 migration。
- 需要分析舊 MSSQL / Line Bot / Google Apps Script / NAS API 之間關係的任務。
- 全系統檢查、效能檢查、測試計畫、文件盤點、重構規劃。

可略過 preflight 的任務：

- 單一檔案小修、明確錯誤修正、小範圍 UI 或文字調整。
- 使用者已提供精準檔案、函式與修正方向。

Local AI 適用情境：

- Remote AI 不可用時的備援。
- 小型文件摘要、關鍵字初篩、低風險搜尋整理。
- 使用 `-NoAi` 只產生搜尋摘要。

## 最小讀取順序

每次新對話先讀：

1. `AGENTS.md`
2. `docs/NEW_THREAD_GUIDE.md`
3. `docs/HANDOFF.md` 的「目前定位」「必守規則」「系統框架現況」
4. 依任務類型讀下方對應文件

## 任務對應文件

| 任務類型 | 優先讀取文件 | 再讀取 |
| --- | --- | --- |
| 新模組 / 功能入口 | `docs/MODULES.md`、`docs/API_CATALOG.md` | `docs/SYSTEM_ARCHITECTURE.md`、`docs/WORKFLOW.md` |
| API 修改 | `docs/API_CATALOG.md`、`docs/MODULES.md` | 相關 `api/src/modules/<module>/routes.js` |
| 前端修改 | `docs/MODULES.md`、`docs/TEST_MATRIX.md` | 相關 `<Module>.html`、`Script_<Module>.html` |
| DB schema / migration | `docs/DATABASE_SCHEMA.md`、`docs/DATABASE_MIGRATION_WORKFLOW.md` | `database/schema.sql`、相關 migration |
| MSSQL 同步 | `docs/LEGACY_MSSQL_SYNC_WORKFLOW.md` | `database/import_*_from_sqlserver.ps1` |
| 測試 / 回歸 | `docs/TEST_MATRIX.md` | `tests/api/smoke-*.ps1`、`docs/regression/*` |
| 部署 / 工具 / 工作流程 | `docs/WORKFLOW.md`、`docs/TOPCHURCHPLUS_SKILL.md` | `tools/*` |
| 系統架構討論 | `docs/SYSTEM_ARCHITECTURE.md`、`docs/core_platform_architecture.md` | `docs/DATABASE_SCHEMA.md` |
| 文件更新 / 交接 | `docs/DOCUMENTATION_MAINTENANCE.md`、`docs/HANDOFF.md` | `docs/MODULES.md`、`docs/API_CATALOG.md` |

## `/new` 開場建議文字

```text
請先讀 AGENTS.md、docs/NEW_THREAD_GUIDE.md、docs/HANDOFF.md。
本次任務是：<任務描述>
請依 NEW_THREAD_GUIDE 只讀相關文件與檔案，避免掃描整個專案。
完成後請依 DOCUMENTATION_MAINTENANCE 更新相關文件、測試、部署並提交 GitHub。
```

## 任務完成前必做

每次任務完成前都要依 `docs/DOCUMENTATION_MAINTENANCE.md` 檢查是否需要更新：

- `docs/HANDOFF.md`
- `docs/MODULES.md`
- `docs/API_CATALOG.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/TEST_MATRIX.md`
- `docs/WORKFLOW.md`
- `docs/TOPCHURCHPLUS_SKILL.md`
- 相關設計文件或 regression 文件

若本次任務沒有任何文件需要更新，最終回覆需明確說明原因。

## Token 節省原則

- 大任務先讀 Remote AI preflight 摘要，再讀原始檔。
- 不貼完整大檔案，優先用 `rg -n` 找函式、endpoint、feature key。
- 只讀相關章節，不重讀整份大型文件。
- API 回應用 `jq` 擷取重點欄位。
- 對同類程式碼用 `ast-grep` 找模式，不靠全文掃描。
- 文件更新要摘要化，不把完整變更歷史塞進 `HANDOFF.md`。
