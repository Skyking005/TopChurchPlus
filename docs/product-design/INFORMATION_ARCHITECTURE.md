# TopChurchPlus Information Architecture

Status: Product Design Governance V1
Last updated: 2026-06-14
Scope: Information architecture, navigation, module grouping, and subsystem planning.

## Purpose

This document defines how TopChurchPlus modules should be grouped and presented so users can find the right function quickly as the system grows.

It complements `NAVIGATION_AND_MODULE_CLASSIFICATION.md`, which contains the detailed module table.

## Current IA Observation

The current feature menu is role-filtered and personalized, but flat. It has strong mechanics:

- Role-based access.
- Usage-based sorting.
- Pinning.
- Manual order.
- Access labels.
- Coming-soon labels.

However, TopChurchPlus now has enough modules that a flat list no longer communicates product structure.

## IA Problems

1. Active operational modules and system tools appear at the same level.
2. Coming-soon modules appear near implemented modules.
3. Cross-domain modules such as Forms, QT, Line App, QRCode, and Attendance need clearer primary ownership.
4. Member-facing flows and backend admin flows need clearer separation.
5. Future App, LIFF, baptism, education, and BPM expansion will increase navigation complexity.

## Product System Levels

### Level 0: Product Surface

TopChurchPlus has two major surfaces:

| Surface | User | Design Priority |
| --- | --- | --- |
| Internal Admin | Staff, admins, ministry workers, finance, media. | Efficiency, density, auditability. |
| Member Entry | LINE/LIFF/App users and members. | Mobile-first simplicity and identity clarity. |

### Level 1: Main Categories

Use six primary categories:

1. 行政類
2. 牧養類
3. 總務類
4. 資訊類
5. 媒體類
6. 系統管理類

### Level 2: Modules

Modules should appear under one primary category. Cross-links are allowed, but duplicate top-level entries are not recommended.

### Level 3: Module Tabs

Within a module, tabs should represent sub-workflows. Examples:

- Forms: 表單管理 / 短網址管理.
- QT: 訂購 / 領取 / 財務 / 報表 / 庫存.
- Line App: Users / Channels / Rich Menu / Binding Requests / Audit Logs.
- System: Users / Permissions / Parameters / Config Keys / Audit.

### Level 4: Page Structure

Every management page should follow UI Design System V1:

- Page Header.
- Page Toolbar.
- KPI Area when useful.
- Filter Area.
- Content Area.
- Action Area when needed.

## Recommended Main Navigation

### Quick Access

Show pinned or frequently used features first, but do not let quick access replace category navigation.

Suggested label:

- 常用功能

### 行政類

Primary modules:

- Project
- Meeting
- Forms
- Finance
- Counter
- QRCode
- QT

Secondary or related:

- Venue
- Zoom

### 牧養類

Primary modules:

- Pastoral
- Attendance
- Education
- Line App member-facing flows

Future:

- Baptism
- Member portal
- App pastoral surfaces

### 總務類

Primary modules:

- Admin Supply
- Asset
- Venue
- Zoom

### 資訊類

Primary modules:

- Email Service
- Line App technical setup
- Dev Management
- Workflow/BPM operations

### 媒體類

Primary modules:

- Sunday Message
- Media
- Worship

### 系統管理類

Primary modules:

- System Management
- Config Key Management
- Role Feature Permissions
- Audit and usage logs
- Integration settings

## Subsystem Planning

| Subsystem | Recommended Shape | Reason |
| --- | --- | --- |
| Pastoral System | Core subsystem | Central member identity and pastoral data. |
| Line / LIFF | Integration/member entry subsystem | Must preserve identity boundary and mobile-first flows. |
| QT System | Operational subsystem | Payment/reservation/fulfillment/inventory complexity justifies clear ownership. |
| Mail Queue | Infrastructure subsystem | Should support many modules without becoming user-facing clutter. |
| BPM Engine | Platform subsystem | Workflow engine should be shared, not duplicated per module. |
| Finance | Core administrative subsystem | Payment/audit/reporting flows need stable governance. |
| Asset/Admin Supply/Venue/Zoom | General affairs subsystem | Shared resource/inventory/reservation patterns. |
| Project/Meeting/Forms/QRCode | Administrative operations subsystem | Common event, document, and data collection workflows. |
| Media/Worship/Sunday Message | Media/content subsystem | Needs consistent file/content scheduling model later. |

## Main Menu Display Rules

| Rule | Recommendation |
| --- | --- |
| Is the module active? | Active modules may appear in main menu. Coming-soon modules should appear in a separate lower-priority section. |
| Is it used daily by many roles? | Main menu candidate. |
| Is it admin-only and risky? | Place under System Management or 系統管理類. |
| Is it an integration setting? | Prefer subsystem tab, not top-level module, unless it has daily operations. |
| Is it member-facing? | Do not expose as admin module unless it is a management console. |
| Is it a future module? | Do not promote until product owner confirms journey and data boundary. |

## Repeated Or Overlapping Areas

| Area | Overlap | IA Recommendation |
| --- | --- | --- |
| QT / Counter / Finance | Payment, pickup, reconciliation. | Keep QT as owner of QT domain; Counter as operational entry; Finance as reporting/audit context. |
| Forms / Shortlinks / LIFF | Public/member data collection. | Forms owns form design; Line/LIFF owns member entry; Shortlinks remain a Forms/System utility. |
| QRCode / Attendance / Line App | Check-in and identity capture. | QRCode owns event check-in; Attendance owns pastoral/reporting interpretation. |
| Pastoral / Education / Attendance | Member growth and care. | Pastoral Member should become the conceptual hub. |
| System / Dev / Email / Line setup | Technical operations. | Group under System/Admin or Information categories. |

## Future Expansion

### Line Bot

Should remain both:

- A member engagement subsystem.
- A technical integration console.

Navigation should separate member-facing operations from channel/webhook/Rich Menu technical setup.

### LIFF

Should be treated as member-facing surface. It must be mobile-first and identity-boundary safe.

### Education

Should stay in Pastoral category and connect to Pastoral Member.

### Baptism

Should not be a standalone card until the product relationship is defined. It likely belongs under Pastoral/Education and may use Forms for application intake.

### Attendance

Should stay in Pastoral category and become report/dashboard input.

### App

Should be a member surface, not a copy of the admin app.

### BPM Engine

Should remain a platform subsystem and not appear as a normal user module unless workflow administration is needed.

## IA Roadmap

### Quick Wins: 1-2 Weeks

- Add category metadata to feature config.
- Render categorized feature sections.
- Separate coming-soon modules.
- Keep current pinning and usage-based ranking.

### Mid-Term: 1-3 Months

- Add contextual cross-links between related modules.
- Standardize module-level tabs and page shells.
- Define member-facing navigation separately from admin navigation.

### Long-Term: 6-12 Months

- Build role-specific dashboards.
- Add global search or command palette.
- Create Pastoral Member profile as cross-module hub.
- Formalize App/LIFF information architecture.
