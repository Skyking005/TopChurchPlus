# TopChurchPlus Module Registry

Status: Generated from repository inspection
Last updated: 2026-06-14
Scope: Documentation only. Verify source before implementation.

## Module Ownership Table

| Module | Feature Key | UI Evidence | API Evidence | Primary Tables / Data Areas | Notes |
| --- | --- | --- | --- | --- | --- |
| Authentication | auth | `Login.html`, `Script_Login.html` | `api/src/modules/auth/routes.js` | `accounts`, `account_roles`, `login_events`, `login_verification_challenges`, `trusted_login_devices` | Login, verification, counter PIN login. Verification email is an approved direct-send exception. |
| System Management | system | `ParameterModal.html`, `Script_ParameterModal.html` | `api/src/modules/system/routes.js` | `params`, `param_categories`, `param_items`, `id_rules`, `system_config`, `system_config_keys`, `role_feature_permissions`, `system_usage_logs` | Users, roles, feature permissions, ID rules, config keys, params. |
| Project Management | project | `ProjectDetail.html`, `Meetings.html`, `Script_Project*.html`, `Script_Meetings.html` | `api/src/modules/project/routes.js` | `projects`, `project_people`, `project_budget`, `project_income`, `project_permissions`, `meetings` | Project detail, project permissions, meetings. |
| Meeting Management | meeting | `Meetings.html`, `MeetingModal.html` | `api/src/modules/project/routes.js` | `meetings` | Independent and project-linked meetings share project route module. |
| Finance | finance | `Purchase.html`, `Script_Purchase.html` | `api/src/modules/finance/routes.js`, `api/src/modules/documents/routes.js` | `purchases`, `purchase_items`, `purchase_advances`, `purchase_expense_proofs`, `purchase_payment_requests` | Purchasing, advances, payment requests, expense proofs, finance document output. |
| Admin Supply | admin_supply | `AdminSupply.html`, `Script_AdminSupply.html` | `api/src/modules/admin-supply/routes.js` | `admin_supply_items`, `admin_supply_movements`, `admin_supply_stocks` | Administrative consumables and stock movements. Separate from QT inventory. |
| Asset | asset | `Asset.html`, `Script_Asset.html` | `api/src/modules/asset/routes.js` | `assets`, `asset_locations`, `asset_status_history`, `asset_location_history`, `asset_maintenance_records` | Fixed asset inventory and locations. |
| Venue | venue | `Venue.html`, `Script_Venue.html` | `api/src/modules/venue/routes.js` | `venue_reservations`, `venue_resource_calendars` | Venue resources and reservations. |
| Zoom | zoom | `Zoom.html`, `Script_Zoom.html` | `api/src/modules/zoom/routes.js` | `zoom_accounts`, `zoom_reservations` | Zoom account availability and reservations. |
| Sunday Message | sunday_message | `SundayMessage.html`, `Script_SundayMessage.html` | `api/src/modules/sunday-message/routes.js` | `sunday_messages`, `sunday_message_shares` | Sermon/message topic tracking. |
| Forms | forms | `Forms.html`, `Script_Forms.html` | `api/src/modules/forms/routes.js` | `forms`, `form_questions`, `form_question_options`, `form_responses`, `form_response_answers`, `form_response_attachments` | Internal and public form flows; short links are separate API module. |
| Short Links | shortlinks | Forms/System related | `api/src/modules/shortlinks/routes.js` | `short_links`, `short_link_clicks` | Short URL management; currently API module, not standalone feature card. |
| Counter | counter | `Counter.html`, `Script_Counter.html` | `api/src/modules/counter/routes.js` | `counter_pin_codes`, `counter_transactions` | Counter PINs and transaction payment marking. |
| QRCode Activity | qrcode | `Qrcode.html`, `Script_Qrcode.html` | `api/src/modules/qrcode/routes.js` | `qrcode_events`, `qrcode_checkins` | Event check-in and active event lookup. |
| QT Management | qt | `Qt.html`, `Script_Qt.html` | `api/src/modules/qt/routes.js`, `api/src/modules/qt/inventory-service.js` | `qt_orders`, `qt_order_items`, `qt_inventory_monthly`, `qt_inventory_movements`, `qt_inventory_reservations`, `qt_price_plans`, `qt_product_types`, `qt_payment_types` | QT order, inventory, reservation, same-church fulfillment. Do not mix with admin supply inventory. |
| LINE Bot | linebot | `LineBot.html`, `Script_LineBot.html` | `api/src/modules/linebot/routes.js`, `api/src/modules/linebot/webhook.js` | `line_users`, `line_bot_channels`, `line_bot_links`, `line_bot_module_settings`, `line_binding_requests`, `line_bot_webhook_events`, `line_rich_menu_assignments` | LINE admin, webhook, rich menu, binding requests. |
| LIFF / Member Portal | linebot | `LineBot.html`, LIFF API | `api/src/modules/liff/routes.js` | `line_liff_sessions`, `member_accounts`, `pastoral_members`, `line_users` | Public-prefixed API. Must respect Identity Boundary v2. |
| Email Service | email_service | `EmailService.html`, `Script_EmailService.html` | `api/src/modules/mail/routes.js` | `mail_queue`, `mail_quota_snapshots` | Mail queue monitoring and management. |
| Pastoral | pastoral | `Pastoral.html`, `Script_Pastoral.html` | `api/src/modules/pastoral/routes.js` | `pastoral_members`, `pastoral_groups`, `pastoral_member_*`, `pastoral_care_records`, `account_pastoral_church_permissions` | Formal member and pastoral domain. |
| Education | education | `Education.html`, `Script_Education.html` | `api/src/modules/education/routes.js` | `education_course_categories`, `education_courses`, `education_enrollments` | Course and enrollment management. |
| Attendance | attendance | `Attendance.html`, `Script_Attendance.html` | `api/src/modules/attendance/routes.js` | `attendance_events`, `attendance_records`, `attendance_types`, `attendance_summary` | Meeting/small group attendance statistics. |
| Development Management | dev_management | `DevManagement.html`, `Script_DevManagement.html` | `api/src/modules/dev-management/routes.js` | `development_issues`, `development_releases` | Internal development issue and release records. |
| Workflow | workflow | No top-level feature card found | `api/src/modules/workflow/routes.js` | `bpm_definitions`, `bpm_instances`, `bpm_history` | BPM engine API. |
| Documents | documents | Download links from modules | `api/src/modules/documents/routes.js` | `files`, `file_links`, module data | DOCX rendering service for project and finance. |
| Work Logs | worklog | `WorkLogModal.html`, `Script_WorkLog.html` | `api/src/modules/worklog/routes.js` | `work_logs` | Work log modal/API. |
| Media | media | Feature config only | No API module found | UNKNOWN | Coming soon entry. |
| Worship | worship | Feature config only | No API module found | UNKNOWN | Coming soon entry. |
| Serving | serving | Feature config only | No API module found | UNKNOWN | Coming soon entry. |

## Shared Module Dependencies

| Shared Area | Source | Used For |
| --- | --- | --- |
| Audit | `api/src/shared/audit.js` | Audit logs for security and operational actions. |
| Permissions | `api/src/shared/permissions.js`, `api/src/shared/users.js` | Role and feature access checks. |
| Config | `api/src/shared/config.js`, `api/src/shared/config-service.js` | API config and centralized config keys. |
| Files | `api/src/shared/files.js` | File metadata and module attachments. |
| Params | `api/src/shared/params.js` | Parameter lists and system-managed option values. |
| ID Rules | `api/src/shared/id-rules.js` | Entity ID prefix and sequence rules. |
| Cross System | `api/src/shared/cross-system.js` | Entity links and domain events. |
| Repository | `api/src/shared/repository.js` | Shared data access patterns. |

