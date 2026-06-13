# Architecture Documentation

Status: Active
Last updated: 2026-06-13

## Canonical Architecture Files

| File | Purpose |
| --- | --- |
| `docs/CURRENT_ARCHITECTURE.md` | Current architecture and active integration rules. |
| `docs/architecture/CURRENT_DEVELOPMENT_ENVIRONMENT.md` | Actual development and deployment environment inventory. |
| `docs/IDENTITY_BOUNDARY_V2.md` | Administrative Domain and Pastoral Domain boundary. |
| `docs/architecture/UI_DESIGN_SYSTEM_V1.md` | UI design system architecture and tokens. |
| `docs/API_CATALOG.md` | API catalog. |
| `docs/DATABASE_SCHEMA.md` | Schema inventory. |

## Planning Architecture Files

| File | Purpose |
| --- | --- |
| `docs/architecture/FORM_SYSTEM_EXTENSION_DESIGN.md` | Form system extension design. |
| `docs/core_platform_architecture.md` | Core platform reference. |

## Needs Review

| File | Reason |
| --- | --- |
| `docs/SYSTEM_ARCHITECTURE.md` | May be older than `docs/CURRENT_ARCHITECTURE.md`; verify before using. |

## External API Verification Policy

- Official external health check: `https://api.topchurchplus.com/health`.
- Official LINE webhook endpoint: `https://api.topchurchplus.com/linebot/webhook`.
- Internal LAN health `http://192.168.3.2:3000/health` only verifies the NAS container.
- Do not test `59.120.6.172:3000`; external direct 3000 access is intentionally closed.
- If official domain checks fail while LAN health works, investigate Synology Reverse Proxy / Web Station / Portal, DNS, firewall or 443 forwarding, SSL certificate binding, and accidental routing to DSM 5001.
