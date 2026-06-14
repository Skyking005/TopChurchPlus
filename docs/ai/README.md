# TopChurchPlus AI Development Docs

Status: Active index
Purpose: Entry point for Codex, GPT, Gemini, Claude, Local AI, and engineers working on TopChurchPlus.

Start with `AGENTS.md`, then use this folder for task-specific governance and context.

## Fast Context

| File | Purpose |
| --- | --- |
| `PROJECT_CONTEXT_SNAPSHOT.md` | Current AI/developer project snapshot. |
| `POSTGRES_MCP_WORKFLOW.md` | Database First workflow using PostgreSQL MCP. |
| `POSTGRES_MCP_SETUP.md` | Local MCP setup guide. |
| `POSTGRES_MCP_SECURITY.md` | MCP safety rules. |
| `POSTGRES_MCP_QUERIES.md` | Safe read-only query examples. |
| `POSTGRES_MCP_INVENTORY.md` | MCP validation/inventory record when available. |

## Feature Development Governance

| File | Purpose |
| --- | --- |
| `FEATURE_DEVELOPMENT_INTAKE_TEMPLATE.md` | Required intake template before feature work. |
| `IMPACT_ASSESSMENT_CHECKLIST.md` | API / DB / UI / Permission / Identity Boundary impact checklist. |
| `REGRESSION_SMOKE_TEST_CHECKLIST.md` | Demo and release smoke test checklist. |
| `MODULE_OWNERSHIP_REGISTRY.md` | Module ownership, files, routes, tables, risks, and status. |
| `DEMO_RELEASE_READINESS_CHECKLIST.md` | Demo/release readiness, no-go criteria, rollback notes. |

## Recommended Flow For New Feature Work

1. Read `AGENTS.md`.
2. Read `docs/ai/PROJECT_CONTEXT_SNAPSHOT.md`.
3. Fill `docs/ai/FEATURE_DEVELOPMENT_INTAKE_TEMPLATE.md`.
4. Run `docs/ai/IMPACT_ASSESSMENT_CHECKLIST.md`.
5. Check `docs/ai/MODULE_OWNERSHIP_REGISTRY.md`.
6. Read product-design docs for UI, navigation, or member-facing work.
7. Use PostgreSQL MCP for DB-impacting work.
8. Implement the smallest safe patch.
9. Run `docs/ai/REGRESSION_SMOKE_TEST_CHECKLIST.md`.
10. Use `docs/ai/DEMO_RELEASE_READINESS_CHECKLIST.md` before demo/release.

## Guardrails

- Do not modify production code when a task is documentation-only.
- Do not modify schema, migrations, API, payment, fulfillment, Line Bot webhook, LIFF identity mapping, transfer, forecast, production config, DNS, or Synology settings without explicit authorization.
- Do not commit secrets, `.env`, `DATABASE_URI`, API keys, LINE secrets, or tokens.
- Preserve Identity Boundary v2: Account, Pastoral Member, and Line User are separate identities.
- Record verification results in final reports.
