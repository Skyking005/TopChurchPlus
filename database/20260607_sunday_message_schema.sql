CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

CREATE TABLE IF NOT EXISTS sunday_messages (
  message_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  speaker_name text NOT NULL,
  message_title text NOT NULL,
  message_date date,
  scripture text,
  note text,
  status text NOT NULL DEFAULT 'active',
  created_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  updated_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sunday_message_shares (
  share_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES sunday_messages(message_id) ON DELETE CASCADE,
  share_type text NOT NULL DEFAULT 'church',
  church_id integer REFERENCES churches(id) ON DELETE SET NULL,
  external_place text,
  shared_date date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sunday_message_share_target CHECK (
    (share_type = 'church' AND church_id IS NOT NULL)
    OR (share_type = 'external' AND nullif(trim(coalesce(external_place, '')), '') IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_sunday_message_church_share
  ON sunday_message_shares(message_id, church_id)
  WHERE share_type = 'church' AND church_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sunday_messages_status_updated
  ON sunday_messages(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_sunday_messages_speaker
  ON sunday_messages(speaker_name);

CREATE INDEX IF NOT EXISTS idx_sunday_message_shares_message_id
  ON sunday_message_shares(message_id);

CREATE INDEX IF NOT EXISTS idx_sunday_message_shares_church_id
  ON sunday_message_shares(church_id);

CREATE INDEX IF NOT EXISTS idx_sunday_message_shares_shared_date
  ON sunday_message_shares(shared_date);

INSERT INTO params (category, value, sort_order) VALUES
  ('churchTypes', '本會', 1),
  ('churchTypes', '友會', 2),
  ('churchTypes', '機構', 3)
ON CONFLICT (category, value) DO NOTHING;

WITH next_country AS (
  SELECT coalesce(max(id), 0) AS base_id FROM countries
),
country_seed AS (
  SELECT 'HK'::text AS code, '香港'::text AS name, 1 AS sort_order
  UNION ALL
  SELECT 'CA', '加拿大', 2
),
country_rows AS (
  INSERT INTO countries (id, code, name)
  SELECT next_country.base_id + country_seed.sort_order, country_seed.code, country_seed.name
  FROM country_seed
  CROSS JOIN next_country
  WHERE NOT EXISTS (
    SELECT 1 FROM countries c WHERE c.code = country_seed.code
  )
  RETURNING id, code
)
SELECT 1;

WITH next_church AS (
  SELECT coalesce(max(id), 0) AS base_id FROM churches
),
church_seed AS (
  SELECT 'HK_YINGFUNG'::text AS code, '香港卓越盈峯行道會'::text AS name, 'HK'::text AS country_code, 1 AS sort_order
  UNION ALL
  SELECT 'VANCOUVER', '卓越溫哥華行道會', 'CA', 2
),
missing_churches AS (
  SELECT church_seed.*, row_number() OVER (ORDER BY church_seed.sort_order) AS row_no
  FROM church_seed
  WHERE NOT EXISTS (
    SELECT 1 FROM churches c
    WHERE c.code = church_seed.code OR c.name = church_seed.name
  )
)
INSERT INTO churches (id, code, name, church_type, country_id, is_active, sort_order)
SELECT
  next_church.base_id + missing_churches.row_no,
  missing_churches.code,
  missing_churches.name,
  '本會',
  countries.id,
  true,
  900 + missing_churches.sort_order
FROM missing_churches
CROSS JOIN next_church
LEFT JOIN countries ON countries.code = missing_churches.country_code;

COMMIT;
