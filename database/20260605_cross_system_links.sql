BEGIN;

CREATE TABLE IF NOT EXISTS entity_links (
  entity_link_id bigserial PRIMARY KEY,
  source_system text NOT NULL,
  source_type text NOT NULL,
  source_id text NOT NULL,
  target_system text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  link_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_system, source_type, source_id, target_system, target_type, target_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_entity_links_source
  ON entity_links (source_system, source_type, source_id, link_type);

CREATE INDEX IF NOT EXISTS idx_entity_links_target
  ON entity_links (target_system, target_type, target_id, link_type);

CREATE INDEX IF NOT EXISTS idx_entity_links_created_at
  ON entity_links (created_at DESC);

CREATE TABLE IF NOT EXISTS domain_events (
  domain_event_id bigserial PRIMARY KEY,
  event_type text NOT NULL,
  system_key text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_domain_events_entity
  ON domain_events (system_key, entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_domain_events_type_time
  ON domain_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_domain_events_unprocessed
  ON domain_events (processed_at, created_at)
  WHERE processed_at IS NULL;

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS source_purchase_id text REFERENCES purchases(purchase_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_payment_id text REFERENCES purchase_payment_requests(payment_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_payment_item_id uuid REFERENCES purchase_payment_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assets_source_purchase_id
  ON assets (source_purchase_id);

CREATE INDEX IF NOT EXISTS idx_assets_source_payment_id
  ON assets (source_payment_id);

CREATE TABLE IF NOT EXISTS asset_acquisition_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id text NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
  purchase_id text REFERENCES purchases(purchase_id) ON DELETE SET NULL,
  payment_id text REFERENCES purchase_payment_requests(payment_id) ON DELETE SET NULL,
  payment_item_id uuid REFERENCES purchase_payment_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, payment_item_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_acquisition_links_purchase_id
  ON asset_acquisition_links (purchase_id);

CREATE INDEX IF NOT EXISTS idx_asset_acquisition_links_payment_id
  ON asset_acquisition_links (payment_id);

COMMIT;
