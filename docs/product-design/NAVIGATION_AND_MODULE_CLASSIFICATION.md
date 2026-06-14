# TopChurchPlus Navigation And Module Classification

Status: Draft / Product Design Planning
Last updated: 2026-06-14
Scope: Navigation and module classification proposal only. This is not an implementation record.

## Current Observation

`Script_FeatureConfig.html` currently defines 22 feature entries. `Script_Login.html` renders allowed features as a flat feature grid with usage-based sorting, pinning, custom ordering, access labels, and coming-soon labels.

This is a strong base for personalization, but it does not provide a shared information architecture. Users with broad access, especially administrators and full-time coworkers, must scan many unrelated modules at once.

## Problems

- Daily operations, pastoral work, infrastructure tools, and system settings appear in the same feature surface.
- Coming-soon modules are visually close to active modules.
- Some modules are workflow-related but far apart in the list.
- Some modules belong to more than one mental model, such as QT, Line App, Forms, and QRCode.
- The current categories are implicit in descriptions rather than explicit in navigation.

## Proposed Category Definitions

### 行政類

Administrative coordination, forms, projects, meetings, finance-adjacent operations, and event-day workflows.

### 牧養類

Pastoral member records, attendance, education, care, and member-facing workflows. This category must respect Identity Boundary v2: Pastoral Member is the formal member identity.

### 資訊類

Communication infrastructure, integrations, queues, developer/system operation tools, and technical service monitoring.

### 媒體類

Message/content/media/worship-related production and service planning.

### 總務類

Physical resources, assets, venues, equipment, accounts, and inventory-like operations.

### 系統管理類

Platform configuration, permissions, parameters, audit/logs, config keys, and restricted administrator tools.

## Proposed Module Classification

| Category | Feature Key | Display Name | Current UI | Current API Module | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 行政類 | `project` | 專案管理系統 | `ProjectDetail.html` / overview view | `project`, `documents` | Active | Core administrative planning and tracking. |
| 行政類 | `meeting` | 會議管理 | `Meetings.html` | `project` | Active | Can be independent or project-related. |
| 行政類 | `forms` | 表單系統 | `Forms.html` | `forms`, `shortlinks` | Active | Cross-domain tool; public/LIFF forms must respect Pastoral identity rules. |
| 行政類 | `finance` | 財務管理系統 | `Purchase.html` | `finance`, `documents` | Active | Could later become `行政類 / 財務` sub-area. |
| 行政類 | `counter` | 櫃台工作台 | `Counter.html` | `counter`, `auth` | Active | Event-day operational workspace; overlaps with QT and QRCode. |
| 行政類 | `qrcode` | QRCode 活動管理 | `Qrcode.html` | `qrcode` | Active | Event check-in workflow; related to Attendance/Line App. |
| 行政類 | `qt` | QT 管理系統 | `Qt.html` | `qt` | Active | Operationally administrative; has pastoral/member-facing implications. |
| 牧養類 | `pastoral` | 牧養管理系統 | `Pastoral.html` | `pastoral` | Active | Primary Pastoral Domain module. |
| 牧養類 | `attendance` | 聚會統計系統 | `Attendance.html` | `attendance` | Active | Pastoral analysis and reporting input. |
| 牧養類 | `education` | 教育管理系統 | `Education.html` | `education` | Active | Course and member growth pathway. |
| 牧養類 | `linebot` | Line App會友管理系統 | `LineBot.html` | `linebot`, `liff` | Active | Member-facing entry management; also has technical setup. |
| 總務類 | `admin_supply` | 行政物資管理系統 | `AdminSupply.html` | `admin-supply` | Active | Consumable inventory and movements. |
| 總務類 | `asset` | 資產管理系統 | `Asset.html` | `asset` | Active | Fixed assets and equipment records. |
| 總務類 | `venue` | 場地預約系統 | `Venue.html` | `venue` | Active | Physical space scheduling. |
| 總務類 | `zoom` | Zoom帳號管理系統 | `Zoom.html` | `zoom` | Active | Shared digital resource scheduling. |
| 媒體類 | `sunday_message` | 主日信息管理系統 | `SundayMessage.html` | `sunday-message` | Active | Content/message coordination. |
| 媒體類 | `media` | 媒體管理系統 | Not found | Not found | Coming soon | Keep in coming-soon section until implementation exists. |
| 媒體類 | `worship` | 敬拜管理系統 | Not found | Not found | Coming soon | Could also connect to Serving later. |
| 系統管理類 | `system` | 系統管理 | `ParameterModal.html` / `systemView` | `system` | Active | Restricted settings, users, permissions, parameters, config keys. |
| 系統管理類 | `email_service` | Email 服務管理系統 | `EmailService.html` | `mail` | Active | Operational monitoring; admin-only. |
| 系統管理類 | `dev_management` | 系統開發管理 | `DevManagement.html` | `dev-management` | Active | Developer handoff and internal issue tracking. |
| 系統管理類 | `serving` | 服事管理系統 | Not found | Not found | Coming soon | If focused on scheduling volunteers, may later move to 行政類 or 牧養類. |

## Secondary Cross-Links

Some modules should have secondary relationships without duplicating top-level entries:

