# TopChurchPlus Product Design Handoff Template

Status: Product Design Governance V1
Last updated: 2026-06-14
Scope: Template for new feature design handoff before implementation.

## How To Use

Copy this template into a feature planning document or task request before implementation.

Do not start coding until the required sections are clear enough to identify affected UI, API, database, permission, and identity boundaries.

## Template

### Feature Key

`{feature_key}`

Examples:

- `qt`
- `forms`
- `pastoral`
- `linebot`
- `email_service`

### User Problem

Describe the real user problem in one or two paragraphs.

Questions:

- Who is blocked?
- What are they trying to do?
- What is currently slow, confusing, duplicated, or risky?

### Target Users

List user groups:

- 系統管理者
- 行政同工
- 牧養同工
- 小組長
- 區牧
- 財務同工
- 媒體同工
- 一般會友
- LINE / LIFF 使用者

### Current Pain Point

Describe the current workflow and pain.

Include:

- Current module.
- Current screen.
- Current workaround.
- Current risk.

### Desired User Flow

Write the expected flow as steps:

1. User opens `{module}`.
2. User sees `{state}`.
3. User performs `{action}`.
4. System returns `{feedback}`.
5. User can continue to `{next step}`.

### Data Boundary

Identify involved data domains:

- Account Domain.
- Pastoral Domain.
- Line User Domain.
- Future Identity Provider Layer.
- Finance.
- QT.
- Forms.
- BPM.
- Mail Queue.
- Files/Documents.

State which entity is the source of truth.

### Permission Boundary

Define:

- Who can view.
- Who can create.
- Who can edit.
- Who can approve.
- Who can delete/archive.
- Who can export.

For pastoral/member-facing features:

- Do not rely on backend `accounts.role` for pastoral access.
- Define pastoral scope explicitly.

### UI Requirement

List required UI elements:

- Page category.
- Page title.
- Toolbar actions.
- KPI cards.
- Filters.
- Table columns.
- Form fields.
- Modal behavior.
- Status badges.
- Loading state.
- Empty state.
- Error state.
- Permission state.
- Mobile behavior.

### API Requirement

List API needs:

- Existing API routes to use.
- New API routes needed.
- Request payload.
- Response payload.
- Error cases.
- Audit log requirement.

If no API change is needed, state:

`No API change expected.`

### Database Requirement

List database impact:

- Existing tables.
- New tables.
- New columns.
- Constraints.
- Indexes.
- Migration needed: yes/no.
- Backfill needed: yes/no.

If no schema change is needed, state:

`No schema change expected.`

### Out Of Scope

List what must not be included in this feature.

Examples:

- No payment flow changes.
- No fulfillment changes.
- No Line Bot webhook changes.
- No schema migration.
- No legacy backfill.
- No deployment.

### Acceptance Criteria

Use testable statements:

1. User can `{action}`.
2. System shows `{state}`.
3. Unauthorized user sees `{permission behavior}`.
4. Loading state appears while data is fetched.
5. Empty state appears when there are no records.
6. Error state appears when API fails.
7. Audit log is written when required.
8. Identity Boundary is preserved.

### Risk Notes

List known risks:

- Identity Boundary risk.
- Data consistency risk.
- Permission risk.
- Migration risk.
- Apps Script limitation.
- Mobile UX risk.
- Operational/deployment risk.

### Verification Plan

List commands or checks:

- `git diff --check`
- `tools/check-scripts.cmd`
- `tools/check-api.cmd -SkipHealth`
- `tests/api/run-smoke.cmd`
- Manual UI check.
- API smoke check.
- PostgreSQL MCP schema verification, if database impact exists.

### Documentation Updates

List docs that must be updated:

- `docs/API_CATALOG.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/CURRENT_ARCHITECTURE.md`
- `docs/HANDOFF.md`
- `docs/LESSONS_LEARNED.md`
- `docs/product-design/*`
