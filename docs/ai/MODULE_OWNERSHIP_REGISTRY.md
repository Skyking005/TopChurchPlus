# Module Ownership Registry

Status: Active registry
Last updated: 2026-06-14
Source basis: `Script_FeatureConfig.html`, `api/src/modules/*`, `docs/ai/PROJECT_CONTEXT_SNAPSHOT.md`, and migration filenames under `database/`.

This registry is an ownership and impact map for AI agents and developers. It is not a live schema authority. Use PostgreSQL MCP before database-impacting work.

## Primary Feature Modules

| Module Name | Feature Key | Domain | API Route Module | UI Files | Primary Data Tables | Navigation Category | Permission Source | Identity Boundary Risk | Current Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Project Management | `project` | Project | `project` | `MainListSearchBar.html`, `ProjectDetail.html`, `Script_MainListSearch.html`, `Script_ProjectDetail.html`, `Script_ProjectRowsFinance.html`, `Script_ProjectSave.html` | `projects`, `project_people`, `project_income`, `project_budget`, `project_permissions`, `meetings` | Administrative | `ROLE_FEATURE_ACCESS`, project permissions | Medium | Active | Meetings and finance rows are connected; avoid broad rewrites. |
| Meeting Management | `meeting` | Project / Meeting | `project` / `core` / Unknown dedicated route | `Meetings.html`, `MeetingModal.html`, `Script_Meetings.html`, `Script_MeetingModal.html` | `meetings`, `file_links` | Administrative | `ROLE_FEATURE_ACCESS` | Low | Active | Independent meetings are supported by nullable `project_id`. |
| Forms | `forms` | Forms / Public entry | `forms`, `shortlinks` | `Forms.html`, `Script_Forms.html` | `forms`, `form_questions`, `form_question_options`, `form_responses`, `form_response_answers`, `form_response_attachments`, `short_links` | Administrative | `ROLE_FEATURE_ACCESS` | Medium | Active | Public/LIFF form work must respect Pastoral Member mapping. |
| Finance / Purchase | `finance` | Finance | `finance` | `Purchase.html`, `Script_Purchase.html` | `purchases`, `purchase_items`, `purchase_advances`, `purchase_expense_proofs`, `purchase_payment_requests`, `purchase_payment_items`, `files`, `file_links` | Administrative | `ROLE_FEATURE_ACCESS` | Medium | Active / Beta | High risk around approval/payment logic. |
| Counter Workbench | `counter` | Counter / Finance / QT edge | `counter` | `Counter.html`, `Script_Counter.html` | `counter_pin_codes`, `counter_transactions`, forms/QT related tables | Administrative | `ROLE_FEATURE_ACCESS`, PIN flow | Medium | Active | QT logic should move to QT module where possible. |
| QRCode Activity | `qrcode` | QRCode / attendance edge | `qrcode` | `Qrcode.html`, `Script_Qrcode.html` | `qrcode_events`, `qrcode_checkins` | Administrative | `ROLE_FEATURE_ACCESS` | Medium | Active | May touch member/attendance identity. |
| QT Management | `qt` | QT / Finance / Inventory | `qt` | `Qt.html`, `Script_Qt.html` | `qt_orders`, `qt_order_items`, `qt_payment_types`, `qt_product_types`, `qt_price_plans`, `qt_inventory_monthly`, `qt_inventory_movements`, `qt_inventory_reservations` | Administrative | `ROLE_FEATURE_ACCESS` | High | Active staged refactor | Do not touch payment, fulfillment, inventory, transfer, forecast without explicit scope. |
| Pastoral Management | `pastoral` | Pastoral | `pastoral` | `Pastoral.html`, `Script_Pastoral.html` | `pastoral_members`, `pastoral_groups`, `pastoral_group_closure`, `pastoral_care_records`, `pastoral_member_*`, `account_pastoral_church_permissions` | Pastoral | `ROLE_FEATURE_ACCESS` plus pastoral scope | High | Active / Beta | Pastoral Domain cannot rely only on Account Role. |
| Attendance | `attendance` | Attendance / Pastoral | `attendance` | `Attendance.html`, `Script_Attendance.html` | `attendance_events`, `attendance_types`, `attendance_records`, `attendance_summary` | Pastoral | `ROLE_FEATURE_ACCESS`, pastoral scope where relevant | High | Active / in progress | Member and group scope must be verified. |
| Education | `education` | Education / Pastoral | `education` | `Education.html`, `Script_Education.html` | `education_course_categories`, `education_courses`, `education_enrollments`, `course_summary` | Pastoral | `ROLE_FEATURE_ACCESS`, pastoral scope where relevant | High | Active / Beta | Course/member data may cross Pastoral Domain. |
| Line App / LINE Bot | `linebot` | Line User / LIFF / Integration | `linebot`, `liff` | `LineBot.html`, `Script_LineBot.html` | `line_users`, `line_liff_sessions`, `line_bot_*`, `line_binding_requests`, `menu_items`, `line_leader_scope_rules`, `line_rich_menu_assignments` | Information | `ROLE_FEATURE_ACCESS`, LINE signature/session checks | High | Active | Do not change webhook or LIFF identity mapping without explicit scope. |
| Email Service | `email_service` | Mail / Notification | `mail` | `EmailService.html`, `Script_EmailService.html` | `mail_queue`, `mail_quota_snapshots`, `audit_logs` | Information | `ROLE_FEATURE_ACCESS`, admin checks in API | Medium | Active MVP | Normal email must use queue; login verification email is immediate-send exception. |
| Dev Management | `dev_management` | Development governance | `dev-management` | `DevManagement.html`, `Script_DevManagement.html` | `development_issues`, `development_releases` | Information | `ROLE_FEATURE_ACCESS` | Low | Active | Developer/admin support module. |
| Admin Supply | `admin_supply` | General Affairs / Inventory | `admin-supply` | `AdminSupply.html`, `Script_AdminSupply.html` | `admin_supply_items`, `admin_supply_stocks`, `admin_supply_movements` | General Affairs | `ROLE_FEATURE_ACCESS` | Low | Active | Separate from QT inventory. |
| Asset | `asset` | Asset | `asset` | `Asset.html`, `Script_Asset.html` | `assets`, `asset_locations`, `asset_location_history`, `asset_status_history`, `asset_maintenance_records`, `asset_acquisition_links` | General Affairs | `ROLE_FEATURE_ACCESS` | Low | Active | May link to finance purchases. |
| Venue Reservation | `venue` | Reservation | `venue` | `Venue.html`, `Script_Venue.html` | `venue_resource_calendars`, `venue_reservations` | General Affairs | `ROLE_FEATURE_ACCESS` | Low | Active | External calendar behavior should be checked before release. |
| Zoom Account Reservation | `zoom` | Reservation | `zoom` | `Zoom.html`, `Script_Zoom.html` | `zoom_accounts`, `zoom_reservations` | General Affairs | `ROLE_FEATURE_ACCESS` | Low | Active | Shares reservation overlap concerns with venue. |
| Sunday Message | `sunday_message` | Media / Content | `sunday-message` | `SundayMessage.html`, `Script_SundayMessage.html` | `sunday_messages`, `sunday_message_shares` | Media | `ROLE_FEATURE_ACCESS` | Low | Active | Media/content status tracking. |
| Media Management | `media` | Media | Unknown | Unknown | Unknown | Coming Soon / Media | `ROLE_FEATURE_ACCESS` | Low | Coming soon | Entry is reserved only. |
| Worship Management | `worship` | Worship / Media | Unknown | Unknown | Unknown | Coming Soon / Media | `ROLE_FEATURE_ACCESS` | Low | Coming soon | Entry is reserved only. |
| System Management | `system` | Account / System | `system`, `shortlinks`, `core` | `ParameterModal.html`, `PrivilegeModal.html`, `Script_ParameterModal.html`, `Script_PrivilegeModal.html`, `Script_FeatureConfig.html` | `accounts`, `account_roles`, `role_feature_permissions`, `params`, `param_items`, `id_rules`, `system_config`, `system_config_keys`, `short_links`, `audit_logs`, `system_usage_logs` | System Management | `ROLE_FEATURE_ACCESS`, super-admin checks for config | High | Active | Permission/config changes are high risk. |
| Serving Management | `serving` | Serving | Unknown | Unknown | Unknown | Coming Soon | `ROLE_FEATURE_ACCESS` | Medium | Coming soon | Future scheduling may touch Account/Pastoral identity. |

