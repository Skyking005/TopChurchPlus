CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS asset_locations (
  location_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hall TEXT NOT NULL,
  main_location TEXT NOT NULL,
  sub_location TEXT NOT NULL DEFAULT '',
  is_bookable BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hall, main_location, sub_location)
);

CREATE TABLE IF NOT EXISTS assets (
  asset_id TEXT PRIMARY KEY,
  asset_type TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  serial_no TEXT,
  purchase_price NUMERIC(14,2),
  purchase_date DATE,
  location_id UUID REFERENCES asset_locations(location_id) ON DELETE SET NULL,
  vendor TEXT,
  status TEXT NOT NULL DEFAULT '使用中',
  note TEXT,
  source_purchase_id TEXT REFERENCES purchases(purchase_id) ON DELETE SET NULL,
  source_payment_id TEXT REFERENCES purchase_payment_requests(payment_id) ON DELETE SET NULL,
  source_payment_item_id UUID REFERENCES purchase_payment_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asset_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
  from_location_id UUID REFERENCES asset_locations(location_id) ON DELETE SET NULL,
  to_location_id UUID REFERENCES asset_locations(location_id) ON DELETE SET NULL,
  moved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  moved_by TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS asset_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS asset_maintenance_records (
  maintenance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
  maintenance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor TEXT,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT '處理中',
  description TEXT,
  result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asset_acquisition_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
  purchase_id TEXT REFERENCES purchases(purchase_id) ON DELETE SET NULL,
  payment_id TEXT REFERENCES purchase_payment_requests(payment_id) ON DELETE SET NULL,
  payment_item_id UUID REFERENCES purchase_payment_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asset_id, payment_item_id)
);

CREATE INDEX IF NOT EXISTS idx_assets_location_id ON assets(location_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_source_purchase_id ON assets(source_purchase_id);
CREATE INDEX IF NOT EXISTS idx_asset_locations_hall ON asset_locations(hall);
CREATE INDEX IF NOT EXISTS idx_asset_location_history_asset_id ON asset_location_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_status_history_asset_id ON asset_status_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_maintenance_records_asset_id ON asset_maintenance_records(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_acquisition_links_purchase_id ON asset_acquisition_links(purchase_id);

CREATE INDEX IF NOT EXISTS idx_assets_keyword ON assets USING gin (
  to_tsvector(
    'simple',
    coalesce(asset_id, '') || ' ' ||
    coalesce(asset_type, '') || ' ' ||
    coalesce(asset_name, '') || ' ' ||
    coalesce(brand, '') || ' ' ||
    coalesce(model, '') || ' ' ||
    coalesce(serial_no, '') || ' ' ||
    coalesce(vendor, '') || ' ' ||
    coalesce(note, '')
  )
);

INSERT INTO params (category, value, sort_order) VALUES
  ('assetStatuses', '使用中', 1),
  ('assetStatuses', '維修中', 2),
  ('assetStatuses', '已報廢', 3),
  ('assetStatuses', '已請購', 4),
  ('assetStatuses', '已停用', 5)
ON CONFLICT (category, value) DO NOTHING;
