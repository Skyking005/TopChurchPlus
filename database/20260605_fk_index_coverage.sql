-- Add indexes for frequently joined foreign key columns.
-- This migration does not change table columns or data semantics.

CREATE INDEX IF NOT EXISTS idx_qt_order_items_order_id
  ON qt_order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_qt_order_items_receiver_member_id
  ON qt_order_items(receiver_member_id);

CREATE INDEX IF NOT EXISTS idx_qt_orders_payer_member_id
  ON qt_orders(payer_member_id);

CREATE INDEX IF NOT EXISTS idx_qt_orders_plan_id
  ON qt_orders(plan_id);

CREATE INDEX IF NOT EXISTS idx_qt_orders_product_type
  ON qt_orders(product_type);

CREATE INDEX IF NOT EXISTS idx_pastoral_member_addresses_member_id
  ON pastoral_member_addresses(member_id);

CREATE INDEX IF NOT EXISTS idx_pastoral_member_addresses_region_id
  ON pastoral_member_addresses(region_id);

CREATE INDEX IF NOT EXISTS idx_pastoral_member_faith_previous_church_id
  ON pastoral_member_faith(previous_church_id);

CREATE INDEX IF NOT EXISTS idx_purchase_advance_items_advance_id
  ON purchase_advance_items(advance_id);

CREATE INDEX IF NOT EXISTS idx_purchase_expense_proof_items_proof_id
  ON purchase_expense_proof_items(proof_id);

CREATE INDEX IF NOT EXISTS idx_purchase_payment_items_payment_id
  ON purchase_payment_items(payment_id);

CREATE INDEX IF NOT EXISTS idx_form_response_answers_question_id
  ON form_response_answers(question_id);

CREATE INDEX IF NOT EXISTS idx_form_responses_respondent_staff_id
  ON form_responses(respondent_staff_id);

CREATE INDEX IF NOT EXISTS idx_form_responses_respondent_member_id
  ON form_responses(respondent_member_id);
