# TopChurchPlus UI Design System V1

最後更新：2026-06-12

## 0. Scope

本文件是 TopChurchPlus 所有前端介面的 UI / UX 標準，適用於：

- Google Apps Script Web App。
- 後台行政模組，例如 Pastoral、Project、QT、Finance、Asset、Forms、Workflow。
- 未來 Line App 後台管理。
- 未來 Member Portal / LIFF 會友入口。

本文件不要求一次性重寫既有畫面。新功能與改版模組必須逐步遵守本規範，避免各模組自行建立視覺語言。

## 1. Design Philosophy

TopChurchPlus 是長時間使用的教會行政與牧養作業系統，不是一次性瀏覽的行銷網站。UI 應該安靜、清楚、穩定，讓同工可以快速掃描資料、完成操作、減少疲勞。

建立 Design System 的目的：

- 讓多模組系統維持一致的按鈕、卡片、表格、表單與互動模式。
- 降低 AI 協作開發時的風格漂移。
- 讓新模組可以用既有元件組合，不需要重新設計視覺。
- 保留 Bootstrap 的開發效率，同時避免 Bootstrap 預設風格過於呆板。
- 為未來 Tabler component、Material 3 或 Tailwind migration 留下結構化過渡路徑。

### 與 Bootstrap 的關係

Bootstrap 5 目前是 TopChurchPlus 的 layout framework，負責：

- Grid。
- Spacing utilities。
- Display utilities。
- Modal / collapse / nav behavior。
- 基礎 form control 行為。

Bootstrap 不應是最終視覺來源。TopChurchPlus Theme 應覆蓋按鈕、卡片、表格、表單與狀態樣式，使系統具有一致品牌與 SaaS dashboard 質感。

### 與 Material / Tailwind 的相容策略

V1 不導入 Material 或 Tailwind。若未來 migration：

- Design tokens 必須保持 CSS Variables，不綁死在 Bootstrap class。
- 元件語意使用 TopChurchPlus 命名，例如 `.tc-card`、`.tc-kpi-card`、`.tc-table`。
- Bootstrap utilities 可以留作 layout，但不可把業務元件視覺完全綁在 Bootstrap 原始 class。
- Tailwind 或 Material 只能是 implementation layer，不可覆蓋本文件定義的 UX 規範。

## 2. Theme Layer Architecture

目標架構：

```text
Bootstrap 5
  -> css/design-system.css
  -> css/topchurchplus-theme.css
  -> module-specific minimal layout only
```

目前專案仍以 Apps Script `Style.html` 為主要樣式入口。V1 文件先定義目標拆分，後續可逐步搬移。

### `css/design-system.css`

責任：

- 定義 design tokens。
- 定義通用元件基礎樣式。
- 不包含任何模組專屬業務語意。
- 可被所有前端入口共用，包括 Apps Script 與未來 LIFF / Member Portal。

內容範圍：

- Color tokens。
- Typography tokens。
- Radius / shadow / spacing tokens。
- Button primitives。
- Card primitives。
- Table primitives。
- Form primitives。
- Modal primitives。
- Loading / empty / error state primitives。

### `css/topchurchplus-theme.css`

責任：

- 套用 TopChurchPlus 品牌與產品語氣。
- 覆蓋 Bootstrap 預設外觀。
- 定義系統層級樣式，例如 topbar、main layout、feature cards、module page shell。
- 可以包含少量產品專屬 selector，但不可含模組業務邏輯。

### 禁止事項

- 禁止直接修改 Bootstrap 原始樣式檔。
- 禁止每個模組自行定義一套 button/card/table/form。
- 禁止以 inline style 寫主要視覺規則。
- 禁止為單一模組建立高飽和、完全不同的主題色。
- 禁止大量使用漸層背景、裝飾光暈或過度動畫。

## 3. Design Tokens

Design tokens 必須使用 CSS Variables 管理。V1 建議 token：

