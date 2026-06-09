CREATE TABLE IF NOT EXISTS line_bot_channels (
  channel_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_key text NOT NULL UNIQUE,
  channel_name text NOT NULL,
  channel_type text NOT NULL DEFAULT 'official',
  webhook_url text,
  liff_base_url text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS line_bot_module_settings (
  module_key text PRIMARY KEY,
  module_name text NOT NULL,
  description text,
  is_enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS line_bot_links (
  link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  url text NOT NULL,
  link_type text NOT NULL DEFAULT 'form',
  visibility text NOT NULL DEFAULT 'public',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  note text,
  created_by_staff_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS line_bot_edm_campaigns (
  campaign_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  campaign_type text NOT NULL DEFAULT 'announcement',
  status text NOT NULL DEFAULT 'draft',
  target_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  message_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by_staff_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS line_bot_rich_menus (
  rich_menu_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_name text NOT NULL,
  line_rich_menu_id text,
  audience_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS line_bot_webhook_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_event_id text UNIQUE,
  line_user_id text,
  event_type text NOT NULL,
  message_type text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  handled_status text NOT NULL DEFAULT 'received',
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  handled_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_line_bot_links_active_sort
  ON line_bot_links (is_active, sort_order, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_line_bot_edm_campaigns_status
  ON line_bot_edm_campaigns (status, scheduled_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_line_bot_rich_menus_status
  ON line_bot_rich_menus (status, sort_order);

CREATE INDEX IF NOT EXISTS idx_line_bot_webhook_events_user_time
  ON line_bot_webhook_events (line_user_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_line_bot_webhook_events_type_time
  ON line_bot_webhook_events (event_type, received_at DESC);

INSERT INTO line_users (line_user_id, member_id, bound_at, last_interaction_at, metadata)
SELECT DISTINCT pm.line_user_id, pm.id, now(), now(), jsonb_build_object('source', 'pastoral_members.line_user_id')
FROM pastoral_members pm
WHERE coalesce(pm.line_user_id, '') <> ''
ON CONFLICT (line_user_id) DO UPDATE SET
  member_id = COALESCE(line_users.member_id, EXCLUDED.member_id),
  bound_at = COALESCE(line_users.bound_at, EXCLUDED.bound_at),
  updated_at = now();

INSERT INTO line_bot_module_settings (module_key, module_name, description, is_enabled, sort_order)
VALUES
  ('line_edm', 'LINE EDM', '分眾訊息、圖文素材、回應內容與發送紀錄', true, 10),
  ('member_binding', 'LINE 會友綁定', '綁定狀態、重複綁定與未綁定名單管理', true, 20),
  ('qt_order', 'QT 下單與庫存檢查', '會友端 QT 訂購前檢查會堂月庫存', true, 30),
  ('forms', '表單入口', '活動報名、問卷填寫與付款流程連結', true, 40),
  ('qrcode', 'QR Code 報到', '會友端 QR Code 與活動報到流程', true, 50),
  ('venue', '場地借用入口', '會友端場地申請與狀態通知', false, 60),
  ('education', '教育課程查詢', '個人課程狀態與可報名課程查詢', false, 70)
ON CONFLICT (module_key) DO UPDATE SET
  module_name = EXCLUDED.module_name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
