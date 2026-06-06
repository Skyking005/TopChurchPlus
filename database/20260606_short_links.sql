CREATE TABLE IF NOT EXISTS short_links (
  link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_code varchar(32) NOT NULL UNIQUE,
  target_url text NOT NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  source_system varchar(50) NOT NULL DEFAULT 'manual',
  source_type varchar(50) NOT NULL DEFAULT '',
  source_id text NOT NULL DEFAULT '',
  status varchar(20) NOT NULL DEFAULT 'active',
  click_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_by_staff_id text REFERENCES accounts(staff_id),
  updated_by_staff_id text REFERENCES accounts(staff_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT short_links_status_check CHECK (status IN ('active', 'disabled', 'expired')),
  CONSTRAINT short_links_code_format_check CHECK (short_code ~ '^[A-Za-z0-9_-]{3,32}$')
);

CREATE INDEX IF NOT EXISTS idx_short_links_source ON short_links(source_system, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_short_links_status ON short_links(status);
CREATE INDEX IF NOT EXISTS idx_short_links_created_at ON short_links(created_at DESC);

CREATE TABLE IF NOT EXISTS short_link_clicks (
  click_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES short_links(link_id) ON DELETE CASCADE,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text NOT NULL DEFAULT '',
  referer text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_short_link_clicks_link_id ON short_link_clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_short_link_clicks_clicked_at ON short_link_clicks(clicked_at DESC);
