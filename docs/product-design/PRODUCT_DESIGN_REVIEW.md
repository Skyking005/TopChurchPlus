# TopChurchPlus Product Design Review

Status: Draft / Product Design Review
Last updated: 2026-06-14
Scope: Product and UI/UX analysis only. This document does not change production behavior.

## Sources Reviewed

- `AGENTS.md`
- `docs/INDEX.md`
- `docs/modules/README.md`
- `docs/architecture/UI_DESIGN_SYSTEM_V1.md`
- `docs/IDENTITY_BOUNDARY_V2.md`
- `plan/INDEX.md`
- `Script_FeatureConfig.html`
- `Script_Login.html`
- `Style.html`
- Main Apps Script UI partials such as `Forms.html`, `Qt.html`, `EmailService.html`, `Pastoral.html`, `Attendance.html`, `Asset.html`, `AdminSupply.html`, `Venue.html`, `Counter.html`, `LineBot.html`, and related `Script_*.html` files.

## Current Observation

TopChurchPlus is already moving toward a modern SaaS-style admin system. The project has an official UI Design System V1, design tokens, `.tc-page`, `.tc-card`, `.tc-kpi-card`, `.tc-table`, `.tc-badge-*`, loading state, and empty state primitives in `Style.html`. The feature menu also supports role-based access, usage-based sorting, pinning, custom ordering, keyboard activation, and coming-soon labels.

The product surface is now large: `Script_FeatureConfig.html` defines 22 feature entries. Active modules include Project, Finance, Admin Supply, Asset, Venue, Zoom, Sunday Message, Meeting, Forms, Counter, QRCode, QT, Line App, Email Service, Pastoral, Education, Attendance, System, and Dev Management. Media, Worship, and Serving are configured as coming-soon entries.

The main product risk is no longer a lack of features. The risk is discoverability, role-based clarity, and consistent interaction patterns across a growing Apps Script single-page admin surface.

## Strengths

- Role-based feature access already exists, and the UI can hide unauthorized systems.
- Feature cards include descriptions, access mode labels, usage hints, pinned state, and coming-soon state.
- UI Design System V1 is already documented and partially implemented in `Style.html`.
- QT and Email Service already show newer design-system adoption through `.tc-page`, KPI cards, `.tc-table`, and `.tc-badge-*`.
- Identity Boundary v2 is clearly documented: Pastoral Domain and Administrative Domain must remain separated.
- The product has a strong operational model: admin workflows, pastoral workflows, mail queue, Line/LIFF, QT, and system management are all represented as modules.

## Key UX Risks

### 1. Information Architecture Is Too Flat

The current feature menu is a flat grid of role-allowed feature cards. This works for a small system, but it becomes harder to scan when administrators see 18-22 entries. Frequent-use sorting and pinning help individual users, but they do not create a shared product mental model.

Risk:

- New users may not know whether a task belongs in Counter, QT, Finance, Forms, Line App, or Pastoral.
- Coming-soon items live beside operational items, which can make the system feel larger but less predictable.
- System/admin tools compete visually with daily ministry operations.

### 2. Module Boundaries Are Not Always Obvious

Several modules overlap by workflow:

- QT appears in both Counter operations and QT Management.
- QRCode, Forms, Attendance, and Line App can all participate in event/member flows.
- Meeting can be independent or project-related.
- Sunday Message can feel like media/content, pastoral tracking, or admin scheduling.
- Email Service and Line App are infrastructure-like systems but also support user-facing communication.

Risk:

- Users may choose the wrong entry point.
- Future LIFF/App features may blur Administrative Domain and Pastoral Domain if navigation and copy do not reinforce Identity Boundary v2.

### 3. UI Consistency Is Partially Adopted

The design system exists, but current UI files still show mixed patterns:

- Some pages use `.tc-table`; many still use raw Bootstrap `table`, `card`, and `badge` classes.
- Status colors vary across modules: `.tc-badge-*`, `.status-badge`, `.asset-status-badge`, `.venue-status-badge`, Bootstrap `badge bg-*`, and subtle Bootstrap badges are all present.
- Page shells vary by module. Some pages start with tabs or tables directly rather than the full `.tc-page` structure.
- Error messages usually appear as `text-danger small`, but success, warning, and empty states are not consistently standardized.

Risk:

