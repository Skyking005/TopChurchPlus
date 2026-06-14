# TopChurchPlus UI Rollout Strategy

Status: Design System V2 Rollout Plan
Last updated: 2026-06-14
Scope: Planning only. No production UI changes are included.

## Purpose

This document defines how TopChurchPlus should roll out Navigation Architecture V2 and Design System V2 without disrupting active modules.

The rollout should be incremental, measurable, and reversible.

## Rollout Principles

1. Do not rewrite all modules at once.
2. Preserve business flows.
3. Preserve API and schema behavior.
4. Pilot on modules that already partially use `.tc-*` patterns.
5. Standardize components before visual polish.
6. Verify after each module.
7. Update docs when new component patterns are introduced.

## Recommended Rollout Order

### Phase 0: Documentation Alignment

Status:

- This phase is this document set.

Deliverables:

- Navigation Architecture V2.
- Design System V2.
- UI Component Standard.
- Identity Boundary UI Review.
- Rollout Strategy.

### Phase 1: Navigation Proof Of Concept

Scope:

- Categorized feature menu only.
- Preserve feature actions.
- Preserve role filtering.
- Preserve usage sort, pinning, and custom order.
- Separate coming-soon features.

Potential files later:

- `Script_FeatureConfig.html`
- `Script_Login.html`
- `Style.html`

Risk:

- Medium if pin/order behavior is changed.
- Low if category grouping is layered after existing filtering.

Validation:

- Super admin sees all authorized modules grouped.
- Manager sees allowed modules grouped.
- Role-specific users still only see allowed features.
- Coming-soon entries are quiet.

### Phase 2: Pilot 1 - QT Management

Reason:

QT is operationally important and already has dashboard, tabs, status badges, inventory, reservation, fulfillment, reconciliation, and audit-sensitive actions. It is a strong test case for Design System V2.

Candidate UI areas:

- QT dashboard KPI cards.
- Orders table.
- Payment review action.
- Same-church fulfillment action.
- Inventory monthly table.
- Inventory movement logs.
- Reconciliation read-only status.
- Notification/report tabs.
- Modal action footer patterns.

Components to apply:

- `.tc-page` page shell.
- `.tc-page-toolbar`.
- `.tc-page-kpi-area`.
- `.tc-page-filter-area`.
- `.tc-table`.
- `.tc-badge-*`.
- Loading, empty, error states.
- Confirmation dialog for payment/fulfillment actions.
- Permission/readonly states.

Risks:

- Payment and fulfillment are sensitive. UI cleanup must not change business logic.
- Status labels must not change API status values.
- Reservation and inventory wording must remain precise.
- Legacy data boundaries must remain visible where applicable.

Out of scope:

- No payment logic changes.
- No fulfillment logic changes.
- No Line Bot/LIFF changes.
- No transfer/forecast implementation.
- No schema migration.

Validation:

- Existing QT smoke checks still pass.
- Payment approval UI still calls the same endpoint.
- Fulfillment UI still calls the same endpoint.
- Inventory/reconciliation views remain read-only where intended.
- `git diff --check` passes.

### Phase 3: Pilot 2 - Email Service Management

Reason:

Email Service is a contained admin-only module with dashboard, queue list, detail modal, retry/cancel/resend actions, trigger status, quota state, and monitoring errors. It is ideal for standardizing infrastructure UI.

Candidate UI areas:

- Dashboard cards.
- Queue filters.
- Queue table.
- Detail modal.
- Error message display.
- Trigger status and permission-required state.
- Quota health.
- Retry/cancel/resend row actions.

Components to apply:

- `.tc-page` page shell.
- KPI cards.
- `.tc-table`.
- `.tc-badge-*`.
- Empty state for no queue items.
- Error state for trigger permission.
- Loading state for dashboard refresh.
- Confirmation dialog for cancel/resend.

Risks:

- Trigger checks can require Apps Script authorization.
- Dashboard must not fail entirely if trigger status fails.
- Secret or sensitive email payloads should not be overexposed.

Out of scope:

- No change to Mail Queue processing rules.
- No change to MailApp send behavior.
- No trigger install behavior changes unless separately authorized.
- No schema changes.

Validation:

- Dashboard loads even if trigger permission is missing.
- Queue filters still work.
- Retry/cancel/resend actions still call existing wrappers.
- `git diff --check` passes.

### Phase 4: Expand To Operational Modules

Candidate modules:

- Forms.
- Finance.
- Asset.
- Admin Supply.
- Venue.
- Pastoral.
- Attendance.
- Education.

Rollout order:

1. List/table shell.
2. Filters.
3. Status badges.
4. Modals/forms.
5. Mobile behavior.

### Phase 5: Member-Facing Surface Alignment

Candidate surfaces:

- LIFF.
- Line member portal.
- Public Forms.
- Future App.

Rules:

- Do not copy admin layout directly.
- Mobile-first.
- Short flows.
- Identity state visible.
- Pastoral Member mapping explicit when relevant.

## Impact Scope Matrix

| Area | Expected Impact | Notes |
| --- | --- | --- |
| CSS | Medium | Add or refine `.tc-*` classes gradually. |
| Apps Script HTML | Medium | Module shell and markup updates. |
| Apps Script JS | Low to Medium | Only if loading/empty/error states need hooks. |
| API | None | Not part of UI rollout. |
| Database | None | Not part of UI rollout. |
| Permissions | None | UI may display states, not change logic. |
| Deployment | Separate task | Deploy only when explicitly requested. |

## Quick Wins: 1-2 Weeks

1. Add category metadata and render grouped feature menu.
2. Separate active and coming-soon modules.
3. Create status badge mapping.
4. Apply `.tc-table` and empty/loading states to Email Service queue.
5. Align QT dashboard cards and status badges.

## Mid-Term Improvements: 1-3 Months

1. Roll out page shell to top operational modules.
2. Standardize modal footer and error placement.
3. Standardize permissions/readonly states.
4. Add mobile table/card guidance to Forms, Pastoral, Attendance, and QT pickup.
5. Split Line App member operations from technical setup in UI structure.

## Long-Term Vision: 6-12 Months

1. Role-specific dashboards.
2. Pastoral Member profile as a cross-module hub.
3. Member-facing LIFF/App design language.
4. BPM component library for approval/review flows.
5. Optional service boundaries for Mail Queue, Line/LIFF, and Documents after workflows stabilize.
