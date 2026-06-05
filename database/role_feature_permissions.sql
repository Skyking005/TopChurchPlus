CREATE TABLE IF NOT EXISTS role_feature_permissions (
  role TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'none' CHECK (access_level IN ('none', 'read', 'edit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_role_feature_permissions_role ON role_feature_permissions(role);

WITH defaults(role, feature_key, access_level) AS (
  VALUES
    ('超級管理者', 'project', 'edit'),
    ('超級管理者', 'finance', 'edit'),
    ('超級管理者', 'asset', 'edit'),
    ('超級管理者', 'venue', 'edit'),
    ('超級管理者', 'forms', 'edit'),
    ('超級管理者', 'counter', 'edit'),
    ('超級管理者', 'qt', 'edit'),
    ('超級管理者', 'linebot', 'edit'),
    ('超級管理者', 'pastoral', 'edit'),
    ('超級管理者', 'education', 'edit'),
    ('超級管理者', 'media', 'edit'),
    ('超級管理者', 'worship', 'edit'),
    ('超級管理者', 'attendance', 'edit'),
    ('超級管理者', 'serving', 'edit'),
    ('超級管理者', 'system', 'edit'),
    ('管理員', 'project', 'edit'),
    ('管理員', 'finance', 'edit'),
    ('管理員', 'asset', 'edit'),
    ('管理員', 'venue', 'edit'),
    ('管理員', 'forms', 'edit'),
    ('管理員', 'counter', 'edit'),
    ('管理員', 'qt', 'edit'),
    ('管理員', 'linebot', 'edit'),
    ('管理員', 'pastoral', 'edit'),
    ('管理員', 'education', 'edit'),
    ('管理員', 'media', 'edit'),
    ('管理員', 'worship', 'edit'),
    ('管理員', 'attendance', 'edit'),
    ('管理員', 'serving', 'edit'),
    ('全職同工', 'project', 'edit'),
    ('全職同工', 'finance', 'edit'),
    ('全職同工', 'venue', 'edit'),
    ('全職同工', 'forms', 'edit'),
    ('全職同工', 'counter', 'edit'),
    ('全職同工', 'qt', 'edit'),
    ('全職同工', 'linebot', 'read'),
    ('全職同工', 'worship', 'edit'),
    ('全職同工', 'attendance', 'edit'),
    ('全職同工', 'serving', 'edit'),
    ('技術同工', 'asset', 'edit'),
    ('牧養同工', 'pastoral', 'edit'),
    ('教育同工', 'education', 'edit'),
    ('媒體同工', 'media', 'edit'),
    ('媒體同工', 'worship', 'edit'),
    ('義工', 'counter', 'edit'),
    ('義工', 'qt', 'edit'),
    ('義工', 'serving', 'edit')
)
INSERT INTO role_feature_permissions (role, feature_key, access_level)
SELECT role, feature_key, access_level
FROM defaults
ON CONFLICT (role, feature_key) DO NOTHING;
