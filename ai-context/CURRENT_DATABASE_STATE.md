# TopChurchPlus Current Database State

Generated: 2026-06-14
Source Git HEAD: b6a002d
Mode: AI-readable snapshot generated from repository inspection
Max scope: Schema inventory summary only. Verify live DB before migration.

## Purpose

This file summarizes known PostgreSQL schema areas from `database/*.sql` and `database/migrations/*.sql`.

For full detail, read:

* `docs/architecture/DATABASE_REGISTRY.md`
* `docs/DATABASE_SCHEMA.md`
* Exact migration files in `database/`

## Database Type

Primary database: PostgreSQL.

Legacy data import/sync: MSSQL is referenced by project documentation as a legacy source, but this snapshot does not inspect external MSSQL directly.

## Core / Administration Tables

| Area | Tables |
| --- | --- |
| Accounts / Roles | `accounts`, `account_roles`, `departments`, `role_feature_permissions` |
| Params | `params`, `param_categories`, `param_items` |
| ID Rules | `id_rules` |
| Config | `system_config`, `system_config_keys` |
| Audit / Usage | `audit_logs`, `system_usage_logs` |

## Security Tables

| Area | Tables |
| --- | --- |
| Login events | `login_events` |
| Verification | `login_verification_challenges` |
| Devices | `trusted_login_devices` |
| Counter PIN | `counter_pin_codes` |

## Pastoral Domain Tables

Formal member and pastoral identity live here:

* `pastoral_members`
* `pastoral_groups`
* `pastoral_group_closure`
* `pastoral_group_leaders`
* `pastoral_group_types`
* `pastoral_member_addresses`
* `pastoral_member_contacts`
* `pastoral_member_faith`
* `pastoral_member_family_notes`
* `pastoral_member_files`
* `pastoral_member_group_assignments`
* `pastoral_member_relationships`
* `pastoral_care_records`
* `churches`
* `countries`
* `regions`
* `professions`
* `membership_categories`
* `marital_statuses`
* `pastoral_titles`
* `relationship_types`
* `baptism_events`
* `baptism_participants`
* `account_pastoral_church_permissions`

## LINE / LIFF / Notification Tables

| Area | Tables |
| --- | --- |
| LINE identity | `line_users`, `member_accounts`, `identity_providers`, `line_liff_sessions` |
| Binding | `line_binding_requests` |
| LINE Bot | `line_bot_channels`, `line_bot_links`, `line_bot_module_settings`, `line_bot_rich_menus`, `line_bot_webhook_events`, `line_bot_edm_campaigns` |
| Rich menu / leader scope | `line_rich_menu_assignments`, `line_leader_scope_rules`, `menu_items` |
| Notification | `notification_logs`, `notification_templates` |
| Summary cache | `attendance_summary`, `course_summary` |

## QT Tables

| Table | Current Role |
| --- | --- |
| `qt_orders` | QT order master. |
| `qt_order_items` | QT order item rows. |
| `qt_payment_types` | QT payment type options. |
| `qt_price_plans` | QT price plans. |
| `qt_product_types` | QT product types. |
| `qt_inventory_monthly` | Phase 2A monthly inventory foundation. |
| `qt_inventory_reservations` | Phase 2B reservation records. |
| `qt_inventory_movements` | Inventory movement / log records. |

QT inventory invariant from schema/service direction:

```text
physical_quantity >= 0
reserved_quantity >= 0
retail_quantity >= 0
reserved_quantity + retail_quantity <= physical_quantity
```

Important QT boundary:

* 2026-09 is the first official new QT operational month.
* 2026-08 and earlier are legacy period.
* Legacy 60 paid-unfulfilled candidates must not be auto-backfilled.

## Finance / Project / Meeting Tables

| Area | Tables |
| --- | --- |
| Project | `projects`, `project_people`, `project_budget`, `project_income`, `project_permissions` |
| Meetings | `meetings` |
| Finance | `purchases`, `purchase_items`, `purchase_advances`, `purchase_advance_items`, `purchase_expense_proofs`, `purchase_expense_proof_items`, `purchase_payment_requests`, `purchase_payment_items` |
| Files / Links | `files`, `file_links`, `entity_links`, `domain_events` |

## Forms / Counter / Short Links

| Area | Tables |
| --- | --- |
| Forms | `forms`, `form_questions`, `form_question_options`, `form_responses`, `form_response_answers`, `form_response_attachments` |
| Counter | `counter_transactions`, `counter_pin_codes` |
| Short Links | `short_links`, `short_link_clicks` |

## Assets / Admin Supply

| Area | Tables |
| --- | --- |
| Assets | `assets`, `asset_locations`, `asset_location_history`, `asset_status_history`, `asset_maintenance_records`, `asset_acquisition_links` |
| Admin Supply | `admin_supply_items`, `admin_supply_stocks`, `admin_supply_movements` |

## Facilities / Attendance / Education / Operations

| Area | Tables |
| --- | --- |
| Venue | `venue_reservations`, `venue_resource_calendars` |
| Zoom | `zoom_accounts`, `zoom_reservations` |
| Attendance | `attendance_events`, `attendance_records`, `attendance_types`, `attendance_summary` |
| Education | `education_course_categories`, `education_courses`, `education_enrollments`, `course_summary` |
| QRCode | `qrcode_events`, `qrcode_checkins` |
| Sunday Message | `sunday_messages`, `sunday_message_shares` |
| Worklog | `work_logs` |
| Development | `development_issues`, `development_releases` |
| Workflow | `bpm_definitions`, `bpm_instances`, `bpm_history` |
| Mail | `mail_queue`, `mail_quota_snapshots` |

## Schema Safety Notes

* Do not alter schema without explicit authorization.
* Do not run migrations unless requested.
* Before schema work, compare migration files, docs, and live DB.
* Add indexes with migrations when adding FK or query-heavy fields.
* Avoid guessing from old planning docs.

