# Pastoral Platform Audit V1

Status: Audit / Planning Only
Last updated: 2026-06-14
Source basis: current repository inspection of `api/src/modules/pastoral`, `attendance`, `education`, `linebot`, `liff`, Apps Script UI files, database migrations, `PROJECT_CONTEXT_SNAPSHOT.md`, and `MODULE_OWNERSHIP_REGISTRY.md`.

This document records current state and gaps. It does not authorize schema, API, permission, or business logic changes.

## Executive Summary

TopChurchPlus already has the foundation for a Pastoral Platform:

```text
Pastoral Member
  -> Attendance
  -> Education
  -> Line User
  -> LIFF Member Center
```

The strongest existing foundation is that Attendance and Education API queries already join through `pastoral_members.id`. LINE / LIFF also has mapping structures (`line_users.member_id`, `pastoral_members.line_user_id`, `member_accounts`, `identity_providers`) and the LIFF member center requires binding before showing member data.

The main gaps are not raw table existence. The gaps are completion, consistency, and operational readiness:

- Pastoral Member is mostly established as the formal member subject, but duplicated mapping fields create consistency risk.
- Attendance currently appears report/read-oriented; write/import/rollcall paths need clearer ownership.
- Education has course and enrollment foundations, but learning path, graduation, and member journey completion are incomplete.
- LINE / LIFF binding exists, including pending review, but needs stronger duplicate resolution, audit visibility, and future OAuth abstraction.
- Summary tables for LIFF leader center (`attendance_summary`, `course_summary`) exist but require a documented refresh/source-of-truth strategy.

## Current State Matrix

| Area | API | DB | UI | Completion | Risk |
| --- | --- | --- | --- | --- | --- |
| Pastoral Member | CRUD, options, duplicate-name, detail, soft delete | Mature pastoral schema with member, contacts, address, faith, group, files, care | List/detail/edit/group panels | 75% | High identity/data sensitivity |
| Attendance | Options, small group stats, group members, meetings stats, member recent | Events, types, records, summary tables | Stats/list-focused UI | 60% | Scope and source-of-truth clarity |
| Education | Categories, courses, detail, save course, class forecast | Categories, courses, enrollments, course summary | Course list/detail/forecast UI | 55% | Enrollment workflow incomplete |
| Line User | Dashboard, users, binding requests, rich menu, events | `line_users`, LINE module tables, binding requests | Admin Line Bot UI | 70% | Binding conflicts and identity consistency |
| LIFF | Config, session, me, bind-member, portal links, member center, leader center | `line_liff_sessions`, `identity_providers`, `member_accounts` | Public LIFF app under `api/public/liff` | 65% | Future app/OAuth hardening |

## Pastoral Member Audit

### Current State

API:

- `GET /pastoral/options`
- `GET /pastoral/members`
- `GET /pastoral/members/duplicate-name`
- `GET /pastoral/members/:memberId`
- `POST /pastoral/members`
- `PUT /pastoral/members/:memberId`
- `DELETE /pastoral/members/:memberId`

DB:

- `pastoral_members`
- `pastoral_member_contacts`
- `pastoral_member_addresses`
- `pastoral_member_faith`
- `pastoral_member_group_assignments`
- `pastoral_groups`
- `pastoral_group_closure`
- `pastoral_group_leaders`
- `pastoral_care_records`
- `pastoral_member_files`
- `member_accounts`
- `identity_providers`
- `line_users`

UI:

- `Pastoral.html`
- `Script_Pastoral.html`
- Member list, mobile cards, group list, detail panels, inline edit, files, care records, attendance and education status panels.

### Gap Analysis

- Member detail aggregates attendance and education, but the degree of UI completeness for editing care records and related history should be verified in browser.
- `pastoral_members.line_user_id` and `line_users.member_id` both exist. This helps compatibility but creates dual-write consistency risk.
- `followup_staff_id` joins `accounts`, which is acceptable as assignment metadata, but must not become the member identity.
- Pastoral scope uses `account_pastoral_church_permissions`, which is aligned with Identity Boundary v2 but needs regression tests.

### Missing Features

- Member merge / duplicate resolution workflow.
- Binding conflict review from Pastoral member view.
- Formal member lifecycle state transitions beyond `is_active`.
- Clear audit timeline for member identity, binding, group, and education changes.
- Future OAuth provider management at member profile level.

### Priority

High before 8月:

- Mapping consistency checks.
- Member detail identity panel.
- Duplicate/member binding review workflow.

## Attendance Audit

### Current State

API:

- `GET /attendance/options`
- `GET /attendance/small-groups`
- `GET /attendance/small-groups/:groupId/members`
- `GET /attendance/meetings`
- `GET /attendance/members/:memberId/recent`

DB:

- `attendance_events`
- `attendance_types`
- `attendance_records`
- `attendance_summary`
- `pastoral_members`
- `pastoral_groups`
- `pastoral_member_group_assignments`

UI:

- `Attendance.html`
- `Script_Attendance.html`
- Group stats, meeting stats, member recent attendance display.

### Gap Analysis

- Attendance reports already join through `pastoral_members.id`.
- Current API surface is read/report oriented.
- Write path, rollcall import, QRCode self-check-in, and Line/LIFF check-in ownership are not clearly unified in this audit.
- `attendance_summary` is used by LIFF leader center, but its refresh process is not clear from route inspection.

### Missing Features

- Standard write/recording API for attendance, if not intentionally delegated to another module.
- Reconciliation between raw `attendance_records` and `attendance_summary`.
- Member attendance timeline in Pastoral detail that can drill into records.
- Clear boundary for Qrcode/Line attendance inputs.

### Priority

High before 8月:

