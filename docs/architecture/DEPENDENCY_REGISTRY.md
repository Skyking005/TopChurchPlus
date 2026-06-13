# TopChurchPlus Dependency Registry

Status: Generated from repository inspection
Last updated: 2026-06-14
Scope: Documentation only. Verify package files and deployment environment before dependency changes.

## Runtime Dependencies

| Area | Dependency | Evidence | Purpose |
| --- | --- | --- | --- |
| API | `express` | `api/package.json` | HTTP API server. |
| API | `helmet` | `api/package.json` | Security headers. |
| API | `cors` | `api/package.json` | CORS handling. |
| API | `pg` | `api/package.json` | PostgreSQL access. |
| API | `dotenv` | `api/package.json` | Environment variable loading. |
| API | `docx` | `api/package.json` | DOCX document generation. |
| Frontend CDN | Bootstrap 5.3.3 | `Index.html` | Layout and base components. |
| Frontend CDN | Tabler Icons 3.28.1 | `Index.html` | Official icon set. |
| Frontend CDN | jQuery 3.7.1 | `Index.html` | Legacy/client scripting dependency. |
| Frontend CDN | Summernote Lite 0.8.20 | `Index.html` | Rich text editing. |
| Frontend CDN | html5-qrcode 2.3.8 | `Index.html` | QRCode scanning. |

## Development Dependencies

| Dependency | Evidence | Purpose |
| --- | --- | --- |
| `@google/clasp` | root `package.json` | Apps Script deployment. |
| `@playwright/test` | root `package.json` | Browser/UI testing. |
| `@vscode/ripgrep` | root `package.json` | Fast text search. |
| `@ast-grep/cli` | root `package.json` | Structural code search. |
| `repomix` | root `package.json` | Repository context packaging. |

## Google Apps Script Services

| Service | Evidence | Purpose |
| --- | --- | --- |
| HtmlService | `程式碼.gs`, Apps Script UI | Web app rendering. |
| UrlFetchApp | Apps Script bridge pattern | Calls NAS API. |
| MailApp | `appsscript.json` send mail scope | Mail sending and quota checks. |
| ScriptApp | `appsscript.json` scriptapp scope | Mail queue trigger inspection/installation. |
| Drive API v2 | `appsscript.json` enabled advanced service | Drive file integration. |
| Google Calendar | `appsscript.json` calendar readonly scope | Venue/Zoom calendar-related reads. |

## Infrastructure Dependencies

| Dependency | Evidence | Purpose |
| --- | --- | --- |
| Synology NAS | Operations history and environment docs | Hosts API and reverse proxy. |
| Docker / Container Manager | Deployment docs/scripts | Runs API service. |
| PostgreSQL | API package and schema files | Primary database. |
| GoDaddy / DNS | Operations history | Public domain routing. |
| Reverse Proxy / HTTPS | Operations history | Routes `api.topchurchplus.com` to API service. |
| LINE Developer Console | LINE Bot docs/code | Webhook, LIFF, rich menu settings. |

## Internal Shared Dependencies

| Shared Component | Source | Typical Dependents |
| --- | --- | --- |
| Audit service | `api/src/shared/audit.js` | QT, LINE, System, security-sensitive workflows. |
| Config service | `api/src/shared/config-service.js` | System config keys, integrations, module settings. |
| Permissions | `api/src/shared/permissions.js` | Protected admin APIs and feature access. |
| Users | `api/src/shared/users.js` | Account and role lookups. |
| Files | `api/src/shared/files.js` | Pastoral, Forms, Finance, Project documents. |
| ID rules | `api/src/shared/id-rules.js` | Project, Course, Pastoral member IDs. |
| Params | `api/src/shared/params.js` | Option lists and system-managed parameters. |
| Cross-system links | `api/src/shared/cross-system.js` | Asset/finance/project/entity linkage. |
| Repository | `api/src/shared/repository.js` | Shared data access utility. |

## Cross-Module Dependency Map

| From | To | Dependency |
| --- | --- | --- |
| LINE / LIFF | Pastoral | Member binding must map LINE users to Pastoral Members, not administrative accounts. |
| QT | Pastoral / Churches | QT orders and reports depend on member/church context. |
| Attendance | Pastoral | Attendance views reference small groups and members. |
| Education | Pastoral | Enrollments and member mapping can depend on pastoral member data. |
| QRCode | LINE / Pastoral | QRCode check-ins may use LINE identity and member context. |
| Counter | QT / Forms | Counter workbench handles QT pickup/payment and form-related transactions. |
| Finance | Files / Documents | Quote PDFs, expense proofs, payment docs. |
| Project | Meetings / Documents / Finance | Project detail includes meetings, permissions, budget/income, document generation. |
| Forms | Short Links / Files | Public form access and response attachments. |
| Email Service | Apps Script MailApp / ScriptApp | Queue status, quota, trigger operations. |
| System | Config Keys / Params / Permissions | Centralized module configuration and access governance. |

## Dependency Guardrails

* Do not bypass `ConfigService` for new configurable keys.
* Do not call `MailApp.sendEmail()` directly for queued notifications; login verification remains an explicit exception.
* Do not couple Pastoral Domain permissions to administrative account roles.
* Do not test external health through `59.120.6.172:3000`; use `https://api.topchurchplus.com/health`.
* Do not add new runtime libraries without checking existing patterns and deployment impact.

