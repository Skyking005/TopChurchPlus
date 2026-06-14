# TopChurchPlus UI Design Principles

Status: Product Design Governance V1
Last updated: 2026-06-14
Scope: UI principles for admin and member-facing surfaces.

## Design Philosophy

TopChurchPlus UI exists to help church workers complete real operational and pastoral tasks. It should not be redesigned for visual novelty alone.

Principles:

- Do not over-rely on default Bootstrap appearance.
- Use Bootstrap as behavior and layout foundation.
- Use TopChurchPlus Design System classes for product identity and consistency.
- Adopt Material Design spirit where it improves clarity: clear hierarchy, obvious affordances, stateful feedback, accessible controls.
- Do not add animation, decoration, or gradients unless they support comprehension.
- Every UI change must serve a user task.

## Admin Design Principles

### Efficiency First

Admin users often repeat tasks. UI should prioritize:

- Fast scanning.
- Predictable filters.
- Clear row actions.
- Batch-friendly layouts where appropriate.
- Minimal clicks for common tasks.

### Readability First

Admin pages can be dense but should remain readable:

- Use `.tc-page` page structure.
- Keep table headers sticky where useful.
- Use consistent spacing.
- Avoid placing tables directly at page root.
- Keep labels and statuses short.

### State Recognition First

Users should quickly understand:

- What is pending.
- What succeeded.
- What failed.
- What needs attention.
- What is readonly.
- What they are not allowed to do.

## Member-Facing Design Principles

### Mobile First

LIFF, LINE Bot, App, and public forms should assume phone usage first.

Rules:

- Single-column layout by default.
- Large tap targets.
- Short forms.
- Clear next action.
- Avoid admin terminology.

### Fewest Steps

Member-facing flows should reduce friction:

- Keep binding, registration, and form fill short.
- Show progress only when the flow has multiple steps.
- Avoid asking for information already known through Pastoral Member or Line binding.

### LINE Ecosystem First

LINE/LIFF flows should respect the environment:

- Use LINE identity as entry context.
- Make binding state explicit.
- Keep recovery instructions simple.
- Do not expose internal account roles.

## UI Standardization

### Buttons

Use action hierarchy:

| Button Type | Usage |
| --- | --- |
| Primary | Main page or modal action. |
| Secondary | Return, refresh, copy, reset, search supplement. |
| Success | Confirmed positive action only when semantic. |
| Warning | Attention-required action. |
| Danger | Destructive or irreversible action. |

Rules:

- One primary action per page section where possible.
- Destructive actions should not sit beside primary save actions without separation.
- Icon buttons need accessible labels or tooltips.
- Use Tabler Icons for icons when adding iconography.

### Colors

Use semantic color, not module branding, for state:

| State | Class |
| --- | --- |
| Success / active / complete | `.tc-badge-success` |
| Pending / attention | `.tc-badge-warning` |
| Failed / rejected / blocked | `.tc-badge-danger` |
| Informational / in progress | `.tc-badge-info` |
| Inactive / unknown / archived | `.tc-badge-secondary` |

### Tables

Use `.tc-table` for management tables.

Required states:

- Loading.
- Empty.
- Error.
- Permission-limited.

Rules:

- Keep row actions aligned consistently.
- Keep status badges in consistent columns.
- On mobile, decide whether to use horizontal scroll or card list.

### Forms

Required form standards:

- Clear labels.
- Required marker.
- Helper text for complex fields.
- Inline validation near the field.
- Save/cancel action placement.
- Readonly explanation when fields are disabled.

### Modals

Required modal standards:

- Clear title.
- Short body.
- Consistent footer.
- Primary action last.
- Cancel or close action always available.
- Error message visible without scrolling when possible.

### Empty State

Empty states should explain:

- What is missing.
- Whether the user can create something.
- What to do next.

Avoid:

- Blank tables.
- Only showing "no data" with no next action.

### Loading State

Loading states should:

- Preserve layout stability.
- Avoid blocking unrelated dashboard data.
- Be specific when a slow external service is involved.

### Error State

Error states should:

- Explain the problem in plain language.
- Identify whether it is permission, configuration, network, validation, or data issue.
- Offer a next action when possible.

### Permission State

Permission states should:

- Avoid confusing hidden actions with broken features.
- Show readonly banners when an entire module is readonly.
- Use Identity Boundary language for pastoral/member flows.

## Responsive Design

### Desktop First Modules

These modules benefit from larger screens because they contain dense tables, reports, or administrative tools:

- Finance.
- System Management.
- Config Key Management.
- Email Service.
- QT Inventory and Reconciliation.
- Asset.
- Admin Supply.
- Dev Management.

### Mobile First Modules

These modules should prioritize phone usage:

- LIFF.
- Line member portal.
- Public forms.
- QRCode check-in.
- Counter quick actions.
- Future App.

### Dual Mode Modules

These modules need both desktop and mobile modes:

- Pastoral.
- Attendance.
- Education.
- Forms.
- QT pickup.
- Venue/Zoom availability.

## Accessibility Principles

- Use readable contrast.
- Keep focus states visible.
- Ensure keyboard activation for feature cards and buttons.
- Avoid relying only on color for status.
- Use labels for form controls.
- Keep modal focus behavior predictable.
- Maintain tap target size on mobile.

## Implementation Guardrails

- Do not rewrite every module at once.
- Do not introduce a large frontend framework only for styling.
- Do not change workflow logic during visual cleanup.
- Do not change database/API behavior during UI standardization.
- Start with one or two pilot modules and verify patterns before rollout.