- Users must relearn table, filter, and action placement across modules.
- Status colors can carry different meanings in different systems.
- Mobile behavior becomes unpredictable as each module solves layout differently.

### 4. Mobile Experience Is Supported But Not Yet Productized

The current CSS includes mobile rules and some module-specific mobile containers such as `mobileAssetList` and `mobileVenueResourceList`. Tables are generally wrapped in `.table-responsive`, and mobile tables receive a minimum width.

Risk:

- Mobile users may face horizontal scrolling across most data-heavy modules.
- Action bars and edit buttons may be hidden on mobile in some contexts, which can block legitimate field workflows.
- Filters, table rows, and modals need consistent mobile patterns before LIFF/App grows.

### 5. Permission UX Needs Clearer Feedback

Feature cards show access labels such as read/edit, and unauthorized features are hidden. However, in-module readonly states, disabled actions, and permission explanations are inconsistent.

Risk:

- Users may not understand whether an action is unavailable because of role, module state, missing setup, or system error.
- Pastoral-facing workflows must avoid implying that backend account role equals pastoral authority.

## Role-Based Experience Review

### 行政同工

Common flows:

- Project, Meeting, Forms, Venue, Zoom, Counter, QRCode, QT, Admin Supply.

Current friction:

- Related operational tasks are spread across many top-level cards.
- Counter, QRCode, Forms, QT, and Attendance can all be part of event-day work but are not grouped as a workflow.
- Search/filter layouts vary per module.

Recommendation:

- Provide an `行政類` category with daily operations first: Project, Meeting, Forms, Counter, QRCode, QT, Venue, Zoom.
- Add task-oriented grouping later, such as `活動與報到`, `場地與會議`, `表單與資料收集`.

### 牧養同工

Common flows:

- Pastoral, Attendance, Education, Line App, Forms, QT/member-facing references.

Current friction:

- Pastoral Domain rules are documented, but the UI navigation does not yet visually separate pastoral-facing identity workflows from administrative account tools.
- Line App management appears as a system feature but affects member-facing entry.

Recommendation:

- Put Pastoral, Attendance, Education, and member-facing Line/LIFF flows into `牧養類`.
- Use copy that says LINE User is an entry channel and Pastoral Member is the formal member entity.
- Avoid account-role wording in pastoral screens.

### 財務同工

Common flows:

- Finance, QT payment review, Counter payment, purchase-related documents, reports.

Current friction:

- Finance is its own module, but QT and Counter payment actions are operationally related.
- Payment review and reservation effects are sensitive and should not be hidden behind generic labels.

Recommendation:

- Classify Finance under `行政類` with a `財務` sub-area, or introduce a secondary finance filter within Admin category.
- Use consistent payment status badges across Finance, QT, and Counter.

### 系統管理員

Common flows:

- System Management, Config Key Management, Email Service, Line App setup, Dev Management, permissions, parameters.

Current friction:

- System-level tools appear beside normal work modules.
- Config, Email Queue, Line setup, and Dev Management require high confidence and clear warnings.

Recommendation:

- Place these under `系統管理類` and visually separate them from daily operations.
- Use consistent warning and permission-required states.
- Keep operational modules visible but less dominant for super admins.

## UI Consistency Review

### Buttons

Observation:

- Bootstrap buttons are used widely.
- Design System V1 defines button rules, but module code still mixes `btn-success`, `btn-primary`, `btn-outline-primary`, and icon-free text buttons.

Recommendation:

- Define action hierarchy by intent:
  - Primary: one main action per page or modal.
  - Secondary: refresh, search, return, copy.
  - Danger: archive/delete/cancel destructive flows.
- Add Tabler Icons gradually to high-frequency toolbar buttons.

### Forms

Observation:

- Forms are mostly Bootstrap-based and functional.
- Required labels, validation messages, field grouping, and readonly/disabled explanations are not fully standardized.

Recommendation:

- Standardize label placement, required marker, validation message, and helper text.
- Put large forms in `.tc-page-content` or `.tc-card` with predictable action placement.

### Modals

Observation:

- Bootstrap modal structure is used consistently, but modal size, footer actions, and error placement vary.

Recommendation:

- Keep Bootstrap behavior, but standardize footer order: secondary/cancel left or first, primary action right or last, destructive action visually separated.
- Add a consistent inline error block inside modal body or footer.

### Status Colors

Observation:

- Multiple badge systems coexist.

Recommendation:

