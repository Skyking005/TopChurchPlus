BEGIN;

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS purchase_type TEXT;

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(project_id) ON DELETE SET NULL;

UPDATE purchases
SET purchase_type = COALESCE(NULLIF(purchase_type, ''), NULLIF(department, ''), U&'\4E00\822C\63A1\8CFC')
WHERE purchase_type IS NULL OR purchase_type = '';

UPDATE purchases
SET purchase_type = U&'\4E00\822C\63A1\8CFC'
WHERE purchase_type NOT IN (
  U&'\5C08\6848\63A1\8CFC',
  U&'\4E00\822C\63A1\8CFC',
  U&'\7DAD\4FEE\63A1\8CFC',
  U&'\5176\4ED6\63A1\8CFC'
);

DELETE FROM params
WHERE category = 'purchaseTypes'
  AND value NOT IN (
    U&'\5C08\6848\63A1\8CFC',
    U&'\4E00\822C\63A1\8CFC',
    U&'\7DAD\4FEE\63A1\8CFC',
    U&'\5176\4ED6\63A1\8CFC'
  );

DELETE FROM param_items
WHERE category_key = 'purchaseTypes'
  AND code NOT IN (
    U&'\5C08\6848\63A1\8CFC',
    U&'\4E00\822C\63A1\8CFC',
    U&'\7DAD\4FEE\63A1\8CFC',
    U&'\5176\4ED6\63A1\8CFC'
  );

CREATE INDEX IF NOT EXISTS idx_purchases_purchase_type ON purchases(purchase_type);
CREATE INDEX IF NOT EXISTS idx_purchases_project_id ON purchases(project_id);

DROP INDEX IF EXISTS idx_purchases_keyword;
CREATE INDEX idx_purchases_keyword ON purchases USING gin (
  to_tsvector('simple', coalesce(purchase_id, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(applicant, '') || ' ' || coalesce(purchase_type, department, '') || ' ' || coalesce(project_id, ''))
);

INSERT INTO params (category, value, sort_order)
VALUES ('purchaseTypes', U&'\5C08\6848\63A1\8CFC', 1)
ON CONFLICT (category, value) DO UPDATE SET sort_order = EXCLUDED.sort_order;

INSERT INTO params (category, value, sort_order)
VALUES ('purchaseTypes', U&'\4E00\822C\63A1\8CFC', 2)
ON CONFLICT (category, value) DO UPDATE SET sort_order = EXCLUDED.sort_order;

INSERT INTO params (category, value, sort_order)
VALUES ('purchaseTypes', U&'\7DAD\4FEE\63A1\8CFC', 3)
ON CONFLICT (category, value) DO UPDATE SET sort_order = EXCLUDED.sort_order;

INSERT INTO params (category, value, sort_order)
VALUES ('purchaseTypes', U&'\5176\4ED6\63A1\8CFC', 4)
ON CONFLICT (category, value) DO UPDATE SET sort_order = EXCLUDED.sort_order;

INSERT INTO param_categories (category_key, category_name, system_key, sort_order)
VALUES ('purchaseTypes', U&'\63A1\8CFC\985E\578B', 'finance', 105)
ON CONFLICT (category_key) DO UPDATE SET
  category_name = EXCLUDED.category_name,
  system_key = EXCLUDED.system_key,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO param_items (category_key, code, label, sort_order)
SELECT category, value, value, sort_order
FROM params
WHERE category = 'purchaseTypes'
ON CONFLICT (category_key, code) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

COMMIT;
