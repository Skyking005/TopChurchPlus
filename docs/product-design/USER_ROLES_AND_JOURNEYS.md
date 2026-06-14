# TopChurchPlus User Roles And Journeys

Status: Product Design Governance V1
Last updated: 2026-06-14
Scope: Role-based journey inventory and UX risk review.

## Purpose

This document helps future developers and AI agents understand who uses TopChurchPlus, what each role is trying to accomplish, where friction appears, and which modules are involved.

It should be read before designing new features or changing navigation.

## 系統管理者

### Main Tasks

- Manage accounts, roles, feature permissions, parameters, and config keys.
- Monitor Mail Queue, LINE integration, API health, and operational settings.
- Maintain system-level auditability and safe configuration.

### Use Context

System administrators work inside the internal admin surface. They need confidence, visibility, and guardrails more than decorative UI.

### Common Pain Points

- System Management, Email Service, Line App setup, and Dev Management are spread across separate feature cards.
- Trigger permission, Apps Script authorization, API key, and config key errors need clear recovery messages.
- Sensitive settings must be masked and audited.

### Functional Needs

- A clear `系統管理類` navigation group.
- Super-admin-only access to risky tools.
- Consistent health, warning, permission-required, and configuration-missing states.
- Clear before/after audit metadata for sensitive changes.

### Related Modules

- `system`
- `email_service`
- `linebot`
- `dev_management`
- `workflow`
- `auth`
- `mail`

## 行政同工

### Main Tasks

- Manage projects, meetings, forms, venues, Zoom reservations, event check-in, counter tasks, and QT operations.
- Search records and perform day-to-day coordination.

### Use Context

Administrative workers need speed, predictable navigation, and low friction across many small operational tasks.

### Common Pain Points

- Many tasks are top-level modules with no product grouping.
- Forms, QRCode, Counter, Attendance, QT, and Line App can all be part of event workflows.
- Search/filter layouts and row actions vary by module.

### Functional Needs

- `行政類` as the default work category.
- Clear task grouping such as event operations, meetings, forms, and resources.
- Consistent filters, table actions, loading, empty, and error states.
- Fast return path to feature menu and related modules.

### Related Modules

- `project`
- `meeting`
- `forms`
- `venue`
- `zoom`
- `counter`
- `qrcode`
- `qt`
- `admin_supply`

## 牧養同工

### Main Tasks

- Manage member records, pastoral groups, care records, attendance context, education context, and member-related Line/LIFF flows.

### Use Context

Pastoral workers need identity-safe workflows. They should think in terms of Pastoral Member and pastoral scope, not backend account roles.

### Common Pain Points

- Pastoral, Attendance, Education, and Line App are related but appear as separate modules.
- LINE User and Pastoral Member relationship can be confusing if not made explicit.
- Pastoral permission boundaries are more complex than ordinary role-feature access.

### Functional Needs

- `牧養類` navigation grouping.
- Member profile as a future hub for care, attendance, education, forms, and Line binding context.
- Permission messages that mention pastoral scope rather than admin role.
- Avoid duplicate member identity concepts.

### Related Modules

- `pastoral`
- `attendance`
- `education`
- `linebot`
- `forms`
- `qrcode`

## 小組長

### Main Tasks

- Track members in assigned group scope.
- Review care needs, attendance, and education progress.
- Use future Line/LIFF flows for quick actions.

### Use Context

Small group leaders may not be heavy admin users. Their ideal surface is mobile-friendly and scoped.

### Common Pain Points

- Current admin UI is dense and module-driven.
- Group-scoped care and attendance workflows are not yet a dedicated role journey.
- If future LIFF flows are added, identity and pastoral scope must be clear.

### Functional Needs

- Group-scoped dashboards.
- Mobile-first member list and care follow-up flows.
- Simple attendance and care status indicators.
- No exposure to full backend administrative modules.

### Related Modules

- `pastoral`
- `attendance`
- `education`
- `linebot`
- Future LIFF/App

