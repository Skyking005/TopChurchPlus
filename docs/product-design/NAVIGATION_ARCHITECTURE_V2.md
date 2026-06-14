# TopChurchPlus Navigation Architecture V2

Status: Product Architecture Governance
Last updated: 2026-06-14
Scope: Navigation architecture only. This document does not change production code, API, schema, or permissions.

## Purpose

Navigation Architecture V2 defines how TopChurchPlus should organize system entry points as the product grows. It is intended to reduce module discovery cost, reduce repeated Codex context scanning, and create a stable mental model for staff, administrators, and future AI agents.

## Current State

`Script_FeatureConfig.html` currently defines 22 feature entries. `Script_Login.html` renders allowed features as a role-filtered, usage-sorted, pinned, flat feature grid.

This is useful personalization, but it is not enough product architecture for a large multi-domain system. V2 keeps the existing role filtering and personalized quick access, but adds a category-first navigation layer.

## Navigation Principles

1. Role filtering happens before navigation rendering.
2. Users should see the most relevant modules first, but category structure must remain visible.
3. Coming-soon modules must not compete visually with active modules.
4. System management and production-sensitive tools must be visually separated from daily operations.
5. Pastoral and member-facing flows must respect Identity Boundary v2.
6. Cross-links are allowed; duplicate top-level entries are not recommended.
7. Navigation changes must not change module logic, API payloads, schema, or permission behavior.

## Primary Navigation Model

Desktop recommended order:

1. Dashboard / 常用功能
2. 行政類
3. 牧養類
4. 總務類
5. 資訊類
6. 媒體類
7. 系統管理類
8. 建置中

Mobile recommended order:

1. 常用功能
2. Recently used or pinned modules
3. Category selector
4. Category module list
5. 建置中 collapsed section

## Main Navigation Categories

### Dashboard / 常用功能

Purpose:

- Personal quick access.
- Usage-ranked entry points.
- Pinned modules.
- High-priority operational alerts in later phases.

Rules:

- Do not duplicate too many cards. A compact quick-access strip is preferred.
- Keep existing usage count and pin behavior.
- Do not put coming-soon modules here unless the user explicitly pins them later.

### 行政類

Purpose:

Administrative planning, data collection, project operations, forms, event-day workflows, and finance-adjacent operations.

Modules:

- `project`: 專案管理系統
- `meeting`: 會議管理
- `forms`: 表單系統
- `finance`: 財務管理系統
- `counter`: 櫃台工作台
- `qrcode`: QRCode 活動管理
- `qt`: QT 管理系統
- `workflow`: BPM / Workflow administration when exposed as workflow operations

Primary users:

- 行政同工
- 財務同工
- 系統管理員
- 義工 for Counter/QT/Serving-related operations

### 牧養類

Purpose:

Pastoral member records, group structure, attendance, education, care tracking, and member-facing relationship context.

Modules:

- `pastoral`: 牧養管理系統
- `attendance`: 聚會統計系統
- `education`: 教育管理系統
- Care Tracking: future pastoral care workflow inside or adjacent to Pastoral
- Baptism: future pastoral/education lifecycle feature
- Line/LIFF member operations when focused on member binding and pastoral relationship

Primary users:

- 牧養同工
- 小組長
- 區牧
- 教育同工

Boundary rule:

Pastoral navigation must not imply backend Account role equals pastoral authority.

### 總務類

Purpose:

Physical resources, shared accounts, venues, assets, supplies, and reservations.

Modules:

- `asset`: 資產管理系統
- `admin_supply`: 行政物資管理系統
- `venue`: 場地預約系統
- `zoom`: Zoom帳號管理系統
- Reservation: future generalized reservation model

Primary users:

- 行政同工
- 總務同工
- 系統管理員

### 資訊類

Purpose:

Technical communication services, integrations, service monitoring, queues, API/Apps Script operational tools, and developer support.

Modules:

- `email_service`: Email 服務管理系統
- Mail Queue: managed through Email Service
- `linebot`: Line technical setup, Channel, Rich Menu, webhook readiness
- Integrations: future integration console
- API Management: future internal API diagnostics
- `dev_management`: 系統開發管理

Primary users:

- 系統管理員
- 技術同工
- Integrations administrators

### 媒體類

Purpose:

Content, message, media, worship, streaming, and production workflows.

Modules:

- `sunday_message`: 主日信息管理系統
- `media`: 媒體管理系統
- `worship`: 敬拜管理系統
- Streaming: future media/online service flow
- Content Management: future shared content workflow

Primary users:

- 媒體同工
- 敬拜同工
- 行政同工 when coordinating services

### 系統管理類

Purpose:

Restricted platform management.

Modules:

- `system`: 系統管理
- Users
- Roles
- Settings
- Feature Config
- Config Key Management
- Audit / usage logs
- Permissions

Primary users:

- 超級管理者
- 管理員 for permitted settings only

Rules:

- This category should be visually separated.
- Dangerous operations need confirmation, audit, and clear recovery text.
- Secret/config management must remain masked and permission-checked.

## Module Classification Table

