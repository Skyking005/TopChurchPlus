BEGIN;

CREATE TABLE IF NOT EXISTS menu_items (
  menu_code text PRIMARY KEY,
  menu_name text NOT NULL,
  menu_type text NOT NULL,
  target_url text,
  required_role text,
  required_bind_status text NOT NULL DEFAULT 'BOUND',
  display_order integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  icon text,
  open_type text NOT NULL DEFAULT 'LIFF_ROUTE',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_menu_items_type
    CHECK (menu_type IN ('MEMBER', 'LEADER', 'EXTERNAL', 'ADMIN')),
  CONSTRAINT chk_menu_items_bind_status
    CHECK (required_bind_status IN ('ANY', 'BOUND', 'UNBOUND')),
  CONSTRAINT chk_menu_items_open_type
    CHECK (open_type IN ('LIFF_ROUTE', 'EXTERNAL_URL', 'INTERNAL_MODULE'))
);

CREATE INDEX IF NOT EXISTS idx_menu_items_enabled_order
  ON menu_items (enabled, menu_type, display_order);

CREATE TABLE IF NOT EXISTS line_leader_scope_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_name text NOT NULL,
  scope_type text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_line_leader_scope_type
    CHECK (scope_type IN ('SELF', 'CELL_GROUP', 'BIG_GROUP', 'ZONE', 'GLOBAL')),
  CONSTRAINT uq_line_leader_scope_title
    UNIQUE (title_name)
);

CREATE INDEX IF NOT EXISTS idx_line_leader_scope_enabled
  ON line_leader_scope_rules (enabled, display_order);

CREATE TABLE IF NOT EXISTS attendance_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pastoral_member_id integer NOT NULL REFERENCES pastoral_members(id) ON DELETE CASCADE,
  scope_type text NOT NULL,
  scope_id text NOT NULL,
  month date NOT NULL,
  total_meetings integer NOT NULL DEFAULT 0,
  attended_count integer NOT NULL DEFAULT 0,
  absent_count integer NOT NULL DEFAULT 0,
  attendance_rate numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pastoral_member_id, scope_type, scope_id, month)
);

CREATE INDEX IF NOT EXISTS idx_attendance_summary_scope
  ON attendance_summary (scope_type, scope_id, month);

CREATE TABLE IF NOT EXISTS course_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pastoral_member_id integer NOT NULL REFERENCES pastoral_members(id) ON DELETE CASCADE,
  scope_type text NOT NULL,
  scope_id text NOT NULL,
  course_stage text,
  completed_count integer NOT NULL DEFAULT 0,
  required_count integer NOT NULL DEFAULT 0,
  completion_rate numeric(5,2) NOT NULL DEFAULT 0,
  pending_list jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pastoral_member_id, scope_type, scope_id, course_stage)
);

CREATE INDEX IF NOT EXISTS idx_course_summary_scope
  ON course_summary (scope_type, scope_id, course_stage);

CREATE TABLE IF NOT EXISTS line_rich_menu_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id text NOT NULL REFERENCES line_users(line_user_id) ON DELETE CASCADE,
  target_segment text NOT NULL,
  line_rich_menu_id text,
  status text NOT NULL DEFAULT 'PENDING',
  error_message text,
  assigned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_line_rich_menu_segment
    CHECK (target_segment IN ('GUEST', 'MEMBER', 'LEADER')),
  CONSTRAINT chk_line_rich_menu_assignment_status
    CHECK (status IN ('PENDING', 'DRY_RUN', 'ASSIGNED', 'SKIPPED', 'FAILED')),
  CONSTRAINT uq_line_rich_menu_assignment_user
    UNIQUE (line_user_id)
);

CREATE INDEX IF NOT EXISTS idx_line_rich_menu_assignments_segment
  ON line_rich_menu_assignments (target_segment, status, updated_at DESC);

