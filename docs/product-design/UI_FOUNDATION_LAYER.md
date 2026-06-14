# TopChurchPlus UI Foundation Layer

Status: Foundation Layer V1
Last updated: 2026-06-14
Scope: Shared UI primitives only. This document does not authorize business logic, API, database, permission, navigation, or deployment changes.

## Purpose

The UI Foundation Layer is the reusable base for future TopChurchPlus module UI work. It turns Product Design V2 and Design System V2 into practical shared classes that can be applied gradually without rewriting existing modules.

This layer is intentionally small:

- It defines common CSS classes.
- It documents component structure and usage rules.
- It keeps current Apps Script partials working.
- It does not refactor QT, Email Service, Forms, Reservation, or other modules by itself.

## Current UI Structure Inventory

TopChurchPlus currently uses:

| Area | Current Source | Notes |
| --- | --- | --- |
| Main Apps Script shell | `Index.html` | Loads Bootstrap, Tabler Icons, Summernote, `Style.html`, brand assets, module HTML partials, and script partials. |
| Shared loaded CSS | `Style.html` | Actual CSS loaded by Apps Script today through `<?!= include('Style'); ?>`. |
| Extractable CSS source | `css/design-system.css` | Design-system source file for future extraction; not directly loaded by current Apps Script shell. |
| Theme source | `css/topchurchplus-theme.css` | Theme-level Bootstrap adjustments; not directly loaded by current Apps Script shell. |
| UI partials | `*.html` | Module views such as `Qt.html`, `EmailService.html`, `Forms.html`, `Pastoral.html`. |
| UI scripts | `Script_*.html` | Module behavior and rendering helpers. |

Implementation rule:

Until Apps Script packaging is changed, foundation classes must be available in `Style.html`. `css/design-system.css` should remain aligned as the extractable source for later split-file packaging.

## Foundation Components

### 1. Page Shell

Use:

```html
<section class="tc-page">
  <header class="tc-page-header">
    <h2 class="tc-page-title">Page title</h2>
    <p class="tc-page-subtitle">Short operational context.</p>
  </header>
  <div class="tc-page-toolbar"></div>
  <section class="tc-page-kpi-area"></section>
  <section class="tc-page-filter-area"></section>
  <main class="tc-page-content"></main>
  <footer class="tc-page-action-area"></footer>
</section>
```

Purpose:

- Provides consistent page container rhythm.
- Keeps title, toolbar, KPI, filters, content, and actions predictable.
- Prevents tables or forms from being placed directly at the view root.

Rules:

- Do not put a `.tc-table` directly under `.tc-page`; wrap it in `.tc-page-content` or `.tc-table-wrapper`.
- Omit empty optional sections.
- Do not use the page shell to change module routing or permissions.

### 2. Card System

Use:

```html
<section class="tc-card">
  <header class="tc-card-header">Section title</header>
  <div class="tc-card-body">Content</div>
  <footer class="tc-card-footer">Actions or metadata</footer>
</section>
```

Purpose:

- Standard content grouping.
- Predictable header/body/footer spacing.
- Suitable for module panels, settings sections, summaries, and detail blocks.

Rules:

- Avoid card-inside-card layouts.
- Use `.tc-card-footer` only when the section has actions or persistent metadata.

### 3. KPI Card

Use:

```html
<div class="tc-kpi">
  <div class="tc-kpi-label">Pending</div>
  <div class="tc-kpi-value">12</div>
</div>
```

Compatibility:

- Existing `.tc-kpi-card` remains supported.
- New modules may use `.tc-kpi`; existing modules do not need immediate migration.

Purpose:

- Dashboard counters.
- QT summary metrics.
- Email Service queue metrics.
- Reservation availability summaries.

### 4. Status Badge

Use:

```html
<span class="tc-badge tc-badge-success">已完成</span>
<span class="tc-badge tc-badge-warning">待審核</span>
<span class="tc-badge tc-badge-danger">已退回</span>
<span class="tc-badge tc-badge-info">進行中</span>
<span class="tc-badge tc-badge-secondary">未設定</span>
```

Rules:

- Status colors only communicate state.
- Do not use module category color as a status color.
- Do not create module-specific badge colors unless Design System V2 is updated first.

### 5. Table Wrapper

Use:

```html
<section class="tc-table-wrapper">
  <header class="tc-table-header">
    <span>Queue</span>
    <div>Filters or small action</div>
  </header>
  <table class="table table-hover align-middle tc-table"></table>
  <footer class="tc-table-footer">
    <span>Showing 1-20</span>
    <nav class="tc-pagination"></nav>
  </footer>
</section>
```

Purpose:

