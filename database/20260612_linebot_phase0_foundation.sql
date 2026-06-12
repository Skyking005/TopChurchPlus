BEGIN;

CREATE TABLE IF NOT EXISTS system_config (
  config_key text PRIMARY KEY,
  config_value text NOT NULL,
  description text,
  is_secret boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  updated_by text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_config_enabled
  ON system_config (enabled, config_key);

CREATE TABLE IF NOT EXISTS identity_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pastoral_member_id integer NOT NULL REFERENCES pastoral_members(id) ON DELETE CASCADE,
  provider_type text NOT NULL,
  provider_user_id text NOT NULL,
  display_name text,
  picture_url text,
  email text,
  status text NOT NULL DEFAULT 'ACTIVE',
  linked_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_identity_provider_status
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'REVOKED')),
  CONSTRAINT uq_identity_provider_user
    UNIQUE (provider_type, provider_user_id),
  CONSTRAINT uq_identity_member_provider
    UNIQUE (pastoral_member_id, provider_type)
);

CREATE INDEX IF NOT EXISTS idx_identity_provider_lookup
  ON identity_providers (provider_type, provider_user_id);

CREATE INDEX IF NOT EXISTS idx_identity_provider_member
  ON identity_providers (pastoral_member_id);

CREATE TABLE IF NOT EXISTS notification_templates (
  template_code text NOT NULL,
  channel text NOT NULL,
  subject text,
  content text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_by text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template_code, channel),
  CONSTRAINT chk_notification_templates_channel
    CHECK (channel IN ('EMAIL', 'LINE_PUSH', 'LIFF_NOTICE'))
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_enabled
  ON notification_templates (enabled, template_code, channel);

CREATE TABLE IF NOT EXISTS notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_code text NOT NULL,
  channel text NOT NULL,
  recipient text NOT NULL,
  subject text,
  content_snapshot text,
  status text NOT NULL,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT chk_notification_logs_status
    CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED'))
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_template_channel
  ON notification_logs (template_code, channel, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_logs_recipient_time
  ON notification_logs (recipient, created_at DESC);

CREATE TABLE IF NOT EXISTS line_binding_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id text NOT NULL,
  display_name text,
  name text NOT NULL,
  zone text,
  mobile text NOT NULL,
  email text,
  status text NOT NULL DEFAULT 'PENDING',
  admin_note text,
  processed_at timestamptz,
  processed_by text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_line_binding_requests_status
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_line_binding_requests_status
  ON line_binding_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_line_binding_requests_line_user
  ON line_binding_requests (line_user_id, created_at DESC);

INSERT INTO system_config (config_key, config_value, description, is_secret)
VALUES
  ('LINE_CHANNEL_SECRET', '', 'LINE Messaging API Channel Secret', true),
  ('LINE_CHANNEL_ACCESS_TOKEN', '', 'LINE Messaging API long-lived channel access token', true),
  ('LINE_LIFF_ID', '', 'Default LIFF portal ID', true),
  ('LINE_RICH_MENU_GUEST_ID', '', 'Guest Rich Menu ID', false),
  ('LINE_RICH_MENU_MEMBER_ID', '', 'Member Rich Menu ID', false),
  ('LINE_RICH_MENU_LEADER_ID', '', 'Leader Rich Menu ID', false),
  ('LINE_LOGIN_URL', '', 'LINE Login or LIFF entry URL', false),
  ('NOTIFY_EMAIL_SENDER', '', 'Default notification sender email', false),
  ('SYSTEM_ENABLED', 'true', 'Global system enabled flag', false),
  ('OFFICIAL_WEBSITE_URL', '', 'Official church website URL', false)
ON CONFLICT (config_key) DO NOTHING;

INSERT INTO notification_templates (template_code, channel, subject, content)
VALUES
  ('LINE_BIND_SUCCESS', 'EMAIL', 'TopChurchPlus LINE 綁定完成', '{{Name}} 您好，您的 LINE 已於 {{BindDatetime}} 完成綁定。'),
  ('LINE_BIND_REQUEST_RECEIVED', 'EMAIL', 'TopChurchPlus LINE 綁定申請已收到', '{{Name}} 您好，我們已收到您的 LINE 綁定申請。'),
  ('LINE_BIND_REQUEST_APPROVED', 'EMAIL', 'TopChurchPlus LINE 綁定申請已通過', '{{Name}} 您好，您的 LINE 綁定申請已通過。'),
  ('LINE_BIND_REQUEST_REJECTED', 'EMAIL', 'TopChurchPlus LINE 綁定申請未通過', '{{Name}} 您好，您的 LINE 綁定申請目前未通過，請洽同工協助。')
ON CONFLICT (template_code, channel) DO NOTHING;

COMMIT;