| Category | Feature / Area | Current Feature Key | Main Menu | Sub-navigation | Notes |
| --- | --- | --- | --- | --- | --- |
| Dashboard | 常用功能 | generated | Yes | No | Personal entry layer, not a business module. |
| 行政類 | Project | `project` | Yes | Project tabs/details | Core planning module. |
| 行政類 | BPM / Workflow | `workflow` / API module | Not yet general | Workflow definitions/instances | Expose only when workflow admin UI is ready. |
| 行政類 | Forms | `forms` | Yes | Forms / Shortlinks / Responses | Public/LIFF forms need identity-safe mapping. |
| 行政類 | QT | `qt` | Yes | Orders / Pickup / Finance / Reports / Inventory | Pilot candidate. |
| 行政類 | Finance | `finance` | Yes | Purchases / Advances / Requests / Reports | Payment state language must be consistent. |
| 行政類 | Counter | `counter` | Yes | Payment / QT / QRCode / PIN | Operational console; not a data owner for every touched domain. |
| 行政類 | QRCode | `qrcode` | Yes | Events / Check-in / Lists | Event check-in owner. |
| 牧養類 | Pastoral | `pastoral` | Yes | Members / Groups / Care / Files | Pastoral Member source-of-truth surface. |
| 牧養類 | Attendance | `attendance` | Yes | Small groups / Meetings / Reports | Pastoral reporting. |
| 牧養類 | Education | `education` | Yes | Courses / Forecast / Enrollments | Pastoral growth. |
| 牧養類 | Care Tracking | future | Subsystem | In Pastoral | Avoid top-level until workflow is clear. |
| 牧養類 | Baptism | future | Not yet | In Pastoral/Education | Do not add as standalone before data boundary. |
| 總務類 | Asset | `asset` | Yes | List / Detail / Locations | Fixed asset management. |
| 總務類 | Admin Supply | `admin_supply` | Yes | Items / Movements | Consumables and stock. |
| 總務類 | Reservation | `venue` | Yes | Availability / Management | Venue currently owns physical reservations. |
| 總務類 | Zoom | `zoom` | Yes | Availability / Reservations | Digital shared resource. |
| 資訊類 | Mail Queue | `email_service` | Admin only | Queue / Dashboard / Triggers | Managed through Email Service. |
| 資訊類 | Email Service | `email_service` | Admin only | Dashboard / Queue / Detail | Pilot candidate. |
| 資訊類 | Line Bot technical setup | `linebot` | Yes for admins | Channels / Rich Menu / Webhook / Audit | Split from pastoral member operations in copy/UI. |
| 資訊類 | Integrations | future | Admin only | API / Apps Script / external services | Do not expose until concrete tools exist. |
| 資訊類 | API Management | future | Admin only | Health / Keys / diagnostics | Keep read-only diagnostics first. |
| 資訊類 | Dev Management | `dev_management` | Admin/tech only | Issues / Docs / Releases | Internal developer handoff. |
| 媒體類 | Sunday Message | `sunday_message` | Yes | Messages / Sharing | Active content coordination. |
| 媒體類 | Media | `media` | Coming soon | TBD | Keep in 建置中 until implemented. |
| 媒體類 | Worship | `worship` | Coming soon | TBD | Keep in 建置中 until implemented. |
| 媒體類 | Streaming | future | Not yet | TBD | Needs media architecture first. |
| 系統管理類 | Users | `system` | Admin only | Users tab | Restricted. |
| 系統管理類 | Roles | `system` | Admin only | Feature permissions | Restricted. |
| 系統管理類 | Settings | `system` | Admin only | Params / Config keys | Restricted. |
| 系統管理類 | Feature Config | `system` | Admin only | Feature permissions | Restricted. |

## Sub-navigation Design

### Shared Sub-navigation Rules

- Tabs represent workflows, not implementation details.
- Tabs should use stable nouns: Dashboard, List, Detail, Settings, Reports, Logs.
- Avoid more than seven primary tabs inside one module. If more are needed, create grouped sections.
- Keep destructive or admin-only tabs visually separated.

### Recommended Module Sub-navigation

| Module | Suggested Tabs |
| --- | --- |
| QT | Dashboard, 訂購, 領取, 財務, 報表, 庫存, Logs |
| Email Service | Dashboard, Queue, Failed, Sent, Quota, Trigger, Logs |
| Forms | 表單管理, 短網址管理, 回覆, 統計, Settings |
| Line App | Dashboard, Users, Binding Requests, Rich Menu, Channels, Events, Audit |
| Pastoral | Members, Groups, Care, Attendance, Education, Files |
| Finance | Purchases, Advances, Requests, Reports, Documents |
| Asset | Assets, Locations, Movements, Reports |
| Venue/Reservation | Availability, Reservations, Resources, Calendar Settings |
| System | Users, Roles, Parameters, Config Keys, Audit, Usage |

## Desktop Navigation Recommendation

Recommended layout:

- Top-level category rail or categorized feature sections.
- Quick-access strip for pinned/frequent modules.
- Feature cards grouped by category.
- Category labels with short operational descriptions.
- Active modules first, coming-soon collapsed at the bottom.

Desktop should prioritize scan speed and density.

## Mobile Navigation Recommendation

Recommended layout:

- Compact top menu.
- Search or category picker.
- Pinned/recent modules first.
- Single-column module cards.
- Coming-soon collapsed.

Mobile should prioritize fast task entry. Do not show dense management grids as the primary member-facing pattern.

## Future Expansion Rules

1. New modules require a primary category before feature config is updated.
2. New member-facing features must define whether they are LIFF/App/member portal surfaces or admin management screens.
3. New pastoral features must identify Pastoral Member as the formal identity source.
4. New integration features should enter 資訊類 or 系統管理類, not daily operations.
5. Coming-soon entries should not be added unless ownership and category are known.
6. If a feature fits more than one category, choose one primary owner and add contextual cross-links.
7. Do not create a top-level module for a tab-level workflow.

## Rollout Recommendation

Phase 1:

- Add category metadata in documentation.
- Draft a small navigation proof-of-concept later.
- Preserve role filtering, pinning, custom sorting, and usage count.

Phase 2:

- Add category sections to feature menu.
- Move coming-soon modules into a quiet section.

Phase 3:

- Add module-level sub-navigation standards.
- Add contextual cross-links for QT/Counter/Finance and Pastoral/Attendance/Education/Line.
