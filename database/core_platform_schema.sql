BEGIN;

CREATE TABLE IF NOT EXISTS param_categories (
  category_key text PRIMARY KEY,
  category_name text NOT NULL,
  system_key text,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS param_items (
  param_id bigserial PRIMARY KEY,
  category_key text NOT NULL REFERENCES param_categories(category_key) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_key, code)
);

CREATE INDEX IF NOT EXISTS idx_param_items_category_active
  ON param_items (category_key, is_active, sort_order, label);

CREATE TABLE IF NOT EXISTS files (
  file_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_name text NOT NULL,
  stored_name text NOT NULL,
  mime_type text,
  file_size bigint,
  storage_provider text NOT NULL DEFAULT 'nas',
  storage_path text NOT NULL,
  file_data bytea,
  uploaded_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  uploaded_by_member_id integer REFERENCES pastoral_members(id) ON DELETE SET NULL,
  checksum text,
  is_deleted boolean NOT NULL DEFAULT false,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_files_uploaded_by_staff
  ON files (uploaded_by_staff_id, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_files_uploaded_by_member
  ON files (uploaded_by_member_id, uploaded_at DESC);

CREATE TABLE IF NOT EXISTS file_links (
  file_link_id bigserial PRIMARY KEY,
  file_id uuid NOT NULL REFERENCES files(file_id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  file_type text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (file_id, entity_type, entity_id, file_type)
);

CREATE INDEX IF NOT EXISTS idx_file_links_entity
  ON file_links (entity_type, entity_id, file_type, sort_order);

CREATE INDEX IF NOT EXISTS idx_file_links_purchase_quotes
  ON file_links (entity_type, entity_id, file_type, created_at DESC)
  WHERE entity_type = 'purchase' AND file_type = 'quote_pdf';

CREATE TABLE IF NOT EXISTS audit_logs (
  audit_id bigserial PRIMARY KEY,
  staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  member_id integer REFERENCES pastoral_members(id) ON DELETE SET NULL,
  system_key text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_time
  ON audit_logs (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_staff_time
  ON audit_logs (staff_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_system_time
  ON audit_logs (system_key, created_at DESC);

CREATE TABLE IF NOT EXISTS member_accounts (
  member_account_id bigserial PRIMARY KEY,
  member_id integer NOT NULL REFERENCES pastoral_members(id) ON DELETE CASCADE,
  login_identifier text UNIQUE,
  display_name text,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_accounts_member
  ON member_accounts (member_id);

CREATE TABLE IF NOT EXISTS line_users (
  line_user_id text PRIMARY KEY,
  member_id integer REFERENCES pastoral_members(id) ON DELETE SET NULL,
  member_account_id bigint REFERENCES member_accounts(member_account_id) ON DELETE SET NULL,
  display_name text,
  picture_url text,
  status_message text,
  is_active boolean NOT NULL DEFAULT true,
  bound_at timestamptz,
  last_interaction_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_line_users_member
  ON line_users (member_id);

CREATE INDEX IF NOT EXISTS idx_line_users_last_interaction
  ON line_users (last_interaction_at DESC);

INSERT INTO param_categories (category_key, category_name, system_key, sort_order)
VALUES
  ('projectTypes', '專案類型', 'project', 10),
  ('duties', '職務', 'project', 20),
  ('positions', '職稱', 'system', 30),
  ('units', '執行單位', 'project', 40),
  ('differenceMethods', '收支差額處理方式', 'project', 50),
  ('meetingStatus', '會議狀態', 'project', 60),
  ('projectStatus', '專案狀態', 'project', 70),
  ('projectPermissions', '專案權限', 'project', 80),
  ('chargeOptions', '收費選項', 'project', 90),
  ('purchaseStatus', '採購狀態', 'finance', 100),
  ('purchaseTypes', '採購類型', 'finance', 105),
  ('paymentMethods', '支付方式', 'finance', 110),
  ('departments', '部門', 'system', 120),
  ('assetTypes', '資產類型', 'asset', 130),
  ('assetVendors', '資產廠商', 'asset', 140),
  ('assetStatuses', '資產狀態', 'asset', 150)
ON CONFLICT (category_key) DO UPDATE SET
  category_name = EXCLUDED.category_name,
  system_key = EXCLUDED.system_key,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO param_items (category_key, code, label, sort_order)
SELECT category, value, value, sort_order
FROM params
ON CONFLICT (category_key, code) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

COMMIT;
