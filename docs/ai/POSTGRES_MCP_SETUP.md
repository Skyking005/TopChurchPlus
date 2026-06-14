# TopChurchPlus PostgreSQL MCP Setup

Status: Draft / Local AI Development Only
Last updated: 2026-06-14

This guide explains how to connect Codex or another MCP client to TopChurchPlus PostgreSQL through `crystaldba/postgres-mcp` in restricted mode.

No production code, schema, migration, or deployment change is required.

Workflow rules live in `docs/ai/POSTGRES_MCP_WORKFLOW.md`.

## Phase 1 Inspection Result

Current repository state:

| Item | Status |
| --- | --- |
| Root `.env` | Not found in root inspection |
| Root `.env.local` | Not found in root inspection |
| `api/.env` | Exists locally; secret, do not commit |
| `api/.env.example` | Exists and contains placeholder `DATABASE_URL` |
| `AGENTS.md` | Exists |
| `docs/ai/` | Created by this task |
| `docs/database/` | Exists with generated database catalogs |
| Existing PostgreSQL config | `api/src/db.js` reads `process.env.DATABASE_URL` |
| Database registry | `docs/database/*_CATALOG.md`, `docs/architecture/DATABASE_REGISTRY.md` |
| Database schema docs | `docs/DATABASE_SCHEMA.md` |

## Tool

Repository:

`https://github.com/crystaldba/postgres-mcp`

The project README describes Postgres MCP Pro as an MCP server with schema intelligence, safe SQL execution, and configurable access modes. For production-like databases, TopChurchPlus must use restricted mode only.

## Required Database Role

Use only:

```text
topchurchplus_ai_reader
```

The role must have SELECT-only permissions. See:

```text
docs/ai/POSTGRES_MCP_READONLY_USER.sql
```

Do not connect MCP with:

* admin database user
* migration user
* application runtime user
* owner/superuser

## Docker Setup

Docker is the preferred setup because it avoids changing project dependencies.

Use a local environment variable instead of writing credentials into repo files:

```powershell
$env:DATABASE_URI = "postgresql://topchurchplus_ai_reader:<password>@<host>:5432/postgres"
docker run -i --rm `
  -e DATABASE_URI `
  crystaldba/postgres-mcp `
  --access-mode=restricted
```

Notes:

* Use `--access-mode=restricted`.
* Do not use `--access-mode=unrestricted` with production or production-like DB.
* Do not commit `DATABASE_URI`.
* If PostgreSQL is on the Windows host and Docker cannot resolve `localhost`, try `host.docker.internal`.
* Keep this as stdio/local execution. Do not publish MCP to the public network.

## Python / uv / pipx Setup

Fallback options:

```powershell
pipx install postgres-mcp
```

or:

```powershell
uv pip install postgres-mcp
```

Run in restricted mode:

```powershell
$env:DATABASE_URI = "postgresql://topchurchplus_ai_reader:<password>@<host>:5432/postgres"
postgres-mcp --access-mode=restricted
```

or:

```powershell
$env:DATABASE_URI = "postgresql://topchurchplus_ai_reader:<password>@<host>:5432/postgres"
uvx postgres-mcp --access-mode=restricted
```

## MCP Client Example

Generic MCP client config:

```json
{
  "mcpServers": {
    "topchurchplus-postgres": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "DATABASE_URI",
        "crystaldba/postgres-mcp",
        "--access-mode=restricted"
      ],
      "env": {
        "DATABASE_URI": "postgresql://topchurchplus_ai_reader:${TOPCHURCHPLUS_AI_READER_PASSWORD}@<host>:5432/postgres"
      }
    }
  }
}
```

Do not paste real passwords into checked-in config files. Keep client config outside the repository or use local environment secret substitution.

## Codex Usage Guidance

When MCP is available, Codex should prefer live schema inspection over stale docs for database assumptions.

Recommended order:

1. Use MCP object details for exact columns, primary keys, indexes, and foreign keys.
2. Use `docs/database/*_CATALOG.md` as fallback.
3. Use `docs/DATABASE_SCHEMA.md` as historical/reference context.
4. Inspect migrations only when planning schema changes, and only with explicit permission.

## Verification Checklist

After manual setup, verify that Codex can answer these using MCP:

1. What columns does `qt_orders` have?
2. How are `pastoral_members` and `line_users` related?
3. Which `bpm_*` tables exist?
4. What are primary keys and foreign keys for `qt_*` tables?
5. Which tables belong to the Pastoral Domain?
6. Can schema be understood without scanning the whole repo?
