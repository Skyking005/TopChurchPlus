# TopChurchPlus PostgreSQL MCP Safe Queries

Status: Query Playbook
Last updated: 2026-06-14

Use these examples through PostgreSQL MCP restricted mode with `topchurchplus_ai_reader`.

Rules:

* Prefer metadata queries first.
* Use `LIMIT` for sample data.
* Do not use `SELECT *` for large tables.
* Do not query secrets or full personal datasets.
* Do not run writes, DDL, migrations, grants, or revokes.

## Schema Inspection

List schemas:

```sql
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
ORDER BY schema_name;
```

List tables:

```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

Columns for one table:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'qt_orders'
ORDER BY ordinal_position;
```

## Primary Keys / Foreign Keys

Primary keys:

```sql
SELECT tc.table_name, kcu.column_name, kcu.ordinal_position
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'PRIMARY KEY'
ORDER BY tc.table_name, kcu.ordinal_position;
```

Foreign keys for `qt_%` tables:

```sql
SELECT tc.constraint_name,
       tc.table_name AS from_table,
       kcu.column_name AS from_column,
       ccu.table_name AS to_table,
       ccu.column_name AS to_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.constraint_schema = tc.constraint_schema
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name LIKE 'qt\_%' ESCAPE '\'
ORDER BY tc.table_name, tc.constraint_name;
```

## Indexes

Indexes for one table:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'qt_orders'
ORDER BY indexname;
```

## QT Tables

List QT tables:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'qt\_%' ESCAPE '\'
ORDER BY table_name;
```

Safe QT counts:

```sql
SELECT 'qt_orders' AS table_name, COUNT(*) AS row_count FROM qt_orders
UNION ALL
SELECT 'qt_order_items', COUNT(*) FROM qt_order_items
UNION ALL
SELECT 'qt_inventory_monthly', COUNT(*) FROM qt_inventory_monthly
UNION ALL
SELECT 'qt_inventory_reservations', COUNT(*) FROM qt_inventory_reservations;
```

Limited QT sample:

```sql
SELECT order_id, member_id, church_id, order_month, finance_status, order_status
FROM qt_orders
ORDER BY created_at DESC
LIMIT 5;
```

## Pastoral Tables

List Pastoral Domain tables:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name LIKE 'pastoral\_%' ESCAPE '\'
    OR table_name IN ('churches', 'member_accounts', 'line_users', 'line_liff_sessions')
  )
ORDER BY table_name;
```

Safe member sample:

```sql
SELECT id, member_code, name, church_id, is_active
FROM pastoral_members
ORDER BY updated_at DESC NULLS LAST
LIMIT 5;
```

## LINE User Relationship Queries

Inspect possible member mapping columns:

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('line_users', 'member_accounts', 'pastoral_members', 'line_binding_requests')
ORDER BY table_name, ordinal_position;
```

Limited relationship sample:

```sql
SELECT lu.line_user_id,
       ma.member_id,
       pm.member_code,
       pm.name
FROM line_users lu
LEFT JOIN member_accounts ma ON ma.line_user_id = lu.line_user_id
LEFT JOIN pastoral_members pm ON pm.id = ma.member_id
LIMIT 5;
```

If column names differ in live DB, inspect with `get_object_details` or `information_schema.columns` first and adjust. Do not guess.

## BPM Tables

List BPM tables:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'bpm\_%' ESCAPE '\'
ORDER BY table_name;
```

Safe BPM counts:

```sql
SELECT 'bpm_definitions' AS table_name, COUNT(*) AS row_count FROM bpm_definitions
UNION ALL
SELECT 'bpm_instances', COUNT(*) FROM bpm_instances
UNION ALL
SELECT 'bpm_history', COUNT(*) FROM bpm_history;
```

## Safe Count Pattern

```sql
SELECT COUNT(*) AS row_count
FROM public.qt_orders;
```

## Safe LIMIT 5 Pattern

```sql
SELECT id, created_at, updated_at
FROM public.bpm_instances
ORDER BY created_at DESC
LIMIT 5;
```

## Forbidden Examples

Do not run:

```sql
SELECT * FROM pastoral_members;
UPDATE qt_orders SET finance_status = 'posted';
DELETE FROM mail_queue;
ALTER TABLE qt_orders ADD COLUMN test text;
DROP TABLE line_users;
```