```css
:root {
  --tc-color-primary: #2563eb;
  --tc-color-primary-hover: #1d4ed8;
  --tc-color-primary-soft: #e8f1ff;

  --tc-color-success: #16834a;
  --tc-color-success-soft: #e8f6ee;
  --tc-color-warning: #b7791f;
  --tc-color-warning-soft: #fff4d6;
  --tc-color-danger: #c2413f;
  --tc-color-danger-soft: #fdeceb;

  --tc-color-bg: #f3f6fa;
  --tc-color-surface: #ffffff;
  --tc-color-surface-soft: #f8fafc;
  --tc-color-border: #d9e2ec;
  --tc-color-border-strong: #b8c5d6;

  --tc-color-text: #172033;
  --tc-color-text-muted: #667085;
  --tc-color-text-subtle: #8a94a6;

  --tc-radius-sm: 6px;
  --tc-radius-md: 8px;
  --tc-radius-lg: 12px;

  --tc-shadow-sm: 0 1px 2px rgba(16, 24, 40, 0.06);
  --tc-shadow-md: 0 8px 18px rgba(16, 24, 40, 0.08);

  --tc-space-1: 4px;
  --tc-space-2: 8px;
  --tc-space-3: 12px;
  --tc-space-4: 16px;
  --tc-space-5: 20px;
  --tc-space-6: 24px;
  --tc-space-8: 32px;
}
```

### Token Rules

- 新顏色必須先加入 token，不可散落在模組 CSS。
- 主要可互動元件使用 primary / success / warning / danger。
- 背景以低彩度灰藍系為基礎，不使用大面積純白或深色。
- 卡片 radius 預設 8px，不任意使用大型圓角。
- Shadow 應克制，資料密集畫面以 border 優先。

## 4. Page Layout Standard

All TopChurchPlus management pages must use a consistent page shell before placing module content. A page is not just a table or a form; it is a structured workspace that lets users scan context, filters, metrics, content, and actions in a predictable order.

### Required Page Structure

```html
<section class="tc-page">
  <header class="tc-page-header">
    ...
  </header>
  <div class="tc-page-toolbar">
    ...
  </div>
  <section class="tc-page-kpi-area">
    ...
  </section>
  <section class="tc-page-filter-area">
    ...
  </section>
  <main class="tc-page-content">
    ...
  </main>
  <footer class="tc-page-action-area">
    ...
  </footer>
</section>
```

### Page Header

- Must contain the page title and, when useful, a short operational subtitle.
- May include a compact status indicator or last updated time.
- Must not contain long help text or feature explanations.

### Page Toolbar

- Contains page-level actions such as create, export, refresh, batch update, or mode switches.
- Primary action should appear first on desktop and remain easy to reach on mobile.
- Toolbar actions must use the Button Standard and Tabler Icons where icons are needed.

### KPI Area

- Used for dashboard counters, totals, and summary metrics.
- Must use KPI Card or Summary Card patterns.
- Should be optional; do not create empty KPI placeholders when the page has no metrics.

### Filter Area

- Contains search fields, date/month filters, status filters, church/department filters, and reset controls.
- Filters should be visually grouped in a card or filter block, not scattered above a table.
- Mobile filters should stack vertically and keep submit/reset actions reachable.

### Content Area

- Main tables, detail panels, kanban boards, calendars, or report views belong here.
- Tables must be wrapped inside `.tc-page-content`; do not place a table directly at the page root.
- Content area must include loading, empty, and error states when data is fetched asynchronously.

### Action Area

- Used for page-level save/cancel actions, batch operation confirmations, or wizard navigation.
- For ordinary list pages, actions may live in the toolbar instead and this area can be omitted.

### Recommended Classes

| Class | Purpose |
| --- | --- |
| `.tc-page` | Root wrapper for a complete management page. |
| `.tc-page-header` | Title, subtitle, and compact page metadata. |
| `.tc-page-toolbar` | Page-level actions and view controls. |
| `.tc-page-kpi-area` | KPI cards and summary metrics. |
| `.tc-page-filter-area` | Search and filter controls. |
| `.tc-page-content` | Primary data/content region. |
| `.tc-page-action-area` | Save/cancel/batch/wizard actions. |

### Governance

- QT, Finance, Asset, Project, Pastoral, Forms, and future LIFF management pages must follow this structure.
- Do not place `table`, `form`, or repeated cards directly under the page root.
- Do not create module-specific page shell classes unless the Design System is updated first.

## 5. Button Standard

### Types

| Type | Usage |
| --- | --- |
| Primary | 主要提交、儲存、建立。每個區塊最多一個主要 CTA。 |
| Secondary | 返回、取消、次要操作。 |
| Success | 明確完成、核准、啟用。 |
| Warning | 需注意但非破壞性操作。 |
| Danger | 刪除、停用、退回、取消。 |

