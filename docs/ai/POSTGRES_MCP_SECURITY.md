# TopChurchPlus PostgreSQL MCP Security

Status: Active Guardrail
Last updated: 2026-06-14

## Security Objective

PostgreSQL MCP is an AI development aid only. It must help Codex understand real schema without allowing data mutation, schema mutation, migration, or public exposure.

## Mandatory Role

Only use:

```text
topchurchplus_ai_reader
```

Reason:

* Least privilege.
* SELECT-only access.
* Separate audit and credential lifecycle from app runtime.
* Prevent accidental writes from generated SQL.

## Forbidden Credentials

Never use these with MCP:

* PostgreSQL superuser
* database owner
* migration user
* application runtime user
* admin user
* any credential from `api/.env`

## Restricted Mode Required

For production or production-like databases:

```text
--access-mode=restricted
```

Restricted mode limits SQL execution to read-only transactions and adds resource constraints. This is required even when the database user is already read-only.

Never use:

```text
--access-mode=unrestricted
```

against production or production-like TopChurchPlus data.

## Network Boundary

MCP must run locally or on a private developer workstation.

Forbidden:

* public internet exposure
* public Docker port publishing
* reverse proxy to MCP
* hosting MCP on GoDaddy / Synology public portal
* sharing MCP endpoint with unauthenticated clients

If SSE transport is used for a local experiment, bind only to localhost or a trusted private interface and do not expose it through firewall/NAT.

## Query Restrictions

Allowed:

* schema inspection
* table list
* column list
* primary key / foreign key / index inspection
* `SELECT COUNT(*)`
* limited samples with `LIMIT 5`
* metadata queries against `information_schema` and `pg_catalog`

Avoid or require explicit approval:

* large sample queries
* `SELECT *` without `LIMIT`
* sensitive personal data fields
* email, phone, address, token, secret, or credential columns
* full export style queries

Forbidden:

* `INSERT`
* `UPDATE`
* `DELETE`
* `TRUNCATE`
* `CREATE`
* `ALTER`
* `DROP`
* `GRANT`
* `REVOKE`
* migration execution
* maintenance operations

## Secret Handling

* Never commit `DATABASE_URI`.
* Never commit MCP client config containing a password.
* Never paste DB passwords into docs, GitHub, issues, AI context, or logs.
* Use local environment variables or OS secret storage.
* Keep `.env` ignored.

## Disable / Rollback Steps

If MCP access must be disabled:

```sql
REVOKE CONNECT ON DATABASE postgres FROM topchurchplus_ai_reader;
ALTER ROLE topchurchplus_ai_reader NOLOGIN;
```

If the role must be fully removed after confirming no active sessions:

```sql
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM topchurchplus_ai_reader;
REVOKE SELECT ON ALL SEQUENCES IN SCHEMA public FROM topchurchplus_ai_reader;
REVOKE USAGE ON SCHEMA public FROM topchurchplus_ai_reader;
DROP ROLE topchurchplus_ai_reader;
```

Also remove local MCP client config and clear local environment variables.

## Acceptance Checklist

* MCP uses `topchurchplus_ai_reader`.
* MCP is started with `--access-mode=restricted`.
* No credentials are committed.
* MCP is not public.
* AI queries use `LIMIT` for sample data.
* Database writes and migrations are impossible from both DB role permissions and MCP access mode.