- Migrate status presentation to `.tc-badge-success`, `.tc-badge-warning`, `.tc-badge-danger`, `.tc-badge-info`, and `.tc-badge-secondary`.
- Create a module-by-module status mapping before changing UI code.

### Tables

Observation:

- Most modules use responsive wrappers.
- `.tc-table` exists but is not universal.

Recommendation:

- Standardize table header, row hover, empty state, loading state, error state, and row action alignment.
- For mobile, define when a table should become a stacked card list instead of only horizontal scroll.

### Permission Hints

Observation:

- Feature cards show access mode, but inside modules permission messaging is inconsistent.

Recommendation:

- Use three standard states:
  - Hidden action: user cannot use this feature.
  - Disabled action with reason: user can see context but cannot act.
  - Readonly banner: whole module is readonly.

## Future Scalability Review

### Line Bot / LIFF / App

The architecture can support these surfaces if the navigation and copy reinforce Identity Boundary v2. Member-facing features should be framed around Pastoral Member identity, not backend account role.

Need:

- Separate internal admin management from member-facing entry.
- Keep Line User, LIFF session, and Pastoral Member mapping explicit in UI copy.
- Avoid mixing system configuration and pastoral care tasks in one navigation area.

### Education System

Education is currently an active feature with course/class concepts. It should be classified under `牧養類`, with possible cross-links from member profile and attendance.

### Baptism System

Baptism is not currently visible as a configured top-level feature. It should not be added as an isolated card until its relationship to Pastoral Member, Education, Forms, and Attendance is defined.

### Attendance

Attendance is active and should become a key pastoral dashboard input. Its reports should share status, filter, and table conventions with Pastoral and Education.

## Domain Boundary Review

This review is based on `docs/IDENTITY_BOUNDARY_V2.md`, `docs/CURRENT_ARCHITECTURE.md`, `docs/DATABASE_SCHEMA.md`, and visible module/API references. It is a product-design risk review, not a database audit.

### Account Domain

Purpose:

- Backend admin login.
- Role and feature access.
- System usage logs.
- Admin audit trails.

Aligned modules:

- System Management.
- Config Key Management.
- Email Service Management.
- Dev Management.
- Feature Permission Management.
- Admin-only API routes.

Risk:

- Account role is valid for admin feature access, but must not become pastoral authority.

Recommendation:

- Keep account role language inside admin/system areas.
- In pastoral and member-facing flows, use pastoral scope and Pastoral Member language.

### Pastoral Domain

Purpose:

- Formal member identity.
- Pastoral group, care, attendance, education, and member records.

Aligned modules:

- Pastoral.
- Attendance.
- Education.
- Pastoral-facing portions of Line App and LIFF.
- Forms when responses map to members.

Risk:

- Cross-module features can accidentally treat user account, Line identity, or form respondent as the formal member entity.

Recommendation:

- Use Pastoral Member as the hub for member-related workflows.
- Require explicit mapping when Forms, Line, QRCode, QT, Attendance, or Education touch member data.

### Line User Domain

Purpose:

- LINE identity.
- LIFF session entry.
- Rich Menu, binding requests, events, and member portal access.

Aligned modules:

- Line App management.
- LIFF.
- Line Bot webhook.

Potential coupling risks:

- `line_users` and `pastoral_members` appear related in multiple routes and docs. If both sides store mapping fields, future changes must define one source of truth or strict synchronization rules.
- Line App management contains both member-facing operations and technical setup. These should be visually separated.

Recommendation:

- Display Line User as entry identity, not formal member identity.
- Make binding state explicit: unbound, pending, bound, rejected.
- Separate `Line member operations` from `Line technical setup`.

### Future Identity Provider Layer

Purpose:

- Future Google Login, Apple Login, Mobile App identity, OAuth, and other provider identities.

Current state:

- The product already has enough identity complexity that future providers should not be bolted directly onto Pastoral Member or admin Account.

Recommendation:

- Treat future providers as an Identity Provider Layer.
- Map provider identities to either admin Account or Pastoral Member through explicit link tables/services.
- Never assume a provider login automatically grants pastoral scope.

### Boundary Alignment Table

