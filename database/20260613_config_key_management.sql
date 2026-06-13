CREATE TABLE IF NOT EXISTS system_config_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace text NOT NULL,
  config_key text NOT NULL,
  config_value text NOT NULL DEFAULT '',
  value_type text NOT NULL DEFAULT 'string',
  is_secret boolean NOT NULL DEFAULT false,
  is_enabled boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  CONSTRAINT chk_system_config_keys_namespace CHECK (namespace ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT chk_system_config_keys_config_key CHECK (config_key ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT chk_system_config_keys_value_type CHECK (value_type IN ('string', 'number', 'boolean', 'json')),
  CONSTRAINT uq_system_config_keys_namespace_key UNIQUE (namespace, config_key)
);

CREATE INDEX IF NOT EXISTS idx_system_config_keys_namespace
  ON system_config_keys (namespace, is_enabled, config_key);

CREATE INDEX IF NOT EXISTS idx_system_config_keys_search
  ON system_config_keys (namespace, config_key);

DO $$
BEGIN
  IF to_regclass('public.system_config') IS NOT NULL THEN
    INSERT INTO system_config_keys (
      namespace, config_key, config_value, value_type, is_secret, is_enabled, description, updated_by, updated_at
    )
    SELECT
      'line',
      lower(regexp_replace(config_key, '^LINE_', '')),
      config_value,
      'string',
      is_secret,
      enabled,
      description,
      updated_by,
      updated_at
    FROM system_config
    WHERE config_key LIKE 'LINE_%'
    ON CONFLICT (namespace, config_key) DO NOTHING;

    INSERT INTO system_config_keys (
      namespace, config_key, config_value, value_type, is_secret, is_enabled, description, updated_by, updated_at
    )
    SELECT
      'qt',
      'open_pickup_month',
      config_value,
      'string',
      is_secret,
      enabled,
      description,
      updated_by,
      updated_at
    FROM system_config
    WHERE config_key = 'QT_OPEN_PICKUP_MONTH'
    ON CONFLICT (namespace, config_key) DO NOTHING;
  END IF;
END $$;

INSERT INTO system_config_keys (
  namespace, config_key, config_value, value_type, is_secret, is_enabled, description
) VALUES
  ('mail', 'daily_recipient_limit', '1500', 'number', false, true, 'Workspace MailApp recipient quota. Adjust per account type.'),
  ('mail', 'low_quota_threshold', '20', 'number', false, true, 'Only high priority mail should send below this remaining quota.'),
  ('mail', 'process_batch_size', '30', 'number', false, true, 'Default pending mail batch size for scheduled processing.'),
  ('notification', 'sender_email', '', 'string', false, true, 'Default notification sender email.'),
  ('apps_script', 'api_base_url', '', 'string', false, true, 'Apps Script bridge API base URL. Runtime value may still live in Script Properties.'),
  ('apps_script', 'api_key', '', 'string', true, true, 'Apps Script bridge API key. Do not expose to frontend.'),
  ('calendar', 'default_calendar_id', '', 'string', false, true, 'Default Google Calendar ID used by calendar integrations.'),
  ('qt', 'open_pickup_month', '', 'string', false, true, 'QT open pickup month. Legacy flat key: QT_OPEN_PICKUP_MONTH.'),
  ('system', 'feature_flags', '{}', 'json', false, true, 'Global module feature flags and parameters.')
ON CONFLICT (namespace, config_key) DO NOTHING;
