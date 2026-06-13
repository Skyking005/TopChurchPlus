# TopChurchPlus Database Registry

Status: Generated from repository inspection
Last updated: 2026-06-14
Scope: Documentation only. Verify migrations and live database before schema changes.

## Source Files Inspected

* `database/schema.sql`
* `database/core_platform_schema.sql`
* `database/pastoral_schema.sql`
* `database/assets_schema.sql`
* `database/login_security_schema.sql`
* `database/pastoral_permissions_usage.sql`
* `database/role_feature_permissions.sql`
* `database/migrations/*.sql`

Generated import SQL files were not treated as authoritative schema design files.

## Core / Administration

| Table | Source | Notes |
| --- | --- | --- |
| `accounts` | `schema.sql`, migrations | Administrative accounts; department and role-related migrations also touch this table. |
| `account_roles` | `schema.sql` | Administrative role mapping. |
| `departments` | `schema.sql`, migrations | Department master data. |
| `role_feature_permissions` | `schema.sql`, `role_feature_permissions.sql` | Feature-level permissions. |
| `params` | `schema.sql` | Legacy parameter table. |
| `param_categories` | `core_platform_schema.sql` | Newer parameter category layer. |
| `param_items` | `core_platform_schema.sql` | Newer parameter item layer. |
| `id_rules` | `schema.sql`, `20260611_id_rules_and_meetings.sql` | Configurable entity ID rules. |
| `system_config` | `20260612_linebot_phase0_foundation.sql` | System config. |
| `system_config_keys` | `20260613_config_key_management.sql` | Centralized configurable key management. |
| `system_usage_logs` | `pastoral_permissions_usage.sql` | Usage tracking. |
| `audit_logs` | `core_platform_schema.sql` | Cross-module audit log. |

## Authentication / Security

| Table | Source | Notes |
| --- | --- | --- |
| `login_events` | `login_security_schema.sql` | Login event tracking. |
| `login_verification_challenges` | `login_security_schema.sql` | Login verification challenges. |
| `trusted_login_devices` | `login_security_schema.sql` | Trusted device tracking. |
| `counter_pin_codes` | `20260605_counter_pin_codes.sql`, later migrations | Counter PIN login and display-name/church-user updates. |

## Pastoral Domain

| Table | Source |
| --- | --- |
| `pastoral_members` | `pastoral_schema.sql`, migrations |
| `pastoral_member_addresses` | `pastoral_schema.sql` |
| `pastoral_member_contacts` | `pastoral_schema.sql` |
| `pastoral_member_faith` | `pastoral_schema.sql` |
| `pastoral_member_family_notes` | `pastoral_schema.sql` |
| `pastoral_member_files` | `pastoral_schema.sql`, file/image migrations |
| `pastoral_member_group_assignments` | `pastoral_schema.sql` |
| `pastoral_member_relationships` | `pastoral_schema.sql` |
| `pastoral_care_records` | `pastoral_schema.sql` |
| `pastoral_groups` | `pastoral_schema.sql` |
| `pastoral_group_closure` | `pastoral_schema.sql` |
| `pastoral_group_leaders` | `pastoral_schema.sql` |
| `pastoral_group_types` | `pastoral_schema.sql` |
| `churches` | `pastoral_schema.sql` |
| `countries`, `regions`, `professions` | `pastoral_schema.sql` |
| `membership_categories`, `marital_statuses`, `pastoral_titles`, `relationship_types` | `pastoral_schema.sql` |
| `baptism_events`, `baptism_participants` | `pastoral_schema.sql` |
| `account_pastoral_church_permissions` | `pastoral_permissions_usage.sql` |

## Project / Meeting / Documents

| Table | Source | Notes |
| --- | --- | --- |
| `projects` | `schema.sql`, migrations | Project master. |
| `project_people` | `schema.sql`, migrations | Project participants. |
| `project_budget` | `schema.sql`, migrations | Project budget. |
| `project_income` | `schema.sql`, migrations | Project income. |
| `project_permissions` | `schema.sql`, migrations | Project permission mapping. |
| `meetings` | `schema.sql`, `20260611_id_rules_and_meetings.sql` | Project and independent meetings. |
| `files` | `core_platform_schema.sql`, file-related migrations | File metadata. |
| `file_links` | `core_platform_schema.sql` | Links files to entities. |
| `entity_links` | `20260605_cross_system_links.sql` | Cross-system entity links. |
| `domain_events` | `20260605_cross_system_links.sql` | Domain events. |

## Finance

| Table | Source |
| --- | --- |
| `purchases` | `schema.sql`, finance migrations |
| `purchase_items` | `schema.sql` |
| `purchase_advances` | `schema.sql` |
| `purchase_advance_items` | `schema.sql` |
| `purchase_expense_proofs` | `schema.sql`, migrations |
| `purchase_expense_proof_items` | `schema.sql` |
| `purchase_payment_requests` | `schema.sql`, migrations |
| `purchase_payment_items` | `schema.sql` |

## Forms / Counter / Short Links

| Table | Source |
| --- | --- |
| `forms` | `20260605_forms_schema.sql`, `20260605_forms_counter_foundation.sql` |
| `form_questions` | `20260605_forms_schema.sql`, image upload migration |
| `form_question_options` | `20260605_forms_schema.sql` |
| `form_responses` | `20260605_forms_schema.sql`, forms-counter migration |
| `form_response_answers` | `20260605_forms_schema.sql` |
| `form_response_attachments` | `20260605_form_image_upload_schema.sql` |
| `counter_transactions` | `20260605_forms_schema.sql`, forms-counter migration, counter migration |
| `short_links` | `20260606_short_links.sql` |
| `short_link_clicks` | `20260606_short_links.sql` |

