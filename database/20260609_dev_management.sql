CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS development_issues (
  issue_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_no BIGSERIAL UNIQUE NOT NULL,
  issue_type TEXT NOT NULL CHECK (issue_type IN ('feature', 'issue', 'maintain')),
  status TEXT NOT NULL DEFAULT '提案' CHECK (status IN ('提案', '取消', '完成')),
  priority TEXT NOT NULL DEFAULT '中' CHECK (priority IN ('低', '中', '高')),
  description TEXT NOT NULL,
  created_by_staff_id TEXT REFERENCES accounts(staff_id) ON DELETE SET NULL,
  created_by_name TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_development_issues_status_priority
  ON development_issues(status, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_development_issues_type
  ON development_issues(issue_type);

CREATE INDEX IF NOT EXISTS idx_development_issues_created_by_staff
  ON development_issues(created_by_staff_id);

CREATE TABLE IF NOT EXISTS development_releases (
  release_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commit_hash TEXT,
  commit_message TEXT,
  apps_script_version TEXT,
  api_deployed BOOLEAN NOT NULL DEFAULT false,
  apps_script_deployed BOOLEAN NOT NULL DEFAULT false,
  summary TEXT NOT NULL DEFAULT '',
  verification_result TEXT NOT NULL DEFAULT '',
  created_by_staff_id TEXT REFERENCES accounts(staff_id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_development_releases_created_at
  ON development_releases(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_development_releases_created_by_staff
  ON development_releases(created_by_staff_id);

INSERT INTO role_feature_permissions (role, feature_key, access_level)
VALUES ('超級管理者', 'dev_management', 'edit')
ON CONFLICT (role, feature_key)
DO UPDATE SET access_level = EXCLUDED.access_level, updated_at = now();
