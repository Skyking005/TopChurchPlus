# TopChurchPlus /new 對話啟動指南

最後更新：2026-06-09

本文件用於降低 `/new` 對話的 Token 消耗。新對話開始時，不要先掃描整個專案；先依任務類型讀最少文件，再用 `rg` 定位檔案。

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

- 不貼完整大檔案，優先用 `rg -n` 找函式、endpoint、feature key。
- 只讀相關章節，不重讀整份大型文件。
- API 回應用 `jq` 擷取重點欄位。
- 對同類程式碼用 `ast-grep` 找模式，不靠全文掃描。
- 文件更新要摘要化，不把完整變更歷史塞進 `HANDOFF.md`。
