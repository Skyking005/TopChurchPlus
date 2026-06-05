const fs = require('fs');
const path = require('path');
const { pool, tx } = require('../db');

const inputPath = process.argv[2] || '/app/legacy-qt-export.json';

function readInput() {
  const raw = fs.readFileSync(path.resolve(inputPath), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function asDate(value) {
  if (!value) return null;
  const text = String(value);
  const source = /(?:Z|[+-]\d{2}:\d{2})$/.test(text) ? text : `${text}+08:00`;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function asMonth(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function mapOrderStatus(value) {
  if (Number(value) === -1) return 'cancelled';
  if (Number(value) === 0) return 'expired';
  if (Number(value) === 2) return 'active';
  return 'pending';
}

function mapFinanceStatus(value) {
  if (Number(value) === 2) return 'posted';
  if (Number(value) === 1) return 'received';
  return 'unpaid';
}

function productTypeFromPlan(planId) {
  return [7, 8, 9].includes(Number(planId)) ? 'eaglet' : 'adult_student';
}

async function main() {
  const data = readInput();
  const paymentTypes = data.paymentTypes || [];
  const orders = data.orders || [];
  const items = data.items || [];

  await tx(async client => {
    await client.query('TRUNCATE qt_order_items, qt_orders, qt_payment_types');

    for (const row of paymentTypes) {
      await client.query(
        `INSERT INTO qt_payment_types (payment_type_id, payment_type_name)
         VALUES ($1, $2)
         ON CONFLICT (payment_type_id) DO UPDATE SET
           payment_type_name = EXCLUDED.payment_type_name,
           updated_at = now()`,
        [Number(row.QuietTimeOrderPaymentType001), row.QuietTimeOrderPaymentType002 || '未設定']
      );
    }

    for (const row of orders) {
      const orderId = Number(row.QuietTimeOrder001);
      const memberId = Number(row.QuietTimeOrder002 || 0) || null;
      const payerMemberId = Number(row.QuietTimeOrder014 || 0) || null;
      const churchId = Number(row.QuietTimeOrder017 || 0);
      const planId = Number(row.QuietTimeOrder009 || 0) || null;
      await client.query(
        `INSERT INTO qt_orders (
          order_id, member_id, payer_member_id, church_id, plan_id, product_type,
          start_month, end_month, quantity, amount, order_status, finance_status,
          cashier_staff_id, payment_type_id, paper_receipt_no, payment_sequence_no,
          ordered_at, paid_at, cancelled_at, legacy_product_group
        ) VALUES (
          $1,
          CASE WHEN EXISTS (SELECT 1 FROM pastoral_members WHERE id = $2) THEN $2 ELSE NULL END,
          CASE WHEN EXISTS (SELECT 1 FROM pastoral_members WHERE id = $3) THEN $3 ELSE NULL END,
          CASE WHEN EXISTS (SELECT 1 FROM churches WHERE id = $4) THEN $4 ELSE NULL END,
          CASE WHEN EXISTS (SELECT 1 FROM qt_price_plans WHERE plan_id = $5) THEN $5 ELSE NULL END,
          $6,$7,$8,$9,$10,$11,$12,$13,
          CASE WHEN EXISTS (SELECT 1 FROM qt_payment_types WHERE payment_type_id = $14) THEN $14 ELSE NULL END,
          $15,$16,$17,$18,$19,$20
        )
        ON CONFLICT (order_id) DO UPDATE SET
          member_id = EXCLUDED.member_id,
          payer_member_id = EXCLUDED.payer_member_id,
          church_id = EXCLUDED.church_id,
          plan_id = EXCLUDED.plan_id,
          product_type = EXCLUDED.product_type,
          start_month = EXCLUDED.start_month,
          end_month = EXCLUDED.end_month,
          quantity = EXCLUDED.quantity,
          amount = EXCLUDED.amount,
          order_status = EXCLUDED.order_status,
          finance_status = EXCLUDED.finance_status,
          cashier_staff_id = EXCLUDED.cashier_staff_id,
          payment_type_id = EXCLUDED.payment_type_id,
          paper_receipt_no = EXCLUDED.paper_receipt_no,
          payment_sequence_no = EXCLUDED.payment_sequence_no,
          ordered_at = EXCLUDED.ordered_at,
          paid_at = EXCLUDED.paid_at,
          cancelled_at = EXCLUDED.cancelled_at,
          legacy_product_group = EXCLUDED.legacy_product_group,
          updated_at = now()`,
        [
          orderId,
          memberId,
          payerMemberId,
          churchId,
          planId,
          productTypeFromPlan(planId),
          asMonth(row.QuietTimeOrder003),
          asMonth(row.QuietTimeOrder004),
          Number(row.QuietTimeOrder016 || 1),
          Number(row.QuietTimeOrder005 || 0),
          mapOrderStatus(row.QuietTimeOrder006),
          mapFinanceStatus(row.QuietTimeOrder008),
          row.QuietTimeOrder007 ? String(row.QuietTimeOrder007) : null,
          Number(row.QuietTimeOrder012 || 0) || null,
          row.QuietTimeOrder013 || null,
          Number(row.QuietTimeOrder015 || 0) || null,
          asDate(row.QuietTimeOrder010),
          asDate(row.QuietTimeOrder011),
          asDate(row.QuietTimeOrder018),
          Number(row.QuietTimeOrder019 || 0) || null
        ]
      );
    }

    for (const row of items) {
      const orderId = Number(row.QuietTimeOrderItem002 || 0);
      if (!orderId) continue;
      const receiverMemberId = Number(row.QuietTimeOrderItem005 || 0) || null;
      await client.query(
        `INSERT INTO qt_order_items (
          order_item_id, order_id, issue_month, is_received, receiver_member_id, received_at
        ) VALUES (
          $1,$2,$3,$4,
          CASE WHEN EXISTS (SELECT 1 FROM pastoral_members WHERE id = $5) THEN $5 ELSE NULL END,
          $6
        )
        ON CONFLICT (order_item_id) DO UPDATE SET
          order_id = EXCLUDED.order_id,
          issue_month = EXCLUDED.issue_month,
          is_received = EXCLUDED.is_received,
          receiver_member_id = EXCLUDED.receiver_member_id,
          received_at = EXCLUDED.received_at,
          updated_at = now()`,
        [
          Number(row.QuietTimeOrderItem001),
          orderId,
          asMonth(row.QuietTimeOrderItem003),
          Boolean(row.QuietTimeOrderItem004),
          receiverMemberId,
          asDate(row.QuietTimeOrderItem006)
        ]
      );
    }
  });

  console.log(`Imported QT legacy data: ${orders.length} orders, ${items.length} items, ${paymentTypes.length} payment types`);
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
