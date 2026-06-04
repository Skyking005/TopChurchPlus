\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE staging_asset_locations (
  hall TEXT,
  main_location TEXT,
  sub_location TEXT,
  sort_order INTEGER
);

CREATE TEMP TABLE staging_asset_params (
  category TEXT,
  value TEXT,
  sort_order INTEGER
);

CREATE TEMP TABLE staging_assets (
  asset_id TEXT,
  asset_type TEXT,
  asset_name TEXT,
  brand TEXT,
  model TEXT,
  serial_no TEXT,
  purchase_price NUMERIC(14,2),
  purchase_date DATE,
  hall TEXT,
  main_location TEXT,
  sub_location TEXT,
  vendor TEXT,
  status TEXT,
  note TEXT
);

\copy staging_asset_locations FROM '/tmp/asset_import/asset_locations.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy staging_asset_params FROM '/tmp/asset_import/asset_params.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy staging_assets FROM '/tmp/asset_import/assets.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

INSERT INTO params (category, value, sort_order)
SELECT category, value, min(sort_order)
FROM staging_asset_params
WHERE coalesce(trim(value), '') <> ''
GROUP BY category, value
ON CONFLICT (category, value) DO UPDATE
SET sort_order = LEAST(params.sort_order, EXCLUDED.sort_order),
    updated_at = now();

INSERT INTO asset_locations (hall, main_location, sub_location, sort_order)
SELECT hall, main_location, coalesce(sub_location, ''), min(sort_order)
FROM staging_asset_locations
WHERE coalesce(trim(hall), '') <> ''
  AND coalesce(trim(main_location), '') <> ''
GROUP BY hall, main_location, coalesce(sub_location, '')
ON CONFLICT (hall, main_location, sub_location) DO UPDATE
SET sort_order = EXCLUDED.sort_order,
    updated_at = now();

INSERT INTO assets (
  asset_id, asset_type, asset_name, brand, model, serial_no,
  purchase_price, purchase_date, location_id, vendor, status, note
)
SELECT
  s.asset_id,
  s.asset_type,
  s.asset_name,
  nullif(s.brand, ''),
  nullif(s.model, ''),
  nullif(s.serial_no, ''),
  s.purchase_price,
  s.purchase_date,
  l.location_id,
  nullif(s.vendor, ''),
  coalesce(nullif(s.status, ''), '使用中'),
  nullif(s.note, '')
FROM staging_assets s
LEFT JOIN asset_locations l
  ON l.hall = s.hall
 AND l.main_location = s.main_location
 AND l.sub_location = coalesce(s.sub_location, '')
WHERE coalesce(trim(s.asset_id), '') <> ''
ON CONFLICT (asset_id) DO UPDATE SET
  asset_type = EXCLUDED.asset_type,
  asset_name = EXCLUDED.asset_name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  serial_no = EXCLUDED.serial_no,
  purchase_price = EXCLUDED.purchase_price,
  purchase_date = EXCLUDED.purchase_date,
  location_id = EXCLUDED.location_id,
  vendor = EXCLUDED.vendor,
  status = EXCLUDED.status,
  note = EXCLUDED.note,
  updated_at = now();

COMMIT;
