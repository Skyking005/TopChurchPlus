BEGIN;

ALTER TABLE admin_supply_movements
  ADD COLUMN IF NOT EXISTS handover_to_name text NOT NULL DEFAULT '';

WITH next_church AS (
  SELECT coalesce(max(id), 0) + 1 AS id
  FROM churches
),
warehouse_seed AS (
  SELECT
    'GIANT_WAREHOUSE'::text AS code,
    '巨人倉庫'::text AS name,
    '倉庫'::text AS church_type,
    950::integer AS sort_order
)
INSERT INTO churches (id, code, name, church_type, is_active, sort_order)
SELECT
  next_church.id,
  warehouse_seed.code,
  warehouse_seed.name,
  warehouse_seed.church_type,
  true,
  warehouse_seed.sort_order
FROM warehouse_seed
CROSS JOIN next_church
WHERE NOT EXISTS (
  SELECT 1
  FROM churches
  WHERE code = warehouse_seed.code OR name = warehouse_seed.name
);

GRANT SELECT, INSERT, UPDATE, DELETE ON admin_supply_movements TO "Codex";
GRANT SELECT ON churches TO "Codex";

COMMIT;
