BEGIN;

ALTER TABLE purchase_payment_requests
  ALTER COLUMN purchase_id DROP NOT NULL;

ALTER TABLE purchase_expense_proofs
  ALTER COLUMN purchase_id DROP NOT NULL;

ALTER TABLE purchase_expense_proofs
  ADD COLUMN IF NOT EXISTS payment_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'purchase_expense_proofs_payment_id_fkey'
  ) THEN
    ALTER TABLE purchase_expense_proofs
      ADD CONSTRAINT purchase_expense_proofs_payment_id_fkey
      FOREIGN KEY (payment_id) REFERENCES purchase_payment_requests(payment_id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_purchase_payment_requests_purchase_id
  ON purchase_payment_requests (purchase_id);

CREATE INDEX IF NOT EXISTS idx_purchase_expense_proofs_payment_id
  ON purchase_expense_proofs (payment_id);

CREATE INDEX IF NOT EXISTS idx_purchase_expense_proofs_purchase_id
  ON purchase_expense_proofs (purchase_id);

COMMIT;
