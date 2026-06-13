# TopChurchPlus Current Feature Status

Generated: 2026-06-14
Source Git HEAD: b6a002d
Mode: AI-readable snapshot generated from repository inspection
Max scope: Feature status summary only. Verify module files before implementation.

## Purpose

This file maps configured features to implementation evidence so future AI agents can quickly decide where to inspect next.

Primary source:

* `Script_FeatureConfig.html`
* `Index.html`
* `api/src/modules/*`
* `docs/architecture/FEATURE_REGISTRY.md`
* `docs/architecture/MODULE_REGISTRY.md`

## Active Feature Map

| Feature Key | Display Name | UI | API | Status |
| --- | --- | --- | --- | --- |
| `project` | 專案管理系統 | `ProjectDetail.html`, `Script_Project*.html` | `project`, `documents` | Active |
| `meeting` | 會議管理 | `Meetings.html`, `MeetingModal.html` | `project` meeting routes | Active |
| `finance` | 財務管理系統 | `Purchase.html`, `Script_Purchase.html` | `finance`, `documents` | Active |
| `admin_supply` | 行政物資管理系統 | `AdminSupply.html`, `Script_AdminSupply.html` | `admin-supply` | Active |
| `asset` | 資產管理系統 | `Asset.html`, `Script_Asset.html` | `asset` | Active |
| `system` | 系統管理 | System/parameter UI | `system` | Active |
| `dev_management` | 系統開發管理 | `DevManagement.html`, `Script_DevManagement.html` | `dev-management` | Active |
| `venue` | 場地預約系統 | `Venue.html`, `Script_Venue.html` | `venue` | Active |
| `zoom` | Zoom帳號管理系統 | `Zoom.html`, `Script_Zoom.html` | `zoom` | Active |
| `sunday_message` | 主日信息管理系統 | `SundayMessage.html`, `Script_SundayMessage.html` | `sunday-message` | Active |
| `forms` | 表單系統 | `Forms.html`, `Script_Forms.html` | `forms`, `shortlinks` | Active |
| `counter` | 櫃台工作台 | `Counter.html`, `Script_Counter.html` | `counter`, `auth` | Active |
| `qrcode` | QRCode 活動管理 | `Qrcode.html`, `Script_Qrcode.html` | `qrcode` | Active |
| `qt` | QT 管理系統 | `Qt.html`, `Script_Qt.html` | `qt` | Active, refactor in progress |
| `linebot` | Line App會友管理系統 | `LineBot.html`, `Script_LineBot.html` | `linebot`, `liff` | Active |
| `email_service` | Email 服務管理系統 | `EmailService.html`, `Script_EmailService.html` | `mail` | Active |
| `pastoral` | 牧養管理系統 | `Pastoral.html`, `Script_Pastoral.html` | `pastoral` | Active |
| `education` | 教育管理系統 | `Education.html`, `Script_Education.html` | `education` | Active |
| `attendance` | 聚會統計系統 | `Attendance.html`, `Script_Attendance.html` | `attendance` | Active |

## Coming Soon / Configured Only

| Feature Key | Display Name | Evidence | Status |
| --- | --- | --- | --- |
| `media` | 媒體管理系統 | Feature config only | Coming soon |
| `worship` | 敬拜管理系統 | Feature config only | Coming soon |
| `serving` | 服事管理系統 | Feature config only | Coming soon |

## Recent Feature Infrastructure

| Area | Evidence | Status |
| --- | --- | --- |
| Architecture Registry v1 | `docs/architecture/*REGISTRY.md` | Completed |
| Config Key Management | `system_config_keys`, `ConfigService`, `/system/config-keys` | MVP active |
| Mail Queue Management | `mail_queue`, `mail_quota_snapshots`, `/mail/queue*`, Email Service UI | Active |
| Mail Trigger Safety | `appsscript.json` has `script.scriptapp`; trigger checks should return permission-required status instead of breaking dashboard | Active |
| Login Verification Email | Direct MailApp exception approved for verification codes | Active |
| UI Design System | `docs/architecture/UI_DESIGN_SYSTEM_V1.md` and Phase 1 UI refresh | Active standard |
| Workflow / BPM | `bpm_*` tables and `/workflow/*` routes | V1 active |

## QT Feature State

Implemented evidence:

* QT options, dashboard, settings APIs.
* Monthly inventory foundation with `qt_inventory_monthly`.
* Reservation foundation with `qt_inventory_reservations`.
* Reconciliation endpoint exists.
* Payment approval endpoint exists: `POST /qt/orders/:orderId/payment/approve`.
* Same-church fulfillment endpoint exists: `POST /qt/order-items/:orderItemId/fulfill`.
* Service code uses transaction/row-lock patterns for reservation and fulfillment.

Explicitly not included in current safe scope unless a task asks:

* Cross-church transfer implementation.
* Line Bot / LIFF QT selling logic.
* Forecast engine.
* Legacy paid-unfulfilled auto-backfill.

## Role Feature Defaults

Highest-level roles from feature config:

* Super admin: all configured active and coming-soon features plus system and dev management.
* Admin: operational features including Email Service, LINE Bot, QT, pastoral, education, attendance.
* Full-time staff: project, meeting, finance, admin supply, venue, zoom, forms, counter, qrcode, QT, LINE Bot, worship, attendance, serving.
* Specialist roles: asset, pastoral, education, media/worship.
* Volunteer: counter, QT, serving.

Always verify permissions in API and feature-permission tables; do not rely only on front-end hiding.

## High-Risk Feature Boundaries

* Pastoral/LINE/LIFF must preserve Identity Boundary v2.
* QT inventory must not mix with admin supply inventory.
* Mail notifications should use Mail Queue unless the task is login verification code email.
* Payment/fulfillment/transfer/forecast require explicit task scope.
* External API smoke tests must use official domain, not direct external port 3000.

