# TopChurchPlus Documentation Index

Status: Living Index
Last updated: 2026-06-13

This index is the first stop for humans, Codex, and other AI agents. It records where to look; it does not replace the source documents.

## Start Here

| File | Purpose | Status |
| --- | --- | --- |
| `AGENTS.md` | Codex operating rules and guardrails. | Active |
| `docs/HANDOFF.md` | Current handoff, next steps, blockers, and operational cautions. | Active |
| `docs/LESSONS_LEARNED.md` | Project pitfalls and prevention rules. | Active |
| `docs/PROJECT_OVERVIEW.md` | Project scope and high-level module view. | Active |
| `docs/CURRENT_ARCHITECTURE.md` | Current system architecture and active integration rules. | Active |
| `docs/ACTIVE_ROADMAP.md` | Near-term priorities. | Active |

## Architecture Documents

| File | Purpose | Status |
| --- | --- | --- |
| `docs/architecture/README.md` | Architecture documentation map. | Active |
| `docs/architecture/CURRENT_DEVELOPMENT_ENVIRONMENT.md` | Actual repo, runtime, deployment, and environment inventory. | Active |
| `docs/architecture/UI_DESIGN_SYSTEM_V1.md` | Official UI design system. | Active |
| `docs/architecture/FORM_SYSTEM_EXTENSION_DESIGN.md` | Form system extension design. | Planning |
| `docs/CURRENT_ARCHITECTURE.md` | Current architecture source for agent handoff. | Active |
| `docs/SYSTEM_ARCHITECTURE.md` | Older architecture reference. | Needs review |
| `docs/core_platform_architecture.md` | Core platform architecture notes. | Reference |
| `docs/IDENTITY_BOUNDARY_V2.md` | Administrative Domain vs Pastoral Domain boundary. | Active |

## UI Standards

| File | Purpose | Status |
| --- | --- | --- |
| `docs/ui/README.md` | UI documentation map and governance entry. | Active |
| `docs/architecture/UI_DESIGN_SYSTEM_V1.md` | Design tokens, layout, buttons, cards, tables, forms, status badges, notifications. | Active |
| `UI_REFRESH_PHASE1_REPORT.md` | Phase 1 UI refresh report. | Completed report |

## Module Specifications

| File | Purpose | Status |
| --- | --- | --- |
| `docs/modules/README.md` | Module documentation map. | Active |
| `docs/MODULES.md` | Module inventory. | Active |
| `docs/API_CATALOG.md` | API catalog and Apps Script helper notes. | Active |
| `docs/DATABASE_SCHEMA.md` | Database schema inventory. | Active |
| `docs/attendance_rollcall_design.md` | Attendance design. | Planning |
| `docs/asset_management_design.md` | Asset management design. | Reference |
| `docs/venue_reservation_design.md` | Venue reservation design. | Planning |
| `docs/MAIL_QUEUE_LEGACY_SEND_EMAIL_AUDIT.md` | Mail Queue legacy send audit. | Active |
| `docs/reviews/QT_DBA_REVIEW.md` | QT DBA review reference. | Superseded by `plan/qt/QT_DBA_MIGRATION_REVIEW.md`; keep as reference |

## Deployment And Operations

| File | Purpose | Status |
| --- | --- | --- |
| `docs/operations/README.md` | Operations documentation map. | Active |
| `docs/WORKFLOW.md` | Development, validation, smoke test, and deployment workflow notes. | Active |
| `docs/TEST_MATRIX.md` | Regression and module test matrix. | Active |
| `docs/DISASTER_RECOVERY_REBUILD.md` | Rebuild and recovery guide. | Active |
| `docs/RECOVERY_SECRETS_CHECKLIST.md` | Secret recovery checklist. | Active |
| `docs/DOCUMENTATION_MAINTENANCE.md` | Documentation maintenance rules. | Active |
| `docs/DATABASE_MIGRATION_WORKFLOW.md` | Database migration workflow. | Active |
| `docs/LEGACY_MSSQL_SYNC_WORKFLOW.md` | Legacy MSSQL sync workflow. | Active |
| `docs/regression/20260605_system_regression.md` | Regression record. | Historical |

## AI Development Context

| File | Purpose | Status |
| --- | --- | --- |
| `docs/AI_WORKFLOW.md` | AI workflow rules. | Active |
| `docs/AI_CONTEXT_WORKFLOW.md` | AI context snapshot workflow. | Active |
| `docs/LOCAL_AI_TASK_GUIDE.md` | Local AI preflight task guide. | Active |
| `docs/LOCAL_AI_WORKFLOW.md` | Local AI workflow. | Active |
| `docs/REMOTE_AI_GUARDRAILS.md` | Remote AI restrictions. | Active |
| `docs/REMOTE_LOCAL_AI_GITHUB_WORKFLOW.md` | Remote/local AI and GitHub workflow. | Active |
| `docs/TOPCHURCHPLUS_SKILL.md` | Project skill context. | Active |
| `docs/NEW_THREAD_GUIDE.md` | New thread instructions. | Active |

## Root-Level Documents

| File | Purpose | Status |
| --- | --- | --- |
| `PROJECT_STATE.md` | Project state dashboard. | Active but should be reconciled with `docs/HANDOFF.md` periodically |
| `DECISION_LOG.md` | Root-level decision log. | Duplicate candidate with `docs/DECISION_LOG.md` |
| `UI_REFRESH_PHASE1_REPORT.md` | UI refresh report. | Completed report |
| `AGENTS.md` | Agent guide. | Active |

## Deprecated Or Needs Review

These files should not be deleted without explicit approval. Mark as deprecated or move to an archive in a later cleanup task if confirmed.

| File | Reason |
| --- | --- |
| `docs/SYSTEM_ARCHITECTURE.md` | May duplicate `docs/CURRENT_ARCHITECTURE.md`; needs source-of-truth decision. |
| `docs/reviews/QT_DBA_REVIEW.md` | Likely superseded by `plan/qt/QT_DBA_MIGRATION_REVIEW.md`; keep as historical review. |
| `DECISION_LOG.md` and `docs/DECISION_LOG.md` | Duplicate decision logs; choose one canonical file later. |
| `PROJECT_STATE.md` and `docs/HANDOFF.md` | Overlap in current-state content; keep `HANDOFF` for agent handoff and `PROJECT_STATE` for dashboard if both remain. |
| Older design docs under `docs/*.md` | Several planning docs may not reflect implemented code; verify before implementation. |

## Current External API Check Policy

- Official external health check: `https://api.topchurchplus.com/health`.
- Official LINE webhook endpoint: `https://api.topchurchplus.com/linebot/webhook`.
- Do not test `59.120.6.172:3000`; direct external 3000 access is intentionally closed.
- If official domain checks fail while LAN health works, focus on Synology Reverse Proxy / Web Station / Portal, DNS, SSL certificate, firewall or 443 forwarding, and accidental routing to DSM 5001.
