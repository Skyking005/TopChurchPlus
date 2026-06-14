-- TopChurchPlus PostgreSQL MCP read-only user plan
-- Status: Planning only. Do NOT execute without explicit owner approval.
-- Purpose: Create a least-privilege role for crystaldba/postgres-mcp restricted mode.
-- Replace the password out-of-band. Never commit real credentials.

BEGIN;

CREATE ROLE topchurchplus_ai_reader
  WITH LOGIN
  PASSWORD 'REPLACE_WITH_SECURE_PASSWORD'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION;

GRANT CONNECT ON DATABASE postgres TO topchurchplus_ai_reader;
GRANT USAGE ON SCHEMA public TO topchurchplus_ai_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO topchurchplus_ai_reader;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO topchurchplus_ai_reader;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO topchurchplus_ai_reader;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO topchurchplus_ai_reader;

REVOKE CREATE ON SCHEMA public FROM topchurchplus_ai_reader;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public
  FROM topchurchplus_ai_reader;

REVOKE CREATE ON DATABASE postgres FROM topchurchplus_ai_reader;

-- Do not revoke privileges from PUBLIC here unless DBA explicitly approves it.
-- This plan only scopes permissions for topchurchplus_ai_reader.

-- Validation examples after manual execution:
-- SELECT has_table_privilege('topchurchplus_ai_reader', 'public.qt_orders', 'SELECT');
-- SELECT has_table_privilege('topchurchplus_ai_reader', 'public.qt_orders', 'INSERT');
-- SELECT has_schema_privilege('topchurchplus_ai_reader', 'public', 'CREATE');

COMMIT;
