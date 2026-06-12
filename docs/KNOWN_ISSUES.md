# TopChurchPlus Known Issues

最後更新：2026-06-12

## 外部網路與部署

- `api.topchurchplus.com` 對外 HTTPS 尚待防火牆、憑證、反向代理最終確認。
- LINE webhook receiver 內部可測，但正式 LINE 驗證依賴外部 HTTPS。
- `deploy-api.cmd` 預期 SMB `\\192.168.3.2\docker\project-api`，目前此路徑可能不可用。
- SSH 到 NAS 可用，可用 tar/ssh 作替代部署。
- SQL migration 尚未整合進一鍵部署流程。

## Identity Boundary

- Identity Boundary v2 仍需全面盤點。
- Pastoral Domain 不可依賴後台 Account Role，但既有功能可能仍需要檢查是否混用。
- LIFF/Line 外部身份與後台 `accounts` 不可混成同一授權模型。

## 前端技術債

- `Script_Login.html` 已抽出靜態常數，但仍過大。
- 多個 `Script_*.html` 承載畫面、狀態與 API 呼叫，仍待漸進式整理。
- Apps Script bridge `程式碼.gs` 很長，應避免新增大量商業邏輯。
- 部分中文檔案可能有 mojibake 風險，修改前需檢查。

## API 技術債

- 多數模組仍集中在 `routes.js`。
- `project/routes.js` 同時承載專案、會議、文件部分邏輯。
- workflow engine v1 尚無完整前端工作台。
- workflow smoke test 尚未納入 `tests/api/run-smoke.cmd`。

## Database / Migration

- MSSQL 仍是會友、課程、QT、點名的過渡來源。
- 正式切換前需要避免新舊系統雙寫衝突。
- `params` 與 `param_items` 仍在過渡。
- 新增 FK 時需確認 index，不可只改 migration 不補效能索引。

## Module Gaps

- Pastoral：會友報表、重複會友合併、LINE 綁定驗證流程待補。
- Education：講師班表、報表、匯入資料驗證待補。
- Attendance：UI 報表、趨勢圖、正式同步排程待補。
- Meeting：獨立會議編輯、附件、通知待補。
- Finance：報表、預算分析、簽核細化待補。
- Asset：797 筆正式資產匯入驗證、盤點流程待補。
- Counter：日結與支付方式報表待補。

## AI Context

- `tools/check-ai-context-freshness.cmd` 若回 `[WARN]`，代表 AI context snapshot 比 Git HEAD 舊。
- 舊 snapshot 只能做背景參考，不能當成最新事實來源。
