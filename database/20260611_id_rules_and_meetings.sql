BEGIN;

CREATE TABLE IF NOT EXISTS id_rules (
  entity_key text PRIMARY KEY,
  entity_label text NOT NULL,
  prefix text NOT NULL DEFAULT '',
  include_year_month boolean NOT NULL DEFAULT true,
  sequence_digits integer NOT NULL DEFAULT 4,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT id_rules_entity_key_format CHECK (entity_key ~ '^[a-z][a-z0-9_]{1,40}$'),
  CONSTRAINT id_rules_prefix_format CHECK (prefix ~ '^[A-Z0-9]{0,12}$'),
  CONSTRAINT id_rules_sequence_digits_range CHECK (sequence_digits BETWEEN 1 AND 12)
);

INSERT INTO id_rules (entity_key, entity_label, prefix, include_year_month, sequence_digits, sort_order)
VALUES
  ('project', '專案', 'PJ', true, 2, 10),
  ('course', '課程', 'CL', true, 4, 20),
  ('member', '會友', 'TOP', true, 5, 30),
  ('meeting', '會議', 'M', true, 4, 40)
ON CONFLICT (entity_key) DO UPDATE SET
  entity_label = EXCLUDED.entity_label,
  prefix = EXCLUDED.prefix,
  include_year_month = EXCLUDED.include_year_month,
  sequence_digits = EXCLUDED.sequence_digits,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO role_feature_permissions (role, feature_key, access_level)
SELECT role, 'meeting', access_level
FROM role_feature_permissions
WHERE feature_key = 'project'
  AND access_level = 'edit'
ON CONFLICT (role, feature_key) DO UPDATE SET
  access_level = EXCLUDED.access_level,
  updated_at = now();

ALTER TABLE education_courses
  ADD COLUMN IF NOT EXISTS course_code text;

ALTER TABLE pastoral_members
  ADD COLUMN IF NOT EXISTS member_code text;

UPDATE education_courses
SET course_code = 'CL' || lpad(course_id::text, 5, '0')
WHERE course_code IS NULL OR btrim(course_code) = '';

UPDATE pastoral_members
SET member_code = 'TOP' || lpad(id::text, 5, '0')
WHERE member_code IS NULL OR btrim(member_code) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_education_courses_course_code
  ON education_courses (course_code)
  WHERE course_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pastoral_members_member_code
  ON pastoral_members (member_code)
  WHERE member_code IS NOT NULL;

ALTER TABLE project_people DROP CONSTRAINT IF EXISTS project_people_project_id_fkey;
ALTER TABLE project_people
  ADD CONSTRAINT project_people_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE project_income DROP CONSTRAINT IF EXISTS project_income_project_id_fkey;
ALTER TABLE project_income
  ADD CONSTRAINT project_income_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE project_budget DROP CONSTRAINT IF EXISTS project_budget_project_id_fkey;
ALTER TABLE project_budget
  ADD CONSTRAINT project_budget_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE project_permissions DROP CONSTRAINT IF EXISTS project_permissions_project_id_fkey;
ALTER TABLE project_permissions
  ADD CONSTRAINT project_permissions_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_project_id_fkey;
ALTER TABLE purchases
  ADD CONSTRAINT purchases_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE meetings ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_project_id_fkey;
ALTER TABLE meetings
  ADD CONSTRAINT meetings_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON UPDATE CASCADE ON DELETE SET NULL;

UPDATE projects
SET project_id = 'PJ' || project_id
WHERE project_id !~ '^PJ';

COMMIT;
