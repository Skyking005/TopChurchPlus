# TopChurchPlus 文件維護矩陣

最後更新：2026-06-09

本文件定義每次任務完成後要檢查與更新的系統文件。目標是讓後續 `/new` 對話能用最少 Token 接手，不需要重新分析整個專案。

## 每次任務完成檢查表

任務結束前，至少檢查：

1. 本次是否新增/修改功能入口或模組？
2. 本次是否新增/修改 API endpoint？
3. 本次是否新增/修改 DB schema、seed、migration、索引？
4. 本次是否新增/修改跨系統關聯、檔案管理、權限、稽核、參數？
5. 本次是否新增/修改測試流程或 Demo 資料？
6. 本次是否踩到新的除錯雷點、編碼問題、部署問題？
7. 本次是否改變系統架構、部署方式或外部入口？

只要任一答案是「是」，就要更新下方對應文件。

## 文件責任矩陣

| 文件 | 何時更新 | 更新內容 |
| --- | --- | --- |
| `docs/HANDOFF.md` | 重要架構、部署資訊、近期重大變更、下一任務需要知道的背景 | 概要，不塞細節；保留交接重點 |
| `docs/NEW_THREAD_GUIDE.md` | `/new` 開場流程、Token 節省方式、文件讀取順序改變 | 新任務最小讀取規則 |
| `docs/MODULES.md` | 新增模組、模組狀態改變、主要檔案改變、注意事項改變 | feature key、主要檔案、狀態、注意事項 |
| `docs/API_CATALOG.md` | 新增/修改/刪除 API endpoint 或 API 行為 | endpoint、用途、權限、注意事項 |
| `docs/DATABASE_SCHEMA.md` | DB table、欄位、索引、關聯、資料語意改變 | 表、欄位意義、索引、關聯與注意事項 |
| `docs/TEST_MATRIX.md` | 新增功能流程、合法/非法案例、回歸測試方式 | 測試情境、預期結果、Demo 資料 |
| `docs/WORKFLOW.md` | 工作流程、工具、部署、常見除錯方式改變 | 流程與命令，不放業務細節 |
| `docs/TOPCHURCHPLUS_SKILL.md` | Codex 開發習慣、固定工具、任務完成規則改變 | Skill 摘要與注意事項 |
| `docs/SYSTEM_ARCHITECTURE.md` | 系統邊界、前端/API/DB/外部入口架構改變 | 架構關係與責任邊界 |
| `docs/core_platform_architecture.md` | 底層平台能力如權限、檔案、簽核、稽核、參數模式改變 | 共用底層設計 |
| `docs/DATABASE_MIGRATION_WORKFLOW.md` | DB migration 工作流程、MSSQL 對應策略改變 | DB 變更流程 |
| `docs/LEGACY_MSSQL_SYNC_WORKFLOW.md` | 舊系統同步策略、排程、資料來源改變 | 同步與轉換規則 |
| `docs/regression/*` | 完成一輪手動或 Playwright 回歸測試 | 測試日期、帳號、流程、結果 |

## 任務類型對應

| 任務類型 | 必查文件 |
| --- | --- |
| 新功能模組 | `MODULES`、`API_CATALOG`、`TEST_MATRIX`、必要時 `DATABASE_SCHEMA` |
| 權限調整 | `MODULES`、`DATABASE_SCHEMA`、`SYSTEM_ARCHITECTURE`、`TEST_MATRIX` |
| DB migration | `DATABASE_SCHEMA`、`DATABASE_MIGRATION_WORKFLOW`、`HANDOFF` |
| API 重構 | `API_CATALOG`、`MODULES`、`WORKFLOW`、`TEST_MATRIX` |
| 前端 UI/流程 | `MODULES`、`TEST_MATRIX` |
| 外部入口 / LIFF / 表單公開頁 | `SYSTEM_ARCHITECTURE`、`API_CATALOG`、`TEST_MATRIX` |
| 工具 / 部署流程 | `WORKFLOW`、`TOPCHURCHPLUS_SKILL`、`HANDOFF` |
| 除錯雷點 | `WORKFLOW`、`TOPCHURCHPLUS_SKILL`、必要時 `HANDOFF` |

## 已固定處理的常見雷點

- PowerShell Execution Policy 可能阻擋直接執行 `.ps1`。專案應優先使用 `.cmd` wrapper；沒有專用 wrapper 時使用 `tools\run-ps1.cmd <script.ps1>`。
- PowerShell 管線結果在單筆資料時可能被 unwrap，造成 `.Count` 判斷不穩。Smoke test 請用 `Get-StableCount` 或 `Measure-Object`。

## 每週文件更新排程內容

每週回顧時應執行：

1. 查看最近 7 天 Git log。
2. 查看本週新增/修改的 docs、database、api、html、gs、tests。
3. 檢查 `HANDOFF` 是否仍可代表目前系統狀態。
4. 檢查 `MODULES` 是否漏掉新功能或狀態。
5. 檢查 `API_CATALOG` 是否漏掉 endpoint。
6. 檢查 `DATABASE_SCHEMA` 是否漏掉新 table/index/relationship。
7. 檢查 `TEST_MATRIX` 是否漏掉新流程。
8. 將新踩到的雷點補入 `WORKFLOW` 或 `TOPCHURCHPLUS_SKILL`。
9. 如有文件更新，commit 並 push GitHub。

## 原則

- 文件是索引，不是完整程式碼複製。
- 文件要幫助下一個任務快速定位檔案與風險。
- 不把大量 commit log 貼進 `HANDOFF`，只保留會影響後續開發的摘要。
- 文件更新也要遵守 UTF-8 與 `apply_patch` 原則。
