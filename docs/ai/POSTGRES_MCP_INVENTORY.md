# TopChurchPlus PostgreSQL MCP Inventory

Status: WARNING - MCP installed and restricted mode verified, but DB validation is blocked by missing `topchurchplus_ai_reader` connection URI.
Last updated: 2026-06-14

## Scope

This document records PostgreSQL MCP Phase 2 validation for TopChurchPlus.

Allowed:

* MCP installation
* restricted mode startup
* metadata / SELECT-only validation

Not performed:

* production code changes
* schema changes
* migrations
* deployment
* INSERT / UPDATE / DELETE / TRUNCATE / CREATE / ALTER / DROP

## MCP Installation

| Item | Result |
| --- | --- |
| Docker | Not available on this workstation (`docker` command not found). |
| Python | Available: Python 3.13.13. |
| pipx | Not available. |
| uv | Not available. |
| Install method used | `python -m pip install --user postgres-mcp` |
| Package | `postgres-mcp` |
| Version | `0.3.0` |
| Installed location | `C:\Users\cetu\AppData\Roaming\Python\Python313\site-packages` |
| CLI path | `C:\Users\cetu\AppData\Roaming\Python\Python313\Scripts\postgres-mcp.exe` |

## MCP Startup Verification

Command shape:

```powershell
& "$env:APPDATA\Python\Python313\Scripts\postgres-mcp.exe" --access-mode=restricted
```

Startup log:

```text
INFO Starting PostgreSQL MCP Server in RESTRICTED mode
ValueError: Error: No database URL provided. Please specify via 'DATABASE_URI' environment variable or command-line argument.
```

Result:

* Restricted mode is recognized.
* MCP startup reaches server initialization.
* Full server startup is blocked because no `DATABASE_URI` was provided.

## Credential Check

Environment variables checked:

| Variable | Status |
| --- | --- |
| `DATABASE_URI` | NOT_SET |
| `TOPCHURCHPLUS_AI_READER_DATABASE_URI` | NOT_SET |
| `TOPCHURCHPLUS_AI_READER_PASSWORD` | NOT_SET |
| `PGHOST` | NOT_SET |
| `PGUSER` | NOT_SET |
| `PGDATABASE` | NOT_SET |

The application runtime credential in `api/.env` was intentionally not used because PostgreSQL MCP must only use `topchurchplus_ai_reader`.

## Step 2 Connection Validation

Status: NOT RUN.

Reason:

* `topchurchplus_ai_reader` `DATABASE_URI` is not available in the local environment.

Required future command:

```powershell
$env:DATABASE_URI = "postgresql://topchurchplus_ai_reader:<password>@<host>:5432/postgres"
& "$env:APPDATA\Python\Python313\Scripts\postgres-mcp.exe" --access-mode=restricted
```

Required validation queries:

```sql
SELECT current_database();
SELECT current_user;
SELECT current_schema();
```

Expected safety condition:

* `current_user` must be `topchurchplus_ai_reader`.

## Step 3 Schema Inventory

Status: NOT RUN through MCP.

Reason:

* Missing `DATABASE_URI`.

Once connected through MCP, validate:

```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

Domain filters:

```sql
-- bpm tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'bpm\_%' ESCAPE '\'
ORDER BY table_name;

-- qt tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'qt\_%' ESCAPE '\'
ORDER BY table_name;

-- pastoral tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'pastoral\_%' ESCAPE '\'
ORDER BY table_name;

-- line tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'line\_%' ESCAPE '\'
ORDER BY table_name;
```

## Step 4 Business Domain Discovery

Status: NOT RUN through MCP.

Reason:

* Missing `DATABASE_URI`.

Allowed future validation patterns:

```sql
SELECT COUNT(*) FROM qt_orders;

SELECT order_id, member_id, church_id, order_month, finance_status, order_status
FROM qt_orders
ORDER BY created_at DESC
LIMIT 5;
```

Do not run full table scans for sample data. Use `COUNT(*)` or `LIMIT 5`.

## Step 5 Safety Verification

Status: PARTIAL.

Verified:

* MCP CLI supports `--access-mode=restricted`.
* MCP startup log confirms `RESTRICTED mode`.
* No write query was executed.
* No schema query was executed.
* No migration was executed.

Not yet verified:

* `topchurchplus_ai_reader` can connect.
* `topchurchplus_ai_reader` has SELECT on required schema objects.
* `topchurchplus_ai_reader` lacks INSERT / UPDATE / DELETE / TRUNCATE.
* `topchurchplus_ai_reader` lacks CREATE / ALTER / DROP / GRANT / REVOKE / owner privileges.

Future safety queries:

```sql
SELECT current_user;

SELECT has_table_privilege(current_user, 'public.qt_orders', 'SELECT') AS can_select_qt_orders;
SELECT has_table_privilege(current_user, 'public.qt_orders', 'INSERT') AS can_insert_qt_orders;
SELECT has_table_privilege(current_user, 'public.qt_orders', 'UPDATE') AS can_update_qt_orders;
SELECT has_table_privilege(current_user, 'public.qt_orders', 'DELETE') AS can_delete_qt_orders;
SELECT has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_in_public;
```

Expected:

| Check | Expected |
| --- | --- |
| `current_user` | `topchurchplus_ai_reader` |
| SELECT | true |
| INSERT | false |
| UPDATE | false |
| DELETE | false |
| CREATE schema privilege | false |

## Domain Mapping

Based on existing generated database catalogs, expected domains include:

| Domain | Expected Tables |
| --- | --- |
| QT | `qt_orders`, `qt_order_items`, `qt_inventory_monthly`, `qt_inventory_reservations`, `qt_inventory_movements`, `qt_payment_types`, `qt_price_plans`, `qt_product_types` |
| Pastoral | `pastoral_members`, `pastoral_groups`, `pastoral_member_*`, `churches`, `account_pastoral_church_permissions` |
| BPM | `bpm_definitions`, `bpm_instances`, `bpm_history` |
| Identity / LINE | `line_users`, `member_accounts`, `line_liff_sessions`, `line_binding_requests`, `identity_providers` |

This mapping must be confirmed through MCP once `DATABASE_URI` is available.

## Result

```text
WARNING
```

Reason:

* Installation succeeded.
* Restricted mode startup was verified.
* Actual PostgreSQL connection and SELECT-only schema validation could not run because `topchurchplus_ai_reader` connection URI was not available in the local environment.

## Next Steps

1. Set `DATABASE_URI` locally using `topchurchplus_ai_reader`.
2. Start MCP with `--access-mode=restricted`.
3. Run Step 2 through Step 5 validation queries.
4. Update this document with actual MCP query results.
5. Keep `DATABASE_URI` and password out of Git.

