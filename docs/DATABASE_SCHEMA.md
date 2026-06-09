# TopChurchPlus Database Schema Guide

最後更新：2026-06-09

本文件是資料表索引與欄位語意指南，不取代 SQL migration。真正欄位定義請以 `database/*.sql` 與實際 PostgreSQL schema 為準。

## 資料庫原則

- 現行主要資料庫為 NAS PostgreSQL。
- 舊 MSSQL 仍是牧養、課程、QT、點名等正式資料來源或同步來源。
- 每次 schema 或資料 migration 前都要先備份 NAS PostgreSQL。
- 新增外鍵欄位時需補 index。
- 與 MSSQL 搬移有關的欄位，不要隨意改名或改型別。
- 中文 seed 或測試資料寫入後，要查回確認沒有 mojibake。

## 核心資料表

### accounts

同工帳號主檔。

常見用途：

- 內部系統登入。
- 功能權限角色。
- 職稱、部門、會堂或牧養資料權限。

注意：

- 序號排序需用數值排序，不要字串排序，避免 `101` 排在 `2` 前面。
- 部門已朝多部門方向發展。

### role_feature_permissions

系統功能入口權限。

欄位概念：

- role/identity：權限身分，例如超級管理者、管理員、全職同工、義工等。
- feature_key：系統功能 key。
- access_level：`none/read/edit`。

用途：

- 決定登入後功能卡片是否顯示。
- API 端也要用相同規則檢查。

### system_usage_logs

系統使用紀錄。

用途：

- 功能使用頻率。
- 登入後功能排序。
- 使用者體驗分析。

注意：

- 保留策略建議 180-365 天。
- 盡量輕量記錄，避免 NAS 壓力。

### audit_logs

敏感資料異動稽核。

用途：

- 權限、牧養、財務、系統設定等敏感操作。
- 未來問題追查。

注意：

- 比 system_usage_logs 保存更久。
- 記錄時避免大量塞完整個人資料。

### development_issues

系統開發 Issue 提案主檔。

欄位概念：

- issue_no：流水編號，給介面顯示。
- issue_type：`feature`、`issue`、`maintain`。
- status：`提案`、`取消`、`完成`。
- priority：`低`、`中`、`高`。
- description：使用者描述的需求、問題或維護事項。
- created_by_staff_id / created_by_name：提交人。
- completed_at：狀態為完成時記錄完成時間。

索引：

- `status + priority + created_at`：清單排序與篩選。
- `issue_type`：類型篩選。
- `created_by_staff_id`：依提交人查詢。

### development_releases

版本更新歷程。

欄位概念：

- commit_hash / commit_message：Git 更新資訊。
- apps_script_version：Google Apps Script 部署版本。
- api_deployed / apps_script_deployed：部署註記。
- summary：本次更新摘要。
- verification_result：測試、部署、DB 備份等驗證摘要。

索引：

- `created_at`：版本歷程倒序列表。
- `created_by_staff_id`：依建立人查詢。

### params / param_categories / param_items

參數管理。

現況：

- 舊功能多數仍讀 `params`。
- 新結構朝 `param_categories` + `param_items` 發展。

建議：

- 純下拉選項用 `param_items`。
- 有屬性、關聯、統計需求者獨立成主資料表，例如 churches、departments、asset_locations、venues。

## 共用檔案資料表

### files

檔案主檔。

用途：

- NAS 檔案或產出文件的統一紀錄。
- 儲存檔名、mime type、大小、路徑、建立者等 metadata。

### file_links

檔案與業務資料關聯。

用途：

- 將同一個檔案掛到牧養會友、財務請款、資產、表單回覆、專案文件等。

建議欄位語意：

- entity_type：例如 `pastoral_member`、`finance_purchase`、`asset`。
- entity_id：業務資料 ID。
- file_type：例如 `member_photo`、`quote_pdf`、`newcomer_form_image`。

## 跨系統關聯

### entity_links

記錄跨系統來源與衍生關係。

例：

- project -> finance.purchase
- finance.purchase -> finance.payment_request
- finance.payment_request -> asset.asset

用途：

- 避免直接在各模組互塞一堆外部欄位。
- 後續查資料來源、回溯流程、做統計。

### domain_events

記錄系統事件。

例：

