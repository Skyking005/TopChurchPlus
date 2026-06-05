ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS department text;

CREATE INDEX IF NOT EXISTS idx_accounts_department
  ON accounts (department);
