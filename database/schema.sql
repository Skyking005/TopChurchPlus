CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS accounts (
  staff_id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  position TEXT,
  role TEXT NOT NULL DEFAULT '一般使用者',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS account_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id TEXT NOT NULL REFERENCES accounts(staff_id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id, role)
);

CREATE TABLE IF NOT EXISTS role_feature_permissions (
  role TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'none' CHECK (access_level IN ('none', 'read', 'edit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role, feature_key)
);

CREATE TABLE IF NOT EXISTS params (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category, value)
);

CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  login_user TEXT NOT NULL,
  project_name TEXT NOT NULL,
  project_type TEXT,
  start_date DATE,
  end_date DATE,
  units TEXT[] NOT NULL DEFAULT '{}',
  content TEXT,
  is_charged TEXT NOT NULL DEFAULT '否',
  total_income NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_budget NUMERIC(14,2) NOT NULL DEFAULT 0,
  difference_method TEXT,
  status TEXT NOT NULL DEFAULT '規劃中',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  duty TEXT,
  person TEXT,
  item TEXT,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS project_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  unit TEXT,
  item TEXT,
  quantity NUMERIC(14,2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS project_budget (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  unit TEXT,
  item TEXT,
  quantity NUMERIC(14,2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS project_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  staff_id TEXT NOT NULL REFERENCES accounts(staff_id),
  name TEXT NOT NULL,
  permission TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, staff_id)
);

CREATE TABLE IF NOT EXISTS meetings (
  meeting_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  meeting_time TIMESTAMPTZ,
  topic TEXT,
  agenda TEXT,
  decision TEXT,
  attendees TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT '預約中',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_keyword ON projects USING gin (
  to_tsvector('simple', coalesce(project_id, '') || ' ' || coalesce(project_name, '') || ' ' || coalesce(content, '') || ' ' || coalesce(login_user, ''))
);
CREATE INDEX IF NOT EXISTS idx_project_people_project_id ON project_people(project_id);
CREATE INDEX IF NOT EXISTS idx_project_income_project_id ON project_income(project_id);
CREATE INDEX IF NOT EXISTS idx_project_budget_project_id ON project_budget(project_id);
CREATE INDEX IF NOT EXISTS idx_project_permissions_project_id ON project_permissions(project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_project_id ON meetings(project_id);

CREATE TABLE IF NOT EXISTS purchases (
  purchase_id TEXT PRIMARY KEY,
  hall TEXT,
  department TEXT,
  purchase_type TEXT,
  project_id TEXT REFERENCES projects(project_id) ON DELETE SET NULL,
  applicant TEXT NOT NULL,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  summary TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT '申請中',
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id TEXT NOT NULL REFERENCES purchases(purchase_id) ON DELETE CASCADE,
  item TEXT,
  quantity NUMERIC(14,2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS purchase_advances (
  advance_id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(purchase_id) ON DELETE CASCADE,
  hall TEXT,
  borrower TEXT,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  expected_clear_date DATE,
  payment_method TEXT,
  bank TEXT,
  branch TEXT,
  account_name TEXT,
  account_no TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_advance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_id TEXT NOT NULL REFERENCES purchase_advances(advance_id) ON DELETE CASCADE,
  reason TEXT,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS purchase_expense_proofs (
  proof_id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(purchase_id) ON DELETE CASCADE,
  hall TEXT,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  no_receipt_reason TEXT,
  recipient_name TEXT,
  recipient_identity_no TEXT,
  recipient_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_expense_proof_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proof_id TEXT NOT NULL REFERENCES purchase_expense_proofs(proof_id) ON DELETE CASCADE,
  item TEXT,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS purchase_payment_requests (
  payment_id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(purchase_id) ON DELETE CASCADE,
  hall TEXT,
  claimant TEXT,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  has_advance BOOLEAN NOT NULL DEFAULT false,
  payment_method TEXT,
  advance_id TEXT REFERENCES purchase_advances(advance_id) ON DELETE SET NULL,
  advance_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  offset_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  behalf_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  return_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  bank TEXT,
  branch TEXT,
  account_name TEXT,
  account_no TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_payment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT NOT NULL REFERENCES purchase_payment_requests(payment_id) ON DELETE CASCADE,
  item TEXT,
  quantity NUMERIC(14,2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_purchases_keyword ON purchases USING gin (
  to_tsvector('simple', coalesce(purchase_id, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(applicant, '') || ' ' || coalesce(purchase_type, department, '') || ' ' || coalesce(project_id, ''))
);
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_type ON purchases(purchase_type);
CREATE INDEX IF NOT EXISTS idx_purchases_project_id ON purchases(project_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_advances_purchase_id ON purchase_advances(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_expense_proofs_purchase_id ON purchase_expense_proofs(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_payment_requests_purchase_id ON purchase_payment_requests(purchase_id);
CREATE INDEX IF NOT EXISTS idx_account_roles_staff_id ON account_roles(staff_id);
CREATE INDEX IF NOT EXISTS idx_role_feature_permissions_role ON role_feature_permissions(role);

INSERT INTO params (category, value, sort_order) VALUES
  ('chargeOptions', '是', 1),
  ('chargeOptions', '否', 2),
  ('purchaseStatus', '申請中', 1),
  ('purchaseStatus', '已結案', 2),
  ('purchaseTypes', '專案採購', 1),
  ('purchaseTypes', '一般採購', 2),
  ('purchaseTypes', '維修採購', 3),
  ('purchaseTypes', '其他採購', 4),
  ('paymentMethods', '已匯款交付借款人', 1),
  ('paymentMethods', '逕行匯款給廠商', 2),
  ('paymentMethods', '以現金交付借款人', 3),
  ('paymentMethods', '現金交付墊款人', 4),
  ('paymentMethods', '匯款交付墊款人', 5),
  ('departments', '秘書部', 1),
  ('departments', '牧養部', 2),
  ('departments', '教育部', 3),
  ('departments', '行政部', 4),
  ('departments', '財務部', 5),
  ('departments', '資訊部', 6),
  ('departments', '技術部', 7),
  ('departments', '媒體部', 8)
ON CONFLICT (category, value) DO NOTHING;

INSERT INTO account_roles (staff_id, role)
SELECT staff_id, role
FROM accounts
WHERE role IS NOT NULL AND trim(role) <> ''
ON CONFLICT (staff_id, role) DO NOTHING;