## LINE / LIFF / Notification

| Table | Source |
| --- | --- |
| `line_users` | `core_platform_schema.sql` |
| `member_accounts` | `core_platform_schema.sql` |
| `identity_providers` | `20260612_linebot_phase0_foundation.sql` |
| `line_liff_sessions` | `20260607_liff_foundation.sql` |
| `line_binding_requests` | `20260612_linebot_phase0_foundation.sql` |
| `line_bot_channels` | `20260606_linebot_foundation.sql` |
| `line_bot_links` | `20260606_linebot_foundation.sql` |
| `line_bot_module_settings` | `20260606_linebot_foundation.sql` |
| `line_bot_rich_menus` | `20260606_linebot_foundation.sql` |
| `line_bot_webhook_events` | `20260606_linebot_foundation.sql` |
| `line_bot_edm_campaigns` | `20260606_linebot_foundation.sql` |
| `line_rich_menu_assignments` | `20260612_linebot_phase2_5.sql` |
| `line_leader_scope_rules` | `20260612_linebot_phase2_5.sql` |
| `notification_logs` | `20260612_linebot_phase0_foundation.sql` |
| `notification_templates` | `20260612_linebot_phase0_foundation.sql` |
| `menu_items` | `20260612_linebot_phase2_5.sql` |

## QT

| Table | Source | Notes |
| --- | --- | --- |
| `qt_orders` | `20260605_qt_orders_schema.sql` | QT order master. |
| `qt_order_items` | `20260605_qt_orders_schema.sql` | QT order items. |
| `qt_payment_types` | `20260605_qt_orders_schema.sql` | QT payment type options. |
| `qt_price_plans` | `20260605_qt_inventory_schema.sql` | QT price plans. |
| `qt_product_types` | `20260605_qt_inventory_schema.sql` | QT product types. |
| `qt_inventory_monthly` | `20260613_qt_phase2a_inventory_foundation.sql` | Physical, reserved, retail monthly inventory foundation. |
| `qt_inventory_movements` | `20260605_qt_inventory_schema.sql`, `20260613_qt_phase2a_inventory_foundation.sql`, `20260613_qt_phase2b_inventory_reservations.sql` | QT inventory log/movement table. |
| `qt_inventory_reservations` | `20260613_qt_phase2b_inventory_reservations.sql` | QT reservation records. |

## Asset / Admin Supply

| Table | Source |
| --- | --- |
| `assets` | `assets_schema.sql`, cross-system migration |
| `asset_locations` | `assets_schema.sql` |
| `asset_location_history` | `assets_schema.sql` |
| `asset_status_history` | `assets_schema.sql` |
| `asset_maintenance_records` | `assets_schema.sql` |
| `asset_acquisition_links` | `assets_schema.sql`, cross-system migration |
| `admin_supply_items` | `20260606_admin_supplies.sql` |
| `admin_supply_movements` | `20260606_admin_supplies.sql`, `20260609_admin_supply_issue_2_3.sql` |
| `admin_supply_stocks` | `20260606_admin_supplies.sql` |

## Facilities / Attendance / Education

| Table | Source |
| --- | --- |
| `venue_reservations` | `20260605_venue_schema.sql`, overlap migration |
| `venue_resource_calendars` | `20260605_venue_schema.sql` |
| `zoom_accounts` | `20260606_zoom_reservations.sql` |
| `zoom_reservations` | `20260606_zoom_reservations.sql`, overlap migration |
| `attendance_events` | `20260606_attendance_schema.sql` |
| `attendance_records` | `20260606_attendance_schema.sql` |
| `attendance_types` | `20260606_attendance_schema.sql` |
| `attendance_summary` | `20260612_linebot_phase2_5.sql` |
| `education_course_categories` | `20260605_education_schema.sql` |
| `education_courses` | `20260605_education_schema.sql`, ID migration |
| `education_enrollments` | `20260605_education_schema.sql` |

## Operational / Development

| Table | Source |
| --- | --- |
| `qrcode_events` | `20260605_qrcode_checkin_schema.sql` |
| `qrcode_checkins` | `20260605_qrcode_checkin_schema.sql` |
| `sunday_messages` | `20260607_sunday_message_schema.sql` |
| `sunday_message_shares` | `20260607_sunday_message_schema.sql` |
| `work_logs` | `20260605_work_logs.sql` |
| `development_issues` | `schema.sql`, `20260609_dev_management.sql` |
| `development_releases` | `schema.sql`, `20260609_dev_management.sql` |
| `bpm_definitions` | `schema.sql`, `20260612_bpm_engine.sql` |
| `bpm_instances` | `schema.sql`, `20260612_bpm_engine.sql` |
| `bpm_history` | `schema.sql`, `20260612_bpm_engine.sql` |
| `mail_queue` | `20260613_mail_queue.sql` |
| `mail_quota_snapshots` | `20260613_mail_queue_management.sql` |

## Registry Notes

* Treat this registry as an onboarding index, not as live database truth.
* Before schema or migration work, inspect the exact migration files and live database.
* QT legacy data before 2026-09 has special planning constraints in `/plan/qt/`.

