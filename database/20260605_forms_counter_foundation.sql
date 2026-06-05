BEGIN;

ALTER TABLE forms
  ADD COLUMN IF NOT EXISTS form_type text NOT NULL DEFAULT 'survey';

ALTER TABLE forms
  ADD COLUMN IF NOT EXISTS has_fee boolean NOT NULL DEFAULT false;

ALTER TABLE forms
  ADD COLUMN IF NOT EXISTS fee_title text;

ALTER TABLE forms
  ADD COLUMN IF NOT EXISTS fee_amount numeric(14,2) NOT NULL DEFAULT 0;

ALTER TABLE forms
  ADD COLUMN IF NOT EXISTS payment_description text;

ALTER TABLE forms
  ADD COLUMN IF NOT EXISTS counter_service_type text NOT NULL DEFAULT 'payment';

CREATE INDEX IF NOT EXISTS idx_forms_type_status_updated
  ON forms (form_type, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS counter_transactions (
  transaction_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_code text UNIQUE,
  business_type text NOT NULL DEFAULT 'payment',
  source_system text,
  source_type text,
  source_id text,
  payer_name text,
  payer_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  payer_member_id integer,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  payment_method text,
  received_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  received_at timestamptz,
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_counter_transactions_source
  ON counter_transactions (source_system, source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_counter_transactions_status_time
  ON counter_transactions (status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON counter_transactions TO "Codex";

ALTER TABLE form_responses
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'none';

ALTER TABLE form_responses
  ADD COLUMN IF NOT EXISTS payment_amount numeric(14,2) NOT NULL DEFAULT 0;

ALTER TABLE form_responses
  ADD COLUMN IF NOT EXISTS counter_transaction_id uuid REFERENCES counter_transactions(transaction_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_form_responses_payment_status
  ON form_responses (form_id, payment_status, submitted_at DESC);

INSERT INTO role_feature_permissions (role, feature_key, access_level)
VALUES
  (U&'\8D85\7D1A\7BA1\7406\8005', 'qt', 'edit'),
  (U&'\7BA1\7406\54E1', 'qt', 'edit'),
  (U&'\5168\8077\540C\5DE5', 'qt', 'edit'),
  (U&'\7FA9\5DE5', 'qt', 'edit')
ON CONFLICT (role, feature_key) DO NOTHING;

COMMIT;
