# TopChurchPlus Feature Registry

Status: Generated from repository inspection
Last updated: 2026-06-14
Scope: Documentation only. Feature availability is based on `Script_FeatureConfig.html` and observed module files.

## Feature Configuration Source

Front-end feature cards and access defaults are defined in `Script_FeatureConfig.html`.

## Feature-to-Module Mapping

| Feature Key | Display Name | Action | UI Partial | Script Partial | API Module | Observed Status |
| --- | --- | --- | --- | --- | --- | --- |
| `project` | 專案管理系統 | `openProjectSystem` | `ProjectDetail.html`, project sections | `Script_Project*.html` | `project`, `documents` | Active |
| `finance` | 財務管理系統 | `openPurchaseSystem` | `Purchase.html` | `Script_Purchase.html` | `finance`, `documents` | Active |
| `admin_supply` | 行政物資管理系統 | `openAdminSupplySystem` | `AdminSupply.html` | `Script_AdminSupply.html` | `admin-supply` | Active |
| `asset` | 資產管理系統 | `openAssetSystem` | `Asset.html` | `Script_Asset.html` | `asset` | Active |
| `system` | 系統管理 | `openSystemManagement` | `ParameterModal.html` and system views | `Script_ParameterModal.html` | `system` | Active |
| `dev_management` | 系統開發管理 | `openDevManagementSystem` | `DevManagement.html` | `Script_DevManagement.html` | `dev-management` | Active |
| `venue` | 場地預約系統 | `openVenueSystem` | `Venue.html` | `Script_Venue.html` | `venue` | Active |
| `zoom` | Zoom帳號管理系統 | `openZoomSystem` | `Zoom.html` | `Script_Zoom.html` | `zoom` | Active |
| `sunday_message` | 主日信息管理系統 | `openSundayMessageSystem` | `SundayMessage.html` | `Script_SundayMessage.html` | `sunday-message` | Active |
| `meeting` | 會議管理 | `openMeetingsSystem` | `Meetings.html`, `MeetingModal.html` | `Script_Meetings.html` | `project` | Active |
| `forms` | 表單系統 | `openFormsSystem` | `Forms.html` | `Script_Forms.html` | `forms`, `shortlinks` | Active |
| `counter` | 櫃台工作台 | `openCounterWorkbench` | `Counter.html` | `Script_Counter.html` | `counter`, `auth` | Active |
| `qrcode` | QRCode 活動管理 | `openQrcodeSystem` | `Qrcode.html` | `Script_Qrcode.html` | `qrcode` | Active |
| `qt` | QT 管理系統 | `openQtSystem` | `Qt.html` | `Script_Qt.html` | `qt` | Active |
| `linebot` | Line App會友管理系統 | `openLineBotSystem` | `LineBot.html` | `Script_LineBot.html` | `linebot`, `liff` | Active |
| `email_service` | Email 服務管理系統 | `openEmailServiceSystem` | `EmailService.html` | `Script_EmailService.html` | `mail` | Active |
| `pastoral` | 牧養管理系統 | `openPastoralSystem` | `Pastoral.html` | `Script_Pastoral.html` | `pastoral` | Active |
| `education` | 教育管理系統 | `openEducationSystem` | `Education.html` | `Script_Education.html` | `education` | Active |
| `attendance` | 聚會統計系統 | `openAttendanceSystem` | `Attendance.html` | `Script_Attendance.html` | `attendance` | Active |
| `media` | 媒體管理系統 | `openComingSoonSystem` | Not found | Not found | Not found | Coming soon |
| `worship` | 敬拜管理系統 | `openComingSoonSystem` | Not found | Not found | Not found | Coming soon |
| `serving` | 服事管理系統 | `openComingSoonSystem` | Not found | Not found | Not found | Coming soon |

## Role Access Defaults

| Role | Feature Keys |
| --- | --- |
| 超級管理者 | `project`, `meeting`, `finance`, `admin_supply`, `asset`, `venue`, `zoom`, `forms`, `counter`, `qrcode`, `qt`, `linebot`, `email_service`, `pastoral`, `education`, `media`, `worship`, `attendance`, `serving`, `system`, `dev_management` |
| 管理員 | `project`, `meeting`, `finance`, `admin_supply`, `asset`, `venue`, `zoom`, `forms`, `counter`, `qrcode`, `qt`, `linebot`, `email_service`, `pastoral`, `education`, `media`, `worship`, `attendance`, `serving` |
| 全職同工 | `project`, `meeting`, `finance`, `admin_supply`, `venue`, `zoom`, `forms`, `counter`, `qrcode`, `qt`, `linebot`, `worship`, `attendance`, `serving` |
| 技術同工 | `asset` |
| 牧養同工 | `pastoral` |
| 教育同工 | `education` |
| 媒體同工 | `media`, `worship` |
| 義工 | `counter`, `qt`, `serving` |

## Feature Notes

* The registry reflects configured feature cards, not necessarily complete business readiness.
* `meeting` uses the project API route module for meeting data.
* `email_service` exists as a system/admin feature for Mail Queue monitoring and trigger management.
* `media`, `worship`, and `serving` are configured as coming soon features, with no dedicated API modules found in this scan.
* Identity-sensitive features include `linebot`, `pastoral`, `attendance`, `education`, `qt`, and `qrcode`.

