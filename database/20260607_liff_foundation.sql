CREATE TABLE IF NOT EXISTS line_liff_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token_hash text NOT NULL UNIQUE,
  line_user_id text NOT NULL REFERENCES line_users(line_user_id) ON DELETE CASCADE,
  channel_key text NOT NULL DEFAULT 'main',
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_line_liff_sessions_user_time
  ON line_liff_sessions (line_user_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_line_liff_sessions_active_expiry
  ON line_liff_sessions (is_active, expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON line_liff_sessions TO "Codex";

UPDATE line_bot_channels
SET metadata = coalesce(metadata, '{}'::jsonb)
  || jsonb_build_object(
    'liffIds',
    coalesce(metadata->'liffIds', '{}'::jsonb)
      || jsonb_build_object('portal', coalesce(metadata #>> '{liffIds,portal}', ''))
  )
WHERE NOT (coalesce(metadata, '{}'::jsonb) ? 'liffIds')
   OR metadata #>> '{liffIds,portal}' IS NULL;