## 區牧

### Main Tasks

- Review multi-group pastoral health.
- Track attendance and care exceptions.
- Identify growth, education, and follow-up needs.

### Use Context

Zone pastors need summaries, drill-downs, and exception management.

### Common Pain Points

- Current modules provide data, but cross-module pastoral dashboards are still emerging.
- Attendance, education, care, and Line binding status should connect around Pastoral Member.

### Functional Needs

- Tree or hierarchy reports.
- Exception-focused views.
- Drill-down from zone to group to member.
- Pastoral permission boundaries independent of backend account role.

### Related Modules

- `pastoral`
- `attendance`
- `education`
- `linebot`
- `forms`

## 財務同工

### Main Tasks

- Manage purchases, reimbursements, payment requests, QT payment review, counter payment references, reconciliation, and reports.

### Use Context

Finance users need precise states, audit trails, and low ambiguity around payment transitions.

### Common Pain Points

- QT payment, Counter payment, and Finance are related but not fully presented as one financial journey.
- Payment status, approval, reservation, and fulfillment states must not be visually ambiguous.
- Reports need consistent filters and export behavior.

### Functional Needs

- Strong payment status badges.
- Explicit payment transition confirmation.
- Audit-visible actions.
- Consistent financial report filters.

### Related Modules

- `finance`
- `qt`
- `counter`
- `documents`
- `mail`

## 媒體同工

### Main Tasks

- Manage Sunday message sharing status, future media assets, worship/service operations, and related scheduling.

### Use Context

Media users may work with content, events, files, and cross-church publishing or sharing status.

### Common Pain Points

- Media and Worship are configured but not fully implemented.
- Sunday Message exists as an active module but may sit ambiguously between media, pastoral, and administration.

### Functional Needs

- `媒體類` category.
- Clear distinction between content planning, sharing status, and media asset operations.
- File and document management patterns aligned with shared document services.

### Related Modules

- `sunday_message`
- `media`
- `worship`
- `documents`
- `forms`

## 一般會友

### Main Tasks

- Use LINE/LIFF to bind identity, fill forms, register for activities, receive notifications, and use future member portal/App services.

### Use Context

Members need a simple mobile-first flow. They should not see internal system concepts.

### Common Pain Points

- LINE User identity is not the formal member identity.
- Binding, verification, and form fill must be short and clear.
- Member-facing flows must not expose admin terminology.

### Functional Needs

- Mobile-first LIFF screens.
- Clear binding status.
- Minimal form steps.
- Safe error recovery when identity mapping is incomplete.

### Related Modules

- `liff`
- `linebot`
- `forms`
- `pastoral`
- `qrcode`
- Future App

## LINE / LIFF 使用者

### Main Tasks

- Open LIFF from LINE.
- Establish a session.
- Bind or confirm Pastoral Member mapping.
- Access allowed portal links or module actions.

### Use Context

This is an entry identity, not a formal member record.

### Common Pain Points

- LINE session, LINE User, and Pastoral Member must be clearly separated.
- If binding fails, the next action must be obvious.

### Functional Needs

- Explicit identity state: unbound, pending binding, bound.
- Clear link between Line User and Pastoral Member without exposing internal account role.
- Safe handling of OAuth/identity provider expansion later.

### Related Modules

- `linebot`
- `liff`
- `pastoral`
- Future Identity Provider Layer

## Cross-Role Journey Risks

| Risk | Impact | Recommended Product Response |
| --- | --- | --- |
| Too many top-level entries | Users cannot quickly find the right module. | Category navigation and quick access. |
| Payment states spread across modules | Finance errors and audit gaps. | Shared payment status and action language. |
| LINE User confused with Pastoral Member | Identity Boundary violation. | Copy, UI states, and data model checks. |
| Admin modules mixed with daily work | Accidental risky operations. | Separate `系統管理類`. |
| Desktop-heavy admin UI reused for member flows | Poor LIFF/App UX. | Separate admin and member design principles. |
