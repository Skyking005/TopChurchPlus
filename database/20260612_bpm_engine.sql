BEGIN;

CREATE TABLE IF NOT EXISTS bpm_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  definition_key text NOT NULL UNIQUE,
  owner_role text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bpm_definitions_key_format CHECK (definition_key ~ '^[a-z][a-z0-9_]{1,60}$')
);

CREATE TABLE IF NOT EXISTS bpm_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id uuid NOT NULL REFERENCES bpm_definitions(id) ON DELETE RESTRICT,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  entity_code text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  creator_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  creator_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bpm_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES bpm_instances(id) ON DELETE CASCADE,
  node_key text,
  node_name text,
  approver_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  approver_name text,
  action text NOT NULL CHECK (action IN ('SUBMIT', 'APPROVE', 'REJECT', 'COMMENT', 'CANCEL')),
  comment text,
  file_link_ids bigint[] NOT NULL DEFAULT '{}'::bigint[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bpm_definitions_active_key
  ON bpm_definitions (is_active, definition_key);

CREATE INDEX IF NOT EXISTS idx_bpm_instances_definition_status
  ON bpm_instances (definition_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_bpm_instances_entity
  ON bpm_instances (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_bpm_instances_creator
  ON bpm_instances (creator_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_bpm_history_instance_time
  ON bpm_history (instance_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bpm_history_approver_time
  ON bpm_history (approver_id, created_at DESC);

WITH defaults(role, feature_key, access_level) AS (
  VALUES
    ('超級管理者', 'workflow', 'edit'),
    ('管理員', 'workflow', 'edit'),
    ('全職同工', 'workflow', 'read')
)
INSERT INTO role_feature_permissions (role, feature_key, access_level)
SELECT role, feature_key, access_level
FROM defaults
ON CONFLICT (role, feature_key) DO NOTHING;

COMMIT;
