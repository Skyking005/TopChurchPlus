# TopChurchPlus Decision Log

最後更新：2026-06-12

本文件記錄目前仍有效的架構決策。歷史細節可參考根目錄 `DECISION_LOG.md`。

## D-001 保留 Google Apps Script 作為主要前端

原因：

- 現有系統已大量使用 Apps Script。
- 使用者熟悉目前操作模式。
- 可快速部署到既有 Google 環境。

替代方案：

- React / Vue / Next.js。

未採用原因：

- 重構成本過高，會延後資料搬移與內部上線。

## D-002 PostgreSQL 作為未來主資料庫

原因：

- 適合跨系統關聯、JSON metadata、Audit Log、Domain Event。
- NAS Docker 已可穩定運行 API 與 PostgreSQL。

未來方向：

- PostgreSQL 為主。
- MSSQL 逐步退為匯入與核對來源。

## D-003 MSSQL 暫時保留

原因：

- QT、課程、點名、部分牧養資料仍依賴舊系統。
- 完全切換前需要核對與同步策略。

限制：

- 避免 PostgreSQL 與 MSSQL 同時寫同一主資料造成衝突。

## D-004 Identity Boundary v2

決策：

Administrative Domain 與 Pastoral Domain 必須解耦。

原因：

- 後台同工權限與會友身份是不同安全域。
- LINE/LIFF 外部入口不能繼承後台角色。
- 牧養資料範圍需更細緻，不能用系統角色粗略代表。

硬性規則：

- Pastoral Domain 權限不可依賴後台 Account Role。
- `role_feature_permissions` 只控制行政功能入口，不控制會友自助或牧養身份。
- 外部會友權限應由 `member_accounts`、`line_users`、LIFF session 或牧養專用權限判斷。

## D-005 會友與課程保留內部整數主鍵，新增對外編碼

決策：

- 會友：保留 `pastoral_members.id`，新增 `member_code`，前綴 `TOP`。
- 課程：保留 `education_courses.course_id`，新增 `course_code`，前綴 `CL`。

原因：

- 既有外鍵依賴整數主鍵。
- 直接改主鍵風險高。

## D-006 專案編號直接使用 PJ 前綴

原因：

- `projects.project_id` 已是 text。
- 可透過 FK `ON UPDATE CASCADE` 遷移關聯表。

## D-007 `id_rules` 作為中央編碼規則

原因：

- 專案、課程、會友、會議都需要可調整前綴與流水碼。
- 系統管理需要可維護入口。

## D-008 短連結管理移到表單系統

原因：

- 主要使用情境是公開表單。
- 只有管理者以上層級可看與操作。

## D-009 會議管理沿用 `meetings`

原因：

- 獨立會議與專案會議欄位高度相似。
- 讓 `project_id` 可為空可快速支援獨立會議。

## D-010 NAS Docker 作為內部 API 執行環境

原因：

- 目前 NAS 已可穩定運行 Docker。
- 內部 API、PostgreSQL、部署管理集中。

注意：

- SMB deploy 路徑目前可能不可用；SSH 可用。

## D-011 LINE webhook 分段上線

決策：

- Webhook receiver 已建立。
- 外部 HTTPS 完成前可維持準備/記錄模式。

原因：

- 防火牆與憑證仍需外部配合。
- 分段測試可降低正式切換風險。

## D-012 Remote / Local AI 只做 preflight

限制：

- 不直接改正式 repo。
- 不直接部署。
- 不直接改 DB。
- 不直接 push Git。
- 不讀 secret 或正式資料 dump。

## D-013 BPM Engine v1 先做輕量流程紀錄

決策：

- 新增 `bpm_definitions`、`bpm_instances`、`bpm_history`。
- 先不做完整節點模型與通知。
- 業務狀態與 BPM 狀態分離。
- 附件沿用 `files` / `file_links`。

未來方向：

- v2：業務狀態同步與 LINE/Email 通知。
- v3：`bpm_nodes`。
- v4：跨模組簽核整合。

## D-014 `Script_Login.html` 採漸進式拆分

決策：

- 第一階段只抽離靜態常數到 `Script_FeatureConfig.html`。
- 不同時抽 icon、權限、功能選單、登入流程。

原因：

- 避免大型 Apps Script 檔案一次重寫造成 mojibake 或行為回歸。