### Size

| Size | Height | Usage |
| --- | --- | --- |
| Small | 32px | Table row actions、toolbar secondary actions。 |
| Default | 38-40px | Form actions、page actions。 |
| Large | 44px | Mobile primary action 或重要入口。 |

### Icon

- 官方圖示庫為 Tabler Icons。
- icon 放在文字左側，間距 6-8px。
- icon-only button 必須有 tooltip 或 `aria-label`。
- loading 時 icon 可換成 spinner，但文字不得造成按鈕寬度劇烈跳動。

### Hover / Focus / Disabled

- Hover：稍微加深背景或 border，不使用大幅位移。
- Focus：必須有 visible focus ring。
- Disabled：opacity 降低且 cursor 不可暗示可點擊。
- Danger action 需在 destructive 情境使用確認對話或二階段操作。

## 6. Status Badge Standard

TopChurchPlus has many operational statuses across project, finance, QT, asset, pastoral, and workflow modules. Status labels must use semantic badge classes instead of module-specific colors or inline styles.

### Badge Classes

| Class | Intended Meaning | Example Status |
| --- | --- | --- |
| `.tc-badge-success` | Completed, approved, active, healthy. | 已完成, 已核准, 正常, 已付款 |
| `.tc-badge-warning` | Pending, waiting, review needed, attention required. | 待審核, 未付款, 進行中, 即將到期 |
| `.tc-badge-danger` | Failed, rejected, cancelled, blocked, destructive state. | 已退回, 已取消, 異常, 停用 |
| `.tc-badge-info` | Informational, neutral progress, system note. | 規劃中, 已建立, 已送出 |
| `.tc-badge-secondary` | Inactive, archived, unknown, low emphasis. | 草稿, 未設定, 歷史資料 |

### Rules

- Use semantic status classes; do not write raw colors such as `background:red`, `background:green`, or `background:blue`.
- Badge text must be short and scannable. Prefer two to four Chinese characters when possible.
- Badge color must communicate severity, not module branding.
- The same business status must use the same badge class across modules.
- Badges must remain readable on mobile tables and card lists.

### Status Mapping Examples

| Domain | Status | Badge |
| --- | --- | --- |
| Project | 規劃中 | `.tc-badge-info` |
| Project | 進行中 | `.tc-badge-warning` |
| Project | 已完成 | `.tc-badge-success` |
| Project | 已取消 | `.tc-badge-danger` |
| Finance / QT | 待審核 | `.tc-badge-warning` |
| Finance / QT | 已核准 / 已付款 | `.tc-badge-success` |
| Finance / QT | 已退回 | `.tc-badge-danger` |
| Asset | 正常 | `.tc-badge-success` |
| Asset | 維修中 | `.tc-badge-warning` |
| Asset | 停用 | `.tc-badge-danger` |

## 7. Card Standard

### KPI Card

用途：Dashboard 指標，例如訂購數、未付款、已領取、待審核。

規範：

- 使用 `.tc-kpi-card`。
- padding 16-20px。
- 上方為 muted label。
- 主數字使用 24-32px，font-weight 700。
- 可使用狀態色，但只作用於數字或小標籤，不染整張卡片。

### Content Card

用途：主要內容區塊、列表、表單。

規範：

- 使用白色 surface。
- border 使用 `--tc-color-border`。
- shadow 使用 `--tc-shadow-sm`。
- radius 8px。
- header / body / footer 分區清楚。

### Summary Card

用途：彙總、提醒、說明性資訊。

規範：

- 背景可使用 `--tc-color-surface-soft`。
- 不使用高飽和大色塊。
- 可搭配小型 icon。
- 文字密度可略高，但仍需保持行距 1.45 以上。

### 禁止事項

- 不要把 page section 全部做成浮動卡片。
- 不要卡片包卡片。
- 不要在操作型 SaaS 頁面使用大型 marketing hero。

## 8. Table Standard

TopChurchPlus 的資料密度高，表格需優先支援掃描、排序與狀態辨識。

### Base

- Header 背景使用 soft surface。
- Header font-weight 600。
- Cell padding 預設 10-12px。
- Table row height 保持穩定。
- 數字欄位靠右。
- 狀態欄位使用 badge。

### Zebra Row

