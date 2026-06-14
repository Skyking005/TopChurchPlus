# PostgreSQL MCP Workflow

Status: Active Workflow Rule
Last updated: 2026-06-14

## 1. Purpose

PostgreSQL MCP is TopChurchPlus's database verification tool layer. It lets AI agents confirm the actual PostgreSQL schema, tables, relationships, row counts, and data boundaries before development work.

MCP is not a migration tool, not a deployment tool, and not a production DB admin tool.

## 2. When MCP Is Required

The following tasks must use MCP first when MCP is available:

* PostgreSQL schema analysis
* API development
* Report development
* QT domain changes
* Pastoral domain changes
* LINE Bot data integration
* BPM integration
* migration planning
* data repair planning
* DB impact analysis
* permission / role analysis
* cross-table relationship analysis

## 3. When MCP Is Not Required

The following tasks usually do not need MCP:

* pure UI styling
* CSS-only changes
* copywriting
* static documentation editing
* frontend layout-only adjustment
* design system draft without data dependency

If a UI change involves data fields, API payloads, report columns, or permission decisions, MCP is still required.

## 4. Required Workflow

For any task involving the database:

1. Read relevant docs.
2. Use PostgreSQL MCP to verify the actual schema.
3. Compare MCP results with docs.
4. Identify affected tables, APIs, UI files, and reports.
5. Produce an impact summary.
6. Only then implement code changes.

Do not guess schema first and write code from that guess.

## 5. Safety Rules

MCP must follow these rules:

* `access-mode=restricted`
* DB user is `topchurchplus_ai_reader`
* SELECT-only
* `LIMIT 5` by default
* No full table scan unless explicitly approved
* No sensitive field content query
* No write SQL
* No migration
* No deployment

Forbidden SQL through MCP:

```text
INSERT
UPDATE
DELETE
TRUNCATE
DROP
ALTER
CREATE
GRANT
REVOKE
```

Forbidden sensitive content queries include fields whose names contain:

```text
password
token
secret
credential
api_key
private_key
```

## 6. Required Output Format

Every time Codex uses MCP, the final report must include:

| Field | Required Value |
| --- | --- |
| MCP used | yes / no |
| DB user | expected `topchurchplus_ai_reader` |
| access mode | expected `restricted` |
| queried tables | list of tables |
| query type | metadata / count / sample |
| affected modules | module names |
| schema-doc mismatch | yes / no |
| risk level | LOW / MEDIUM / HIGH |
| next action | proposed follow-up |

If MCP is required but unavailable, report:

* MCP used: no
* reason unavailable
* fallback used
* risk level
* whether work should pause before implementation

## 7. Relationship With Skills

Do not create a standalone `postgres-mcp` skill at this time.

Reason:

PostgreSQL MCP is a tool layer, not a complete workflow. If future skills are created, they should be workflow-oriented, for example:

* `db-impact-analysis`
* `identity-boundary-check`
* `qt-domain-review`
* `report-impact-analysis`

Those skills may call MCP, but MCP itself should not be wrapped as its own skill.

## Related Documents

* `docs/ai/POSTGRES_MCP_SETUP.md`
* `docs/ai/POSTGRES_MCP_SECURITY.md`
* `docs/ai/POSTGRES_MCP_QUERIES.md`
* `docs/ai/POSTGRES_MCP_INVENTORY.md`
* `docs/ai/POSTGRES_MCP_READONLY_USER.sql`
