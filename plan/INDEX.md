# TopChurchPlus Planning Index

Status: Planning Index
Last updated: 2026-06-13

The `/plan` directory contains planning documents. It is not the source of truth for implemented behavior. Before implementation, verify actual code, database schema, API catalog, and architecture documents.

## Completed Plans

| File | Scope | Notes |
| --- | --- | --- |
| `plan/qt/QT_DOMAIN_REFACTOR_PLAN_V1.md` | QT refactor master plan. | Planning baseline; do not implement wholesale. |
| `plan/qt/QT_MIGRATION_PLAN.md` | QT migration analysis. | Analysis completed; use with DBA review. |
| `plan/qt/QT_DBA_MIGRATION_REVIEW.md` | QT Phase 2 DBA review. | DBA decision basis. |
| `plan/qt/QT_LEGACY_DATA_MIGRATION_PLAN.md` | Legacy QT migration boundary. | Defines 2026-09 clean start and legacy boundary. |
| `plan/qt/PHASE_2B_READY_CHECK.md` | Phase 2B readiness. | Completed readiness check. |
| `plan/qt/PHASE_2C_READY_CHECK.md` | Phase 2C readiness risks. | Completed risk record. |
| `plan/qt/PHASE_2C_DESIGN_FREEZE.md` | Payment/fulfillment/reconciliation boundary. | Design freeze only. |
| `plan/qt/PHASE_3A_RECONCILIATION.md` | Read-only reconciliation design. | Design completed. |
| `plan/qt/PHASE_3B_SCOPE_FREEZE.md` | Payment boundary and reservation integration scope. | Scope freeze completed. |

## In Progress Plans

| File | Scope | Notes |
| --- | --- | --- |
| `plan/qt/*` | QT refactor series. | Implementation status must be verified against code and docs before any next phase. |

## Pending Plans

| Plan | Next Action |
| --- | --- |
| QT Phase 3B/3C continuation | Verify actual code, migrations, API catalog, and tests before implementation. |
| Form System extension | Start from `docs/architecture/FORM_SYSTEM_EXTENSION_DESIGN.md`; schema changes require DBA request first. |
| Legacy QT data migration | Use `plan/qt/QT_LEGACY_DATA_MIGRATION_PLAN.md`; do not auto-backfill legacy paid-unfulfilled candidates. |

## Large Plans Not Recommended For Direct Execution

| Plan | Why Not Directly Execute |
| --- | --- |
| `plan/qt/QT_DOMAIN_REFACTOR_PLAN_V1.md` | Large multi-phase plan; execute only scoped sub-phases. |
| `plan/qt/QT_MIGRATION_PLAN.md` | Analysis document; requires phase-specific tasks and confirmation. |
| `docs/architecture/FORM_SYSTEM_EXTENSION_DESIGN.md` | Design document; schema and Identity Boundary impact must be reviewed before code. |

## Execution Rules For Plan Documents

- Treat `/plan` as planning, not implemented truth.
- Do not infer current behavior from plans without checking code.
- Do not modify schema, migrations, payment flow, fulfillment flow, Line Bot webhook, transfer, or forecast unless the task explicitly authorizes it.
- Prefer small scoped patches, then update docs and verification notes.