- 採購單建立。
- 請款單建立。
- 資產由請款建立。

## 牧養相關

主要 migration：

- `database/pastoral_schema.sql`
- `database/pastoral_permissions_usage.sql`
- `database/20260605_pastoral_member_images.sql`

核心資料表概念：

- pastoral_members：會友主檔。
- pastoral_member_contacts：電話、Email、Line 等聯絡資料。
- pastoral_member_addresses：地址，未來可搭配國家、縣市、行政區統計。
- pastoral_member_faith：信仰狀態、原屬教會、洗禮等。
- pastoral_member_families：親屬關係。
- pastoral_groups：牧區/小家階層。
- account_pastoral_church_permissions：帳號可看哪些會堂會友資料。

注意：

- `pastoral_members.line_user_id` 與 `line_users` 連動。
- 會友 CRUD 是其他模組的基礎，修改前要評估 Line App、教育、點名、表單的影響。

## 財務相關

主要資料概念：

- purchase / purchase_items：採購與請購詳情。
- advance / advance_items：預借。
- expense_proofs / expense_proof_items：支出證明。
- payment_requests / payment_request_items：請款。
- 附件透過 `files`、`file_links` 管理，例如報價單 PDF。

注意：

- 請款可獨立申請。
- 支出證明必須掛請款。
- 財務資料可衍生資產，應建立 `entity_links`。

## 專案相關

主要資料表：

- projects
- project_people
- project_permissions
- project_income
- project_budget
- meetings

注意：

- 專案內容可能包含財務資訊，不是所有全職同工都可看。
- 儲存專案需允許有完全控制權限的人員，不限專案登入人。
- 會議與會者需依 accounts / departments 快速選取。

## 表單相關

主要 migration：

- `database/20260605_forms_schema.sql`
- `database/20260605_form_image_upload_schema.sql`
- `database/20260605_forms_counter_foundation.sql`

資料概念：

- forms：表單主檔。
- form_questions：題目。
- form_responses：回覆。
- form_response_answers：答案。
- 圖片附件走檔案表。

注意：

- 外部填寫必填 Email。
- 停止或過期後，新增/編輯都需阻擋。
- 回覆需可產生統計表。

## Line App / LIFF

主要 migration：

- `database/20260606_linebot_foundation.sql`
- `database/20260607_liff_foundation.sql`
- `database/20260609_line_app_member_management.sql`

主要資料表：

- line_bot_channels：Channel、LIFF、LINE API 預備設定、LIFF security metadata。
- line_bot_module_settings：Line App 會友功能開關。
- line_bot_rich_menus：Rich Menu 管理與已綁定/未綁定提示。
- line_bot_links：LINE/LIFF 對外連結。
- line_users：LINE 使用者。
- line_liff_sessions：LIFF session。

注意：

- 目前 LINE API 正式呼叫預設關閉。
- LIFF 安全框架預設監控，不阻擋。
- 正式切換前不要把 mode 改成 live。

## QT、QRCode、場地、Zoom、行政物資

QT：

- `database/20260605_qt_inventory_schema.sql`
- `database/20260605_qt_orders_schema.sql`
- 與 Line App 下單前庫存檢查相關。

QRCode：

- `database/20260605_qrcode_checkin_schema.sql`
- 櫃台工作站掃碼報到。

場地：

- `database/20260605_venue_schema.sql`
- `database/20260606_resource_overlap_constraints.sql`
- 需要同場地同時段排他。

Zoom：

- `database/20260606_zoom_reservations.sql`
- 同帳號同時段排他，不同時段可重複借用。

行政物資：

- `database/20260606_admin_supplies.sql`
- 總庫存與各會堂庫存。

## MSSQL 同步

相關文件：

- `docs/LEGACY_MSSQL_SYNC_WORKFLOW.md`
- `database/compare_mssql_postgres_pastoral_education.ps1`
- `database/import_pastoral_from_sqlserver.ps1`
- `database/import_education_from_sqlserver.ps1`
- `database/import_qt_from_sqlserver.ps1`
- `database/import_attendance_from_sqlserver.ps1`
- `database/run_legacy_weekly_sync.ps1`

注意：

- 舊系統仍有 CRUD 時，新系統需規劃同步策略。
- 正式切換前，避免兩邊同時寫同一主資料造成衝突。