INSERT INTO menu_items (
  menu_code, menu_name, menu_type, target_url, required_bind_status,
  display_order, enabled, icon, open_type, metadata
)
VALUES
  ('QT', 'QT 訂購', 'MEMBER', '/liff/modules/qt', 'BOUND', 10, true, 'book-open', 'LIFF_ROUTE', '{"phase":"2"}'),
  ('COURSE', '個人課程查詢', 'MEMBER', '/liff/modules/courses', 'BOUND', 20, true, 'graduation-cap', 'LIFF_ROUTE', '{"phase":"2"}'),
  ('FORM', '表單中心', 'MEMBER', '/liff/modules/forms', 'BOUND', 30, true, 'clipboard-list', 'LIFF_ROUTE', '{"phase":"2"}'),
  ('EMD', 'EMD 查詢', 'MEMBER', '/liff/modules/emd', 'BOUND', 40, true, 'mail', 'LIFF_ROUTE', '{"phase":"2"}'),
  ('WEBSITE', '官方網站', 'EXTERNAL', '', 'ANY', 50, true, 'globe', 'EXTERNAL_URL', '{"configKey":"OFFICIAL_WEBSITE_URL","phase":"2"}'),
  ('LEADER_CENTER', '領袖中心', 'LEADER', '/liff/leader', 'BOUND', 60, true, 'users', 'LIFF_ROUTE', '{"phase":"3"}')
ON CONFLICT (menu_code) DO UPDATE SET
  menu_name = EXCLUDED.menu_name,
  menu_type = EXCLUDED.menu_type,
  target_url = EXCLUDED.target_url,
  required_bind_status = EXCLUDED.required_bind_status,
  display_order = EXCLUDED.display_order,
  enabled = EXCLUDED.enabled,
  icon = EXCLUDED.icon,
  open_type = EXCLUDED.open_type,
  metadata = menu_items.metadata || EXCLUDED.metadata,
  updated_at = now();

INSERT INTO line_leader_scope_rules (title_name, scope_type, display_order)
VALUES
  ('小家長', 'CELL_GROUP', 10),
  ('大家長', 'BIG_GROUP', 20),
  ('區牧', 'ZONE', 30),
  ('牧區長', 'ZONE', 40),
  ('行政同工', 'GLOBAL', 50),
  ('系統管理員', 'GLOBAL', 60)
ON CONFLICT (title_name) DO UPDATE SET
  scope_type = EXCLUDED.scope_type,
  display_order = EXCLUDED.display_order,
  enabled = true,
  updated_at = now();

INSERT INTO line_bot_rich_menus (menu_name, line_rich_menu_id, audience_rule, status, sort_order)
SELECT seed.menu_name, seed.line_rich_menu_id, seed.audience_rule::jsonb, seed.status, seed.sort_order
FROM (
  VALUES
    ('Guest Menu', '', '{"type":"unbound","segment":"GUEST","actionType":"open_liff","targetUrl":"/liff"}', 'draft', 10),
    ('Member Menu', '', '{"type":"bound","segment":"MEMBER","actionType":"open_liff","targetUrl":"/liff"}', 'draft', 20),
    ('Leader Menu', '', '{"type":"advanced","segment":"LEADER","actionType":"open_liff","targetUrl":"/liff"}', 'draft', 30)
) AS seed(menu_name, line_rich_menu_id, audience_rule, status, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM line_bot_rich_menus existing WHERE existing.menu_name = seed.menu_name
);

INSERT INTO system_config (config_key, config_value, description, is_secret)
VALUES
  ('LINE_RICH_MENU_GUEST_ID', '', 'Guest Rich Menu ID', false),
  ('LINE_RICH_MENU_MEMBER_ID', '', 'Member Rich Menu ID', false),
  ('LINE_RICH_MENU_LEADER_ID', '', 'Leader Rich Menu ID', false)
ON CONFLICT (config_key) DO NOTHING;

COMMIT;
