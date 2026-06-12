# TopChurchPlus Active Roadmap

最後更新：2026-06-12

## 最高優先

1. 完成外部 HTTPS、防火牆、反向代理與 LINE webhook 正式驗證。
2. 落實 Identity Boundary v2，拆清 Administrative Domain 與 Pastoral Domain。
3. 更新 AI context snapshot，確保 `tools/check-ai-context-freshness.cmd` 不再回 WARN。
4. 補 SQL migration 自動化或部署前 migration checklist。

## 近期開發

### LINE / LIFF

- 確認 WAN TCP 80/443 到 NAS。
- 確認 `api.topchurchplus.com` HTTPS 可連到 `/linebot/webhook`。
- 從 `log_only` 逐步切到正式 signature 驗證。
- 完成 LIFF 綁定流程驗證。

### Pastoral Identity

- 盤點 Pastoral Domain 目前是否誤用後台 Account Role。
- 定義會友自助、牧養同工、牧區權限的資料範圍。
- 確認 `member_accounts`、`line_users`、`line_liff_sessions` 的責任邊界。

### Workflow / BPM

- 為 workflow engine 建立前端工作台。
- 定義第一個要接 BPM 的業務流程。
- 補 workflow smoke test 到 `tests/api`。
- 評估 v2 業務狀態同步規則。

### Attendance

- 強化聚會統計 UI。
- 設計正式資料同步排程。
- 補出席趨勢圖與會友最近兩個月聚會狀況。

### Education

- 補講師與班表。
- 匯入後資料抽樣驗證。
- 補教育報表。

### Meeting

- 補獨立會議編輯。
- 補會議附件。
- 評估會議通知。

## 技術債

高優先：

- `Script_Login.html` 繼續拆分，下一步可抽 icon 或功能選單 UI，但一次只處理一個職責。
- `api/src/modules/project/routes.js` 過重，需要逐步拆 service/repository。
- SQL migration 尚未整合部署流程。
- API smoke test 覆蓋不足。

中優先：

- Apps Script bridge 與 API 職責整理。
- `params` 漸進遷移到 `param_items`。
- 短連結 UI 獨立元件化。
- 文件索引保持同步。

低優先：

- 前端樣式與元件命名統一。
- generated SQL 與匯入暫存資料標準化。

## 暫不做

- 不做 React/Vue/Next.js 全面重寫。
- 不把 Pastoral Domain 權限綁到後台 Account Role。
- 不在外部 HTTPS 未完成前啟用 LINE 正式嚴格模式。
- 不一次性重構所有大型 `routes.js`。
- 不新增第二套附件表，優先使用 `files` / `file_links`。
