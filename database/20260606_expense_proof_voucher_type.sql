ALTER TABLE purchase_expense_proofs
  ADD COLUMN IF NOT EXISTS voucher_type TEXT NOT NULL DEFAULT '一般支出憑證';

UPDATE purchase_expense_proofs
SET voucher_type = '一般支出憑證'
WHERE voucher_type IS NULL OR trim(voucher_type) = '';

ALTER TABLE purchase_expense_proofs
  DROP CONSTRAINT IF EXISTS purchase_expense_proofs_voucher_type_check;

ALTER TABLE purchase_expense_proofs
  ADD CONSTRAINT purchase_expense_proofs_voucher_type_check
  CHECK (voucher_type IN ('一般支出憑證', '鐘點費支出憑證'));
