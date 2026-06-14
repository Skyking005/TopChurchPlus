# TopChurchPlus UI Component Standard

Status: Design System V2 Component Standard
Last updated: 2026-06-14
Scope: Component specification only. This document does not modify production UI code.

## Purpose

This document defines the reusable UI component standards for future TopChurchPlus modules. It should be used before implementing or refactoring module screens.

## Page Shell

Required structure:

```html
<section class="tc-page">
  <header class="tc-page-header"></header>
  <div class="tc-page-toolbar"></div>
  <section class="tc-page-kpi-area"></section>
  <section class="tc-page-filter-area"></section>
  <main class="tc-page-content"></main>
  <footer class="tc-page-action-area"></footer>
</section>
```

Rules:

- Tables, forms, and repeated cards must sit inside `.tc-page-content`, not directly at view root.
- The action area may be omitted when toolbar actions are sufficient.
- KPI area is optional and should not be empty.

## Button

| Type | Usage | Visual Intent |
| --- | --- | --- |
| Primary | Main action: save, create, approve, submit. | Strong filled button. |
| Secondary | Back, cancel, search, refresh, copy. | Outline or neutral button. |
| Success | Confirmed positive state, not generic save. | Use sparingly. |
| Danger | Delete, archive, reject, cancel irreversible action. | Destructive emphasis. |
| Ghost | Low-emphasis row action or toolbar helper. | Text/transparent or light outline. |

Rules:

- One primary action per page section when possible.
- Dangerous actions must not visually compete with primary save.
- Icon-only buttons require `aria-label` and tooltip.
- Use Tabler Icons for new icons.
- Loading buttons should show saving state and prevent duplicate submit.

## Badge

### Status Badge Classes

| Class | Meaning | Example |
| --- | --- | --- |
| `.tc-badge-success` | Active, approved, completed, healthy. | 已付款, 已完成, 正常 |
| `.tc-badge-warning` | Pending, attention, waiting. | 待審核, 未付款, 未領取 |
| `.tc-badge-danger` | Error, rejected, cancelled, blocked. | 已取消, 退回, 錯誤 |
| `.tc-badge-info` | In progress, informational, read-only. | 進行中, 只讀盤點 |
| `.tc-badge-secondary` | Inactive, archived, unknown. | 停用, 未綁定, Legacy |

Rules:

- Badge color communicates state severity, not module category.
- Badge text should be short.
- Do not use raw `background:red/green/blue`.
- Category chips may use category colors, but must not replace status badges.

## Table

### Density

| Density | Usage |
| --- | --- |
| Compact | Logs, queues, audit rows. |
| Standard | Normal list pages. |
| Spacious | Detail-heavy rows or member-facing admin views. |

### Required Behaviors

- Sticky header when table scrolls inside a constrained area.
- Hover highlight on desktop.
- Consistent row action alignment.
- Status badges in predictable columns.
- Loading row while fetching.
- Empty state when no rows.
- Error state when request fails.
- Pagination or explicit result limit for large lists.

### Sorting And Pagination

- Use sorting only when data source supports it or current page sorting is clear.
- Pagination controls should include current page and total where available.
- Search/filter reset should be near filter controls.

### Mobile

- Use horizontal scroll for dense admin tables.
- Use card list for mobile-first modules or operational quick actions.
- Do not hide critical row actions without an alternative.

## Form

### Labels

- Labels must be visible.
- Required fields must be marked.
- Helper text should explain non-obvious fields.

### Validation

- Validation errors should appear near the field.
- Form-level error should summarize API or permission failures.
- Do not rely on alert boxes for normal validation feedback.

### Required Field

Recommended format:

- Label text + `*` or a small `必填` marker.
- Avoid only using color to show required fields.

### Layout

- Desktop: use two columns only when fields are short and related.
- Mobile: stack fields.
- Group related fields in cards or sections.

## Modal

### Header

- Short title.
- Optional subtitle only when necessary.
- Close button with accessible label.

### Body

- Keep modal body focused on one task.
- Long forms should use page/detail view rather than modal when possible.
- Error blocks must remain visible.

### Footer

Recommended order:

1. Secondary/cancel.
2. Destructive action if needed, visually separated.
3. Primary action.

Rules:

- Primary action should be last.
- Destructive confirmation should use clear copy.
- Saving state should prevent double submit.

## Confirmation Dialog

Use confirmation for:

- Delete.
- Archive.
- Reject.
- Cancel reservation/order.
- Payment state changes.
- Permission or config changes.

Required copy:

- What will happen.
- Whether it can be undone.
- Which record is affected.

## Empty State

| Type | Copy Should Explain | Recommended Action |
| --- | --- | --- |
| No data | No records match current view. | Create, reset filters, or refresh. |
| No permission | User cannot access or edit. | Explain who to contact or why readonly. |
| Not configured | Required setup missing. | Link to settings or show setup step. |

Rules:

- Empty state should not be a blank table.
- Do not show create action if user cannot create.

## Loading State

| Type | Usage |
| --- | --- |
| First load | Page/module initial data. |
| Block refresh | Dashboard card or table refresh. |
| Saving | Submit/save/approval action. |

Rules:

- Preserve layout stability where possible.
- Do not block the entire page when only one block is refreshing.
- For slow external services, use clear text such as `正在檢查 Trigger 狀態`.

## Error State

| Type | Example | Required UI |
| --- | --- | --- |
| API Error | NAS/API unavailable. | Message, retry action, affected block only. |
| Validation Error | Missing field, invalid date. | Field message and form summary if needed. |
| Permission Error | Insufficient role/scope. | Readable permission message. |
| Configuration Error | Missing LINE/Calendar/API setup. | Setup guidance and admin-only link if allowed. |

Rules:

- Do not collapse the whole dashboard because one block fails.
- Do not expose secrets or raw tokens in error messages.
- Error text should identify next action.

## Permission State

Standard states:

| State | UI Behavior |
| --- | --- |
| Hidden | Action is irrelevant or unsafe to show. |
| Disabled with reason | User can understand the action but cannot perform it. |
| Readonly banner | Whole page/module is readonly. |
| Permission required error | API denied access. |

Pastoral-specific rule:

- Use pastoral scope language instead of backend account role language.

## Logs And Monitoring

For Mail Queue, Line Bot, QT inventory, audit, BPM, and system usage:

- Use compact tables.
- Provide status, timestamp, operator, entity, result, and error message.
- Provide date filters by default.
- Avoid displaying secret values.

## Accessibility Minimum

- Keyboard activation for interactive cards.
- Visible focus ring.
- Labels for inputs.
- Sufficient contrast.
- Do not rely only on color.
- Keep tap targets at least 40px on mobile when possible.