- Define attendance source-of-truth and summary refresh.
- Confirm all attendance records point to Pastoral Member, not Line User or Account.

## Education Audit

### Current State

API:

- `GET /education/course-categories`
- `GET /education/courses`
- `GET /education/class-forecast`
- `GET /education/courses/:courseId`
- `POST /education/courses`
- `PUT /education/courses/:courseId`

DB:

- `education_course_categories`
- `education_courses`
- `education_enrollments`
- `course_summary`
- `pastoral_members`

UI:

- `Education.html`
- `Script_Education.html`
- Course list, course detail, forecast-oriented views.

### Gap Analysis

- Enrollments join `education_enrollments.member_id` to `pastoral_members.id`, which is correct.
- Course save exists, but enrollment creation/update/completion workflow was not visible as a dedicated API in the scanned route list.
- Learning path / graduation / equipment path is implied by forecast logic, not yet formalized as a domain workflow.
- `course_summary` is used by LIFF leader center, but refresh/source process is not clear.

### Missing Features

- Enrollment management API/UI.
- Completion/graduation workflow.
- Education path definition and progression rules.
- Member education journey panel with actionable next step.

### Priority

Medium before 8月:

- Make existing course/enrollment status visible and reliable.
- Defer full learning-path engine unless explicitly prioritized.

## Line User Audit

### Current State

API:

- Line Bot dashboard, users, channels, links, modules, rich menus, events, config, notification templates, menu items, audit logs, binding requests, rich menu sync.
- Webhook receiver at `/linebot/webhook`.

DB:

- `line_users`
- `line_bot_channels`
- `line_bot_module_settings`
- `line_bot_links`
- `line_bot_rich_menus`
- `line_bot_webhook_events`
- `line_binding_requests`
- `line_rich_menu_assignments`
- `menu_items`
- `identity_providers`
- `member_accounts`

### Gap Analysis

- Admin binding approval flow exists.
- LIFF binding can auto-bind when one matching member is found or create pending review.
- `pastoral_members.line_user_id`, `line_users.member_id`, `member_accounts`, and `identity_providers` are all updated in binding flows.
- Multiple mapping surfaces mean consistency checks are required.
- LINE User is generally treated as entry identity, not formal member, but this must be guarded in future work.

### Missing Features

- Binding conflict dashboard from Pastoral perspective.
- Consistency report for mapping tables.
- Safe unbind / rebind lifecycle.
- Future provider abstraction for Google / Apple / App login.

### Priority

High before 8月:

- Binding consistency and review flow.
- Do not expand LINE features before mapping is operationally reliable.

## LIFF Audit

### Current State

API:

- `GET /liff`
- `GET /liff/config`
- `POST /liff/session`
- `GET /liff/me`
- `POST /liff/bind-member`
- `GET /liff/portal-links`
- `GET /liff/member-center`
- `GET /liff/leader-center`

DB:

- `line_liff_sessions`
- `line_users`
- `pastoral_members`
- `member_accounts`
- `identity_providers`
- `menu_items`
- `attendance_summary`
- `course_summary`

### Gap Analysis

- LIFF session and member binding are implemented.
- Member center requires bound Pastoral Member.
- Leader center checks leader scope through Pastoral Member title/group tables.
- Current LIFF center appears data-consumption oriented, not a full member app.
- Future app readiness is promising because `identity_providers` exists, but current code is LINE-first.

### Missing Features

- Formal session revocation / device management UI.
- Provider-agnostic identity abstraction in member center.
- Member-facing profile correction/request workflow.
- Clear summary refresh contract for leader center.

### Priority

High before 8月:

- Stabilize LINE LIFF member center and binding.
- Defer multi-provider mobile app auth until after core Pastoral Member integration is stable.

## Identity Boundary Risk

| Risk | Current observation | Severity | Recommendation |
| --- | --- | --- | --- |
| Line User = Member confusion | Binding flows map LINE to Pastoral Member, but some tables store both directions. | High | Add consistency checks and never query pastoral facts directly by Line User without resolving member. |
| Account = Member confusion | Pastoral uses `followup_staff_id` and role access; not the member identity. | Medium | Keep Account as admin/operator only. |
| Pastoral scope by Account Role only | Code uses `account_pastoral_church_permissions` for church scope, which is good. | Medium | Add regression checks for non-admin pastoral users. |
| Future OAuth coupling | `identity_providers` exists but flow is LINE-first. | Medium | Treat providers as login/mapping layer, not member entity. |

## Data Ownership Risk

- Pastoral Member should own formal member profile, group, attendance, education, care state.
- Line User should own LINE identity, interaction metadata, rich menu state.
- Account should own admin operator identity and system permissions.
- Attendance and Education should reference `pastoral_members.id`.
- Summary tables should be derived read models, not source of truth.

## Future App Readiness

Current readiness: Medium.

Strengths:

- `identity_providers` can support future Google / Apple / App identities.
- `member_accounts` creates a member-facing account bridge separate from admin `accounts`.
- LIFF APIs already separate session identity from member identity.

Gaps:

- Provider-agnostic authentication APIs are not yet visible.
- App session lifecycle, revocation, and consent are not formalized.
- Member center needs stable DTOs and versioned member-facing API contracts.

## Priority Summary

| Priority | Work |
| --- | --- |
| P0 | Preserve Identity Boundary v2; no Account=Member or Line User=Member shortcuts. |
| P1 | Add mapping consistency audit and binding review improvements. |
| P1 | Define Attendance source-of-truth and summary refresh strategy. |
| P1 | Verify Pastoral scope regression for all pastoral-facing APIs. |
| P2 | Complete Education enrollment/completion workflow. |
| P2 | Improve LIFF member center data completeness. |
| P3 | Future OAuth/mobile app provider abstraction. |
