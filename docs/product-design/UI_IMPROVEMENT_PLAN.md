# TopChurchPlus UI Improvement Plan

Status: Draft / Product Design Planning
Last updated: 2026-06-14
Scope: Incremental UI improvement plan only. No production code changes are included in this document.

## Current Observation

TopChurchPlus already has the foundation for a consistent admin UI:

- Bootstrap 5 is used as the layout and behavior base.
- Tabler Icons are available.
- `Style.html` includes TopChurchPlus Design System V1 primitives such as `.tc-page`, `.tc-card`, `.tc-kpi-card`, `.tc-table`, `.tc-loading-state`, `.tc-empty-state`, and `.tc-badge-*`.
- Several modules still use raw Bootstrap classes, module-specific status classes, and custom card/table patterns.

The right next step is not a full redesign. The right next step is a controlled rollout of the existing design system across the most visible workflows.

## Problems

1. UI standards exist but are not yet applied evenly.
2. The feature menu is still a flat grid rather than a categorized product navigation model.
3. Table, filter, toolbar, and action placement vary by module.
4. Status badge colors are inconsistent across modules.
5. Mobile behavior relies mostly on responsive tables and module-specific exceptions.
6. Coming-soon modules share the same visual surface as active modules.
7. Permission feedback is not yet standardized inside modules.

## Design Direction

Use the current Apps Script architecture and Bootstrap behavior, then layer TopChurchPlus components on top.

Preferred design direction:

- Keep Bootstrap for layout utilities, grid, modal, tabs, and form primitives.
- Use TopChurchPlus `.tc-*` classes for final visual expression.
- Prefer incremental module-by-module adoption.
- Avoid new frontend framework migration until product IA and core patterns are stable.

## Phase 0: Audit And Mapping

Goal:

Create a precise UI adoption checklist before editing code.

Tasks:

- Map each module to current use of `.tc-page`, `.tc-card`, `.tc-table`, `.tc-badge-*`, loading state, and empty state.
- Build a status-to-badge mapping for Project, Finance, QT, Asset, Venue, QRCode, Forms, Pastoral, and Attendance.
- Identify pages where tables are placed directly under view roots.
- Identify high-frequency modals and their footer/error patterns.

Priority:

High

Suggested output:

- `docs/product-design/UI_COMPONENT_ADOPTION_AUDIT.md`
- `docs/product-design/STATUS_BADGE_MAPPING.md`

Not recommended in this phase:

- Do not change UI code yet.
- Do not rename modules.
- Do not change permissions.

## Phase 1: Navigation Category Layer

Goal:

Improve discoverability without touching module internals.

Recommended implementation:

- Add category metadata to feature definitions or a parallel navigation mapping.
- Render feature cards grouped by category.
- Keep existing role filtering, usage sorting, pinning, and custom order.
- Separate coming-soon modules into a lower-priority section.
- Preserve keyboard access for cards.

Suggested categories:

- 行政類
- 牧養類
- 總務類
- 資訊類
- 媒體類
- 系統管理類

Priority:

High

Potential files if implemented later:

- `Script_FeatureConfig.html`
- `Script_Login.html`
- `Style.html`

Verification:

- Admin can still see all authorized modules.
- General users only see authorized modules.
- Pinned and usage-sorted features still work.
- Coming-soon entries remain visually distinct.

Not recommended in this phase:

- Do not add a sidebar yet.
- Do not create nested route architecture.
- Do not introduce a frontend framework.

## Phase 2: Pilot Design System Rollout

Goal:

Prove the page shell, table, badge, loading, and empty-state standards on a small set of modules.

Recommended pilot modules:

1. QT Management
2. Email Service Management

Reason:

- These modules already use newer `.tc-*` patterns.
- They are operationally important and contain dashboards, filters, tables, status, and admin actions.
- They exercise error, quota, audit, inventory, and queue states.

Priority:

High

Expected patterns:

- `.tc-page`
- `.tc-page-header`
- `.tc-page-toolbar`
- `.tc-page-kpi-area`
- `.tc-page-filter-area`
- `.tc-page-content`
- `.tc-card`
- `.tc-table`
- `.tc-badge-*`
- `.tc-loading-state`
- `.tc-empty-state`

Not recommended in this phase:

- Do not change QT payment, fulfillment, reservation, Line Bot, transfer, or forecast logic.
- Do not change Email Queue sending behavior.

## Phase 3: Status Badge Standardization

Goal:

Make business states readable and consistent.

Tasks:

- Replace module-specific status badge rendering with semantic `.tc-badge-*` where safe.
- Document status mapping before code changes.
- Keep status text short and domain-appropriate.

Priority:

High

Risk:

Status color changes can imply business meaning. Confirm mappings before implementation.

Not recommended in this phase:

- Do not change status values in database or API.
- Do not alter workflow transitions.

## Phase 4: Table And Filter Standardization

Goal:

Make list pages easier to scan and operate.

Tasks:

- Standardize filter area placement.
- Standardize search/reset button alignment.
- Standardize row action alignment.
- Add consistent loading, empty, and error rows.
- Define table-to-card behavior for mobile when horizontal scroll is not enough.

Priority:

Medium

Candidate modules:

- Finance
- Forms
- Asset
- Admin Supply
- Venue
- Attendance
- Pastoral

Not recommended in this phase:

- Do not rebuild data fetching.
- Do not change API payloads.

## Phase 5: Forms And Modal Standardization

Goal:

Make create/edit flows predictable.

Tasks:

- Standardize modal footer action order.
- Standardize validation and error message placement.
- Standardize required-field markers.
- Standardize readonly/disabled field explanations.
- Use confirmation dialogs for destructive actions.

Priority:

Medium

Not recommended in this phase:

- Do not change business validation rules unless separately requested.

## Phase 6: Mobile First Improvements

Goal:

Prepare the admin system for field use and future LIFF/App surfaces.

Tasks:

- Define when a dense table becomes a card list.
- Keep key actions reachable on mobile.
- Improve filter stacking and modal scrolling.
- Validate tap target size.
- Review pages where edit actions are hidden on mobile.

Priority:

Medium

Not recommended in this phase:

- Do not treat internal admin mobile UX as identical to LIFF member portal UX.
- Do not use backend account roles to drive pastoral/member-facing UI.

## Phase 7: Future Product Scale

Goal:

Prepare for Line Bot, LIFF, Education, Baptism, Attendance, and App expansion.

Tasks:

- Create clear internal admin vs member-facing navigation labels.
- Keep Pastoral Member as the formal identity in member-facing workflows.
- Define module ownership before adding new top-level cards.
- Add product copy rules for identity-sensitive workflows.

Priority:

Low to Medium

Not recommended in this phase:

- Do not add Baptism as an isolated module before its Pastoral/Education/Form relationship is designed.
- Do not merge Line App system configuration with pastoral member operations in one unclear screen.

## First Implementation Recommendation

Start with a no-risk navigation proof-of-concept:

1. Add category metadata for existing feature keys.
2. Render categorized sections in the feature menu.
3. Keep current role filtering, pinning, and usage sorting behavior.
4. Keep all existing feature actions unchanged.
5. Separate coming-soon entries visually.

Why this first:

- It improves discoverability immediately.
- It does not touch API, database, schema, payment, fulfillment, Line Bot webhook, or module internals.
- It creates a better frame for later module-by-module UI cleanup.

## Not Recommended Immediately

- Full UI rewrite.
- New frontend framework.
- New routing system.
- Production navigation replacement without a small proof-of-concept.
- Cross-module workflow automation before navigation labels are clear.