| Module | Boundary Alignment | Risk Level | Notes |
| --- | --- | --- | --- |
| System | Account Domain | Low | Admin configuration surface. |
| Email Service | Account Domain / Infrastructure | Low | Admin-only management and queue monitoring. |
| Dev Management | Account Domain / Internal tooling | Low | Should remain internal. |
| Pastoral | Pastoral Domain | Medium | Must avoid account-role-based pastoral authority. |
| Attendance | Pastoral Domain | Medium | Should use Pastoral Member and pastoral scope. |
| Education | Pastoral Domain | Medium | Member learning records should map to Pastoral Member. |
| Line App | Line User + Pastoral Domain | High | Needs clear split between LINE identity, binding, and Pastoral Member. |
| LIFF | Line User + Pastoral Domain | High | Must be mobile-first and identity-safe. |
| Forms | Administrative + Pastoral when public/member forms | Medium | Public/LIFF forms need explicit member mapping rules. |
| QT | Administrative + Finance + Pastoral references | Medium | Member/order mapping and payment/inventory states need strict boundaries. |
| Counter | Administrative operations | Medium | Touches payment, QT, QRCode, and event-day identity. |
| QRCode | Administrative + Attendance/Line relation | Medium | Check-in identity interpretation must be clear. |
| Finance | Administrative / Finance | Medium | Payment states and audit trails are sensitive. |
| Asset/Admin Supply/Venue/Zoom | General affairs | Low | Mostly resource management. |
| Media/Worship/Sunday Message | Media/content | Low to Medium | Future file/content workflow should share document patterns. |

### Suspected Boundary Risks To Review Before Implementation

- Line User and Pastoral Member mapping source of truth.
- Forms that can be filled by LIFF/member users and later mapped to Pastoral Member.
- QRCode check-in when a scan identifies a Line User but attendance requires Pastoral Member.
- QT orders involving member references, payment state, and future Line/LIFF ordering.
- Future Baptism feature if it duplicates member identity instead of using Pastoral Member.

## Product Architecture And Scalability Review

### Suitable As Core System

- Account, permissions, config keys, audit logs.
- Pastoral Member and pastoral scope.
- Feature catalog and navigation.
- Common files/documents.
- BPM/workflow platform.

Reason:

These define shared identity, governance, and cross-module infrastructure.

### Suitable As Independent Subsystems

- QT System.
- Finance.
- Line/LIFF member entry.
- Mail Queue.
- General affairs resources: Asset, Admin Supply, Venue, Zoom.
- Project/Meeting/Forms/Event operations.

Reason:

Each has its own workflows, statuses, and data rules, but should still use shared identity, audit, and design system rules.

### Future Service Split Candidates

Only consider service split after workflows stabilize:

| Candidate | Split Readiness | Reason |
| --- | --- | --- |
| Mail Queue | Medium | Clear infrastructure boundary and quota rules. |
| Line/LIFF | Medium | External integration, webhook, and member entry surface. |
| QT | Low to Medium | Complex, but still actively evolving payment/inventory boundaries. |
| BPM Engine | Medium | Platform service potential after workflow definitions mature. |
| Documents | Medium | File generation/storage can become shared infrastructure. |

### Modules To Govern First

1. Line App / LIFF.
2. Pastoral / Attendance / Education.
3. QT / Counter / Finance.
4. Forms / Shortlinks / Public form flows.
5. System / Config / Email Service.

Reason:

These areas have the highest risk of identity coupling, payment confusion, repeated UI patterns, or operational errors.

## Recommended Priorities

### High Priority

1. Add product-level navigation categories without changing module internals.
2. Separate active modules from coming-soon modules.
3. Standardize status badge semantics and create a migration map.
4. Choose two pilot modules for Design System rollout: QT and Email Service are good candidates because they already use newer `.tc-*` patterns.
5. Add readonly/permission UX rules for module screens.

### Medium Priority

1. Apply `.tc-page` shell to high-traffic modules.
2. Standardize table loading, empty, and error states.
3. Standardize modal action layout.
4. Create mobile table/card rules for operational modules.
5. Review labels and naming consistency across feature cards.

### Low Priority

1. Visual polish after structure is stable.
2. Motion and micro-interactions.
3. Advanced dashboard personalization.
4. Cross-module search.

## Not Recommended Immediately

- Do not introduce React, Vue, Tailwind, or Material migration as a first step.
- Do not redesign every module at once.
- Do not merge Administrative Domain and Pastoral Domain navigation or permissions.
- Do not add new top-level modules before classification is stable.
- Do not replace Bootstrap behavior unless there is a clear maintenance reason.