- 預設可以使用 very subtle zebra。
- Zebra 色不可強於 hover。
- 若資料量少或 row action 很多，可只用 border 分隔。

### Sticky Header

- 長表格可使用 sticky header。
- Sticky header 背景必須是不透明 surface。
- Sticky z-index 不可蓋住 topbar/modal。

### Hover Highlight

- Hover 背景使用 primary soft 或 surface soft。
- Hover 不改變 row 高度。
- Row action button 不應在 hover 時造成 layout shift。

### Loading State

Loading state 標準：

- Table body 顯示單列 loading。
- 使用 spinner + 短文字。
- 不清空 header。

範例文案：

- `資料載入中...`
- `QT 報表載入中...`
- `會友資料載入中...`

### Empty State

Empty state 標準：

- Table body 顯示單列。
- 文字置中、muted。
- 不使用大型插圖。
- 可提供單一 primary action，例如「新增表單」。

## 9. Form Standard

### Input / Select

- Label 在 input 上方。
- 表單控制項高度 38-40px。
- Mobile 使用 full width。
- 同一 row 的欄位使用 Bootstrap grid，但 visual spacing 由 design tokens 控制。

### Checkbox / Radio

- 二元設定用 checkbox / switch。
- 互斥選項用 radio 或 segmented control。
- 不要用一般 button 模擬 checkbox，除非已有清楚 selected state 與 ARIA。

### Validation

- 錯誤訊息放在欄位下方。
- 錯誤文字使用 danger color。
- 錯誤狀態需同時有 border color 與 message，不只靠顏色。
- 必填標示使用紅色 `*`，並保留 label 文字可讀性。

### Layout

- 同一群表單欄位放在 content card body。
- 長表單分 section。
- Submit / Cancel 固定放 footer 或區塊底部右側；mobile 可改為 full width stacked。

## 10. Modal Standard

Modal 用於短流程，不應承載大型工作台。

### Width

| Type | Max Width |
| --- | --- |
| Small confirm | 420px |
| Default form | 640px |
| Large detail | 860px |
| Extra large review | 1100px |

### Header

- 左側 title。
- 右側 close button。
- 不放多個主要操作。

### Body

- 表單使用 grid。
- 內容超過 viewport 時 body scroll，header/footer 固定可見。
- 不使用 modal 內多層卡片。

### Footer

- 右側放主要操作。
- Cancel 在 primary 左側。
- Destructive action 放左側或使用 danger button，避免誤點。

## 11. Notification Standard

All user feedback must use consistent notification patterns so users can quickly distinguish successful actions, warnings, errors, and informational updates.

### Toast

Use toast notifications for non-blocking operation feedback.

| Type | Usage | Example |
| --- | --- | --- |
| Success | Operation completed. | 新增成功, 修改成功, 資料已更新 |
| Warning | Operation completed with attention needed, or data needs review. | 部分資料未同步, 請確認月份設定 |
| Error | Operation failed and user must know why. | 操作失敗, 無法儲存資料 |
| Info | Neutral system update. | 資料載入完成, 已切換檢視 |

Rules:

- Toast text must be short and action-oriented.
- Toast should not replace validation messages for form fields.
- Error toasts should include enough context for the user to retry or report the problem.
- Do not use browser `alert()` for normal operation feedback.

### Alert

Use alerts for page-level or section-level messages that must remain visible until the user acts or context changes.

Examples:

- API unavailable.
- Current month is not open for QT pickup.
- A report is generated from incomplete source data.

### Inline Message

Use inline messages near the related field or control.

Examples:

- Validation errors below inputs.
- Empty state inside a table.
- Permission note inside a restricted action area.

### Confirmation Dialog

Use confirmation dialogs for destructive or irreversible actions.

Required for:

- Delete.
- Cancel.
- Reject.
- Bulk update.
- Any action that changes financial, identity, pastoral, or audit-sensitive data.

Confirmation dialog rules:

- Title must state the action.
- Body must state the consequence.
- Primary destructive action must use the Danger button style.
- Cancel must remain available and visually clear.

## 12. Icon Standard

官方圖示庫：Tabler Icons。

使用原則：

- 所有系統圖示優先使用 Tabler Icons。
- Icon stroke width 保持一致。
- Icon size 常用 16px、18px、20px、24px。
- Icon-only control 必須有 `aria-label`。

禁止：