- Consistent table frame.
- Standard header/footer areas.
- Room for empty, loading, and pagination states.

Rules:

- Use horizontal scroll on mobile for dense admin tables.
- Use `.tc-empty` or existing `.tc-empty-state` when no rows exist.
- Use `.tc-loading` or existing `.tc-loading-state` while fetching data.

### 6. Form Standard

Use:

```html
<form class="tc-form">
  <div class="tc-form-row">
    <label class="tc-form-label">Email <span class="tc-form-required">*</span></label>
    <input class="form-control" type="email">
    <div class="tc-form-help">Used for system notifications.</div>
    <div class="tc-form-error d-none">Email is required.</div>
  </div>
</form>
```

Purpose:

- Standard label, required marker, help text, and validation message.
- Keeps forms readable across modules.

Rules:

- Do not rely only on color for required fields.
- Put validation near the field.
- Mobile forms should stack.

### 7. Modal Standard

Use:

```html
<div class="modal tc-modal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header"></div>
      <div class="modal-body"></div>
      <div class="modal-footer"></div>
    </div>
  </div>
</div>
```

Purpose:

- Standard modal surface while continuing to use Bootstrap modal behavior.

Rules:

- Keep modal tasks focused.
- Long forms should become page/detail views.
- Destructive confirmation copy must name the affected record and consequence.

### 8. Loading State

Use:

```html
<div class="tc-loading">資料載入中...</div>
<button class="btn btn-primary tc-loading-button" disabled>儲存中</button>
```

Compatibility:

- Existing `.tc-loading-state` remains supported.

Purpose:

- Full page, section, and button loading states.

Rules:

- Do not block the whole page when only one panel is refreshing.
- Preserve layout stability where practical.

### 9. Empty State

Use:

```html
<div class="tc-empty">目前沒有符合條件的資料。</div>
```

Compatibility:

- Existing `.tc-empty-state` remains supported.

Purpose:

- No data.
- Not configured.
- Search returned no result.

Rules:

- Empty tables should not be visually blank.
- Do not show create actions if the user cannot create.

### 10. Error State

Use:

```html
<div class="tc-error">API 暫時無法回應，請稍後重試。</div>
```

Purpose:

- API error.
- Validation summary.
- Permission or configuration error.

Rules:

- Do not expose secrets, raw tokens, API keys, or stack traces.
- Error state should identify the next useful action.

## Rollout Rules

Foundation classes are ready for future use, but rollout must be module-by-module.

Before applying to a module:

1. Confirm the module owner and category.
2. Confirm the user journey and primary tasks.
3. Confirm no API, DB, permission, or business logic change is needed.
4. Identify page shell, KPI, table, form, modal, loading, empty, and error states.
5. Apply the smallest patch that improves consistency.
6. Run `tools/check-scripts.cmd` and `git diff --check`.
7. Update this document only if a new shared component pattern is introduced.

Do not:

- Refactor all modules at once.
- Change workflow behavior while applying foundation classes.
- Add module-specific visual systems.
- Use category colors as status colors.

## QT Pilot Application

QT already uses several foundation classes:

- `.tc-page`
- `.tc-card`
- `.tc-page-toolbar`
- `.tc-page-filter-area`
- `.tc-kpi-card`
- `.tc-table`
- `.tc-badge-*`
- `.tc-loading-state`
- `.tc-empty-state`

Next safe QT pilot steps:

1. Replace ad-hoc dashboard panels with `.tc-kpi` or keep `.tc-kpi-card` consistently.
2. Wrap remaining inventory/log tables with `.tc-table-wrapper`.
3. Standardize form labels with `.tc-form-label`, `.tc-form-help`, and `.tc-form-error`.
4. Keep payment, fulfillment, reservation, Line Bot, transfer, and forecast logic untouched.

## Email Service Pilot Application

Email Service already uses KPI cards and `.tc-table`.

Next safe Email Service pilot steps:

1. Wrap queue list with `.tc-table-wrapper`.
2. Use `.tc-empty` for no queue results and `.tc-error` for dashboard panel failures.
3. Use `.tc-badge-*` for queue status and priority only where status mapping is clear.
4. Use `.tc-modal` for queue detail or resend confirmation.
5. Keep Mail Queue processing, trigger installation, quota checks, and send logic untouched.

## Maintenance

The foundation source of truth is:

1. `docs/product-design/UI_FOUNDATION_LAYER.md` for rules.
2. `css/design-system.css` for extractable CSS source.
3. `Style.html` for the currently loaded Apps Script CSS.

When updating foundation CSS, keep `css/design-system.css` and the matching `Style.html` section aligned until Apps Script supports direct CSS bundling.
