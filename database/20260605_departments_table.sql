ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS department text;

CREATE TABLE IF NOT EXISTS departments (
  department_id bigserial PRIMARY KEY,
  department_name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO departments (department_name, sort_order, is_active) VALUES
  ('牧養部', 1, true),
  ('教育部', 2, true),
  ('媒體部', 3, true),
  ('敬拜部', 4, true),
  ('技術部', 5, true),
  ('資訊部', 6, true),
  ('行政部', 7, true),
  ('財務部', 8, true),
  ('總務部', 9, true)
ON CONFLICT (department_name) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO params (category, value, sort_order) VALUES
  ('departments', '牧養部', 1),
  ('departments', '教育部', 2),
  ('departments', '媒體部', 3),
  ('departments', '敬拜部', 4),
  ('departments', '技術部', 5),
  ('departments', '資訊部', 6),
  ('departments', '行政部', 7),
  ('departments', '財務部', 8),
  ('departments', '總務部', 9)
ON CONFLICT (category, value) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

CREATE INDEX IF NOT EXISTS idx_accounts_department
  ON accounts (department);

CREATE INDEX IF NOT EXISTS idx_departments_active_sort
  ON departments (is_active, sort_order, department_name);