- 混用 Font Awesome。
- 混用 Bootstrap Icons。
- 使用 emoji 作為系統圖示。
- 使用手繪 SVG 取代 Tabler 既有圖示。

例外：

- 品牌 logo、第三方平台 logo、既有正式圖片資產可使用自有 SVG / PNG。

## 13. Mobile First Standard

TopChurchPlus 主要是行政系統，但手機與平板仍是必要入口。所有新 UI 必須先檢查 mobile。

### Cards

- Mobile 卡片全寬。
- KPI cards 可 2 欄或 1 欄，避免超窄數字卡。
- 卡片 padding 可從 20px 降到 16px。

### Tables

- 寬表格使用 `.table-responsive` 橫向滾動。
- 不強行壓縮欄位到不可讀。
- 關鍵欄位可在 mobile 改為 card list，但需遵守 card standard。

### Buttons

- Mobile 主要操作可 full width。
- Toolbar buttons 可換行。
- Row actions 避免太多小按鈕；超過 3 個動作時使用 dropdown。

### Modal

- Mobile modal 接近 full width。
- Footer buttons 可 stacked。
- 不要在 mobile modal 中放大型表格。

## 14. Accessibility Standard

### Contrast

- 一般文字需符合 WCAG AA 對比。
- Muted text 不可用於重要數值或錯誤訊息。
- 狀態不可只靠顏色，需有文字 label。

### Font Size

- Body 最小 14px。
- 表格資料最小 13px。
- Form label 最小 13px。
- Mobile 可略放大 clickable area，不縮小字體。

### Focus

- 所有可互動元素需有可見 focus state。
- Focus ring 顏色使用 primary translucent。
- 不可使用 `outline: none` 後沒有替代 focus。

### Keyboard

- Modal 開啟後 focus 進入 modal。
- Esc 可關閉非破壞性 modal。
- Tab order 應符合視覺順序。
- Button、tab、dropdown 必須可鍵盤操作。

## 15. AI Generation Rules

AI Agent 新增或修改 UI 時必須遵守：

- 先使用既有 design tokens。
- 先使用既有元件模式。
- 若需要新元件，先更新本文件，再實作。
- 不得為單一模組創造獨立視覺系統。
- 不得使用 emoji 當作 icon。
- 不得使用高飽和背景或大型漸層裝飾。
- 不得在資料密集頁面建立 landing-page hero。
- 新 UI 必須檢查 mobile layout。
- 新 UI 必須檢查 loading / empty / error state。

## 16. Future Roadmap

### Phase 1：Bootstrap 5 + Theme Layer

目標：

- 保留 Bootstrap 5。
- 建立 design-system.css 與 topchurchplus-theme.css。
- 將現有 `Style.html` token 與共用元件逐步整理到 theme layer。

完成條件：

- 所有新模組使用 Design System token。
- Button、Card、Table、Form、Modal 樣式一致。
- AGENTS.md 要求 AI agent 遵守本文件。

### Phase 2：Tabler Style Components

目標：

- 導入 Tabler Icons。
- 建立 TopChurchPlus component classes。
- 逐步降低 Bootstrap 預設視覺。

完成條件：

- 官方 icon 全部使用 Tabler Icons。
- KPI card、summary card、data table、empty state 有固定樣式。

### Phase 3：Design Token Expansion

目標：

- 補齊 typography scale。
- 補齊 semantic colors。
- 補齊 density modes，例如 compact / comfortable。
- 補齊 dark mode 評估，但不急於實作。

完成條件：

- 模組 UI 不再直接寫 raw color。
- 可用 token 快速調整整體產品視覺。

### Phase 4：Optional Material 3 / Tailwind Migration

目標：

- 評估是否需要 Material 3 或 Tailwind。
- 保持 UX 規則不變，只替換 implementation layer。

完成條件：

- Design tokens 可遷移。
- Component semantics 保持穩定。
- 不破壞 Apps Script 現有前端。

## 17. Review Checklist

新增 UI 或改版前，確認：

- 是否使用 TopChurchPlus tokens？
- 是否遵守 button / card / table / form / modal 標準？
- 是否支援 mobile？
- 是否有 loading state？
- 是否有 empty state？
- 是否有 error / validation state？
- 是否使用 Tabler Icons？
- 是否沒有 emoji 作為系統圖示？
- 是否沒有新增模組專屬視覺規範？
- 是否需要先更新本文件？