## API-Only Or Shared Support Modules

| Module | Purpose | Notes |
| --- | --- | --- |
| `auth` | Login, verification, auth-related API. | Login verification email is allowed to bypass Mail Queue with quota check. |
| `core` | Core shared endpoints and parameter/catalog support. | Check callers before changes. |
| `documents` | Document generation and file outputs. | Used by project/meeting/finance flows. |
| `liff` | Member-facing LIFF routes and sessions. | High Identity Boundary risk. |
| `mail` | Mail Queue API. | Used by Email Service and future module notifications. |
| `shortlinks` | Short link management. | UI lives in System/Forms contexts. |
| `workflow` | BPM definitions, instances, and history. | May become cross-module approval engine. |
| `worklog` | Work log modal and API. | Admin/support utility. |

## High-Risk Modules

- `qt`: payment, reservation, fulfillment, inventory invariant, legacy cutover.
- `linebot` / `liff`: webhook, LIFF sessions, binding, Pastoral Member mapping.
- `pastoral`: pastoral scope, member identity, sensitive data.
- `finance`: payment and approval behavior.
- `system`: roles, permissions, config keys, secrets.
- `mail`: queue processing, quota, trigger permissions, immediate-send exception.

## Maintenance Rules

- Update this registry when adding a feature key, route module, UI file, major table, or navigation category.
- Mark `Unknown` instead of guessing.
- Use PostgreSQL MCP before converting table notes into schema-dependent implementation.
- Do not use this registry as a substitute for `docs/API_CATALOG.md` or live schema verification.