| Feature | Primary Category | Secondary Relationship |
| --- | --- | --- |
| `qt` | 行政類 | Pastoral member context, Counter, Finance/payment review, Line/LIFF ordering later. |
| `linebot` | 牧養類 | 資訊類 for channel setup, webhook, Rich Menu, LIFF configuration. |
| `forms` | 行政類 | 牧養類 when form responses map to Pastoral Member. |
| `qrcode` | 行政類 | Attendance and Line App check-in flows. |
| `sunday_message` | 媒體類 | Pastoral or admin reporting when tracking church sharing status. |
| `counter` | 行政類 | Finance and QT operational touchpoints. |

## Recommended Navigation Model

### Level 1: Role-Aware Category Sections

Keep role-based filtering first. Then group remaining feature cards by category.

Suggested order:

1. 常用 / 已釘選
2. 行政類
3. 牧養類
4. 總務類
5. 資訊類
6. 媒體類
7. 系統管理類
8. 建置中

Notes:

- `常用 / 已釘選` should not duplicate cards visually if the same card appears below; either show it as a quick-access strip or keep a clear repeated-card rule.
- `建置中` should be visually quiet and always after active modules.

### Level 2: Module Landing Pages

Within each module, use the Design System V1 page shell:

- Page Header
- Page Toolbar
- KPI Area
- Filter Area
- Content Area
- Action Area

### Level 3: Workflow Cross-Links

Do not create duplicate modules. Instead, add contextual links:

- From Counter to QT pickup and QRCode check-in.
- From Pastoral Member to Attendance and Education history.
- From Forms to Line/LIFF public entry settings when relevant.
- From QT to Finance/payment review only where explicitly allowed.

## Role-Oriented Navigation Recommendations

### 行政同工

Default emphasis:

- 行政類
- 總務類
- QT / Counter / Forms / QRCode

Reduce emphasis:

- System Management
- Dev Management

### 牧養同工

Default emphasis:

- Pastoral
- Attendance
- Education
- Line App member-facing flows

Important guardrail:

- Do not imply backend account role grants pastoral scope. Use Pastoral Domain permissions and mapping.

### 財務同工

Default emphasis:

- Finance
- QT payment review
- Counter payment references

Important guardrail:

- Payment state changes should remain clearly labeled and auditable.

### 系統管理員

Default emphasis:

- System Management
- Email Service
- Line App setup
- Dev Management
- Config Key Management

Important guardrail:

- Keep production-sensitive tools visually separated from daily operational modules.

## Progressive Implementation Priority

### High Priority

1. Add category metadata or a category mapping for every feature key.
2. Render the feature menu by category after role filtering.
3. Separate active and coming-soon modules.
4. Keep existing pinning, custom order, usage count, and access labels.
5. Add a short category description only if needed; avoid turning navigation into a help page.

### Medium Priority

1. Add task-oriented quick groups, such as `活動與報到`, `場地與會議`, `會友與牧養`.
2. Add contextual cross-links between related workflows.
3. Add standardized readonly/permission banners inside modules.

### Low Priority

1. Add global search across modules.
2. Add a left sidebar or command palette.
3. Add user-specific dashboards by role.

## Not Recommended Immediately

- Do not create more top-level feature cards before the category model is stable.
- Do not move module business logic while changing navigation.
- Do not combine System Management and Pastoral Management.
- Do not expose coming-soon modules as equal priority entries.
- Do not use account role as the basis for Pastoral Domain access.

## Subsystem And Service Boundary Recommendation

| Module / Area | Main Menu | Subsystem | Future Independent Service | Recommendation |
| --- | --- | --- | --- | --- |
| Project / Meeting | Yes | Administrative Operations | No | Keep in core admin app; add cross-links. |
| Forms / Shortlinks | Yes | Administrative Operations | Not now | Keep together; expose public/LIFF flows separately. |
| Finance | Yes | Finance | Maybe later | Keep as core admin subsystem until payment models stabilize. |
| QT | Yes | QT Operations | Maybe later | Govern tightly; do not split before payment/fulfillment/inventory stabilize. |
| Counter | Yes | Event-Day Operations | No | Keep as operational console with links to QT/QRCode/payment. |
| QRCode | Yes | Event-Day Operations | No | Keep as module; link results to Attendance when designed. |
| Pastoral | Yes | Pastoral Core | No | Treat as core identity-adjacent subsystem, not external service. |
| Attendance | Yes | Pastoral Reporting | No | Keep near Pastoral. |
| Education | Yes | Pastoral Growth | No | Keep near Pastoral and future Baptism. |
| Line App / LIFF | Yes, split by usage | Member Entry / Integration | Maybe later | Separate member operations from technical setup. |
| Email Service | Admin only | Infrastructure | Maybe later | Keep hidden from general roles; candidate for service boundary later. |
| Mail Queue | No direct general menu | Infrastructure | Maybe later | Manage through Email Service. |
| Asset / Admin Supply / Venue / Zoom | Yes | General Affairs | No | Keep in core admin app as shared resource management. |
| Media / Worship / Sunday Message | Yes when active | Media Operations | Not now | Keep as content/service planning subsystem. |
| System / Config / Permissions | Admin only | Platform Governance | No | Must remain restricted and audited. |
| BPM Engine | Not as normal module | Platform Workflow | Maybe later | Expose through workflow administration only when needed. |
