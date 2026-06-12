# TopChurchPlus UI Refresh Phase 1 Report

最後更新：2026-06-12

## 範圍

本階段依據 `docs/architecture/UI_DESIGN_SYSTEM_V1.md` 進行第一階段 UI 改善。

限制：

- 未修改業務邏輯
- 未修改 Database
- 未修改 API
- 未修改 Apps Script Backend
- 僅調整 HTML 結構、CSS、Bootstrap class 與響應式樣式

## 修改檔案

| File | Type | Summary |
| --- | --- | --- |
| `css/design-system.css` | New | 建立 Design System V1 基礎 tokens 與 `.tc-*` 共用元件 class。 |
| `css/topchurchplus-theme.css` | New | 建立 TopChurchPlus theme layer，覆蓋 Bootstrap 視覺但不修改 Bootstrap 原始檔。 |
| `Style.html` | Modified | 將 Design System V1 class 導入現行 Apps Script include 流程，讓 Web App 可立即使用。 |
| `Index.html` | Modified | 導入 Tabler Icons webfont。 |
| `Qt.html` | Modified | 小範圍套用 `.tc-page`、`.tc-card`、`.tc-page-toolbar`、`.tc-page-filter-area`、`.tc-kpi-card`、`.tc-table`。 |
| `Script_Utilities.html` | Modified | 全站 `setListLoading()` loading state 加上 `.tc-loading-state`。 |
| `Script_Qt.html` | Modified | QT empty state 與 status badge 改用 `.tc-empty-state` / `.tc-badge-*`。 |

## 修改原因

### Design System CSS

Phase 1 需要先建立可重複使用的 UI foundation，避免 QT、Finance、Asset、Project 各自定義 page/card/table/button/status 樣式。

新增：

- CSS Variables
- `.tc-page`
- `.tc-page-header`
- `.tc-page-toolbar`
- `.tc-page-filter-area`
- `.tc-page-content`
- `.tc-page-action-area`
- `.tc-card`
- `.tc-kpi-card`
- `.tc-table`
- `.tc-loading-state`
- `.tc-empty-state`
- `.tc-badge-success`
- `.tc-badge-warning`
- `.tc-badge-danger`
- `.tc-badge-info`
- `.tc-badge-secondary`

### Apps Script Compatibility

目前 TopChurchPlus 前端由 `Style.html` 透過 Apps Script include 載入。為避免改動 Apps Script backend 或部署流程，本階段同步將 Design System class 放入 `Style.html`。

`css/design-system.css` 與 `css/topchurchplus-theme.css` 作為 repository-level source，供後續拆分或新前端入口沿用。

### Tabler Icons

`Index.html` 已導入 Tabler Icons webfont，作為未來 icon button 與工具列圖示的唯一官方圖示來源。

本階段未大規模替換既有按鈕文字，以避免改變操作流程。

## Before / After

### Before

- 多數管理頁依賴 Bootstrap class 與局部 module style。
- QT 頁面 root 直接使用 `.section-card`，未形成標準 page shell。
- KPI 區塊使用 `border rounded p-3`，缺少共用 KPI card class。
- Table 使用 Bootstrap `.table`，缺少 TopChurchPlus table standard class。
- Loading state 只有 `.list-loading-cell` / `.list-loading-box`。
- Empty state 使用散落的 `text-muted text-center py-*`。
- Status badge 使用 Bootstrap `badge bg-*-subtle text-*`。

### After

- 建立 Design System V1 CSS foundation。
- QT 管理頁開始使用 `.tc-page` / `.tc-page-content` / `.tc-page-toolbar`。
- QT KPI cards 改用 `.tc-kpi-card`。
- QT filter/search 區改用 `.tc-page-filter-area`。
- QT tables 改用 `.tc-table`。
- 全站 loading state 透過 `setListLoading()` 套用 `.tc-loading-state`。
- QT empty state 改用 `.tc-empty-state`。
- QT order/pickup status badge 改用 `.tc-badge-*`。
- Mobile 下 `.tc-page-toolbar` / `.tc-page-action-area` 按鈕會自動滿版排列。

## 待下一階段處理項目

1. 將 Project、Finance、Asset、Forms 逐步套用 `.tc-page` page layout。
2. 建立 `.tc-toast` / `.tc-alert` / `.tc-confirm-dialog` notification pattern。
3. 逐步把各模組 raw status color 收斂到 `.tc-badge-*`。
4. 將常用 toolbar icon button 導入 Tabler Icons。
5. 建立 module list page template，供 AI Agent 新增頁面時直接複用。
6. 檢查 mobile table 是否需要轉 card-list pattern。
7. 評估 Apps Script 是否要正式支援外部 CSS 檔載入；目前仍以 `Style.html` 為實際生效入口。

## 驗證建議

```powershell
tools\check-scripts.cmd
```

可選：

```powershell
.\push-to-google.cmd
```

本階段未執行部署，需由後續 release 流程決定是否推送 Apps Script。
