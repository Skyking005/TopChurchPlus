# TopChurchPlus Current System State

Generated: 2026-06-14
Source Git HEAD: b6a002d
Mode: AI-readable snapshot generated from repository inspection
Max scope: Current state summary only. Verify source files before implementation.

## Purpose

This file gives Codex, GPT, Gemini, Claude, and Local AI a compact view of the current TopChurchPlus system without scanning the whole repository.

## Canonical Start Files

Read these first when deeper context is needed:

1. `AGENTS.md`
2. `docs/INDEX.md`
3. `docs/HANDOFF.md`
4. `docs/LESSONS_LEARNED.md`
5. `docs/architecture/SYSTEM_MAP.md`
6. `docs/architecture/MODULE_REGISTRY.md`
7. `docs/architecture/API_REGISTRY.md`
8. `docs/architecture/DATABASE_REGISTRY.md`

## Current Architecture

```text
Browser
  -> Google Apps Script Web App
    -> Index.html
    -> HTML partials + Script_*.html
    -> google.script.run
      -> Apps Script bridge
        -> NAS Node.js Express API
          -> PostgreSQL
```

Public-facing routes:

```text
LINE / LIFF / public app flows
  -> https://api.topchurchplus.com
  -> Express API public routes or Apps Script public rendering
  -> PostgreSQL
```

## Runtime Layers

| Layer | Source | Status |
| --- | --- | --- |
| Frontend shell | `Index.html` | Active |
| Apps Script bridge | Apps Script `.gs` bridge functions | Active |
| Frontend modules | `*.html`, `Script_*.html` | Active |
| API server | `api/src/index.js`, `api/src/app.js` | Active |
| API modules | `api/src/modules/*` | Active |
| Shared services | `api/src/shared/*` | Active |
| Database | `database/*.sql`, `database/migrations/*.sql` | Active |
| AI handoff docs | `docs/architecture/*REGISTRY.md`, `ai-context/*` | Active |

## API Registration

`api/src/index.js` registers middleware and module routes. API key middleware allows:

* Public paths: `/health`, `/linebot/webhook`
* Public prefixes: `/liff`

Everything else should be treated as protected unless route code proves otherwise.

Registered domains:

* Core
* Auth
* Counter
* Dev Management
* Documents
* System
* Attendance
* Pastoral
* Admin Supply
* Asset
* Finance
* Forms
* Education
* Line Bot
* LIFF
* Mail
* Project
* QRCode
* QT
* Shortlinks
* Sunday Message
* Venue
* Workflow
* Worklog
* Zoom

## Key Guardrails

* Do not rewrite whole files when a scoped patch is enough.
* Do not modify schema or migrations unless explicitly authorized.
* Do not modify payment, fulfillment, Line Bot webhook, transfer, forecast, production config, DNS, firewall, GoDaddy, or Synology settings unless explicitly authorized.
* Do not deploy unless explicitly requested.
* Preserve user changes; check `git status --short` before editing.
* Keep Identity Boundary v2 intact.

## Identity Boundary v2

Administrative Domain:

* Uses `accounts`, `account_roles`, `role_feature_permissions`.
* Controls admin/staff access and feature permissions.

Pastoral Domain:

* Uses `pastoral_members`, `pastoral_groups`, `member_accounts`, `line_users`, `line_liff_sessions`.
* Represents formal member and pastoral identity.

Rules:

* LINE User is not the formal member identity.
* Pastoral Member is the formal member subject.
* LIFF / LINE access must not be treated as a back-office account role.
* Pastoral Domain permissions must not depend on `accounts.role`.

## External Access Policy

Official external checks:

* `https://api.topchurchplus.com/health`
* `https://api.topchurchplus.com/linebot/webhook`

Do not test external direct port:

* `59.120.6.172:3000` is intentionally closed and timeout is expected.

If official domain checks fail while LAN health works, investigate:

* Synology Reverse Proxy / Web Station / Portal
* DNS
* SSL certificate binding
* Firewall or 443 forwarding
* Accidental routing to DSM 5001 or another service

## Current Important Subsystems

| Subsystem | Current State |
| --- | --- |
| Architecture Registry | Created under `docs/architecture/*REGISTRY.md`. |
| Config Key Management | `system_config_keys`, `ConfigService`, `/system/config-keys`, system UI. |
| Mail Queue | `mail_queue`, `mail_quota_snapshots`, Mail Queue API, Email Service UI, Apps Script trigger handling. |
| Login Verification Email | Approved direct-send exception, not queued. |
| QT Inventory | Monthly inventory, reservation foundation, same-church fulfillment visible in API/service. |
| LINE Bot / LIFF | Webhook, admin APIs, LIFF routes, rich menu and binding flows exist. |
| Workflow / BPM | BPM tables and `/workflow/*` APIs exist. |
| UI Design System | `docs/architecture/UI_DESIGN_SYSTEM_V1.md` exists; Bootstrap remains layout base. |

## Do Not Assume

* Do not assume live database exactly matches migration files.
* Do not assume old planning files are implemented.
* Do not assume external HTTPS is healthy without official-domain checks.
* Do not assume LINE / LIFF identity equals admin account identity.

