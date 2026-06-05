const crypto = require('crypto');

const { pool } = require('../../db');
const { assertFeatureEditable, assertFeatureReadable } = require('../../shared/permissions');
const { parseUser } = require('../../shared/users');

function registerCounterRoutes(app) {
  app.get('/counter/pin-code/current', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureEditable(currentUser, 'counter');
      res.json(await getOrCreateCurrentPinCode(currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.get('/counter/transactions', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'counter');
      res.json(await getCounterTransactions(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.patch('/counter/transactions/:transactionId/paid', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'counter');
      const result = await pool.query(
        `UPDATE counter_transactions
         SET status = 'paid',
             received_by_staff_id = $2,
             received_at = now(),
             updated_at = now()
         WHERE transaction_id = $1
           AND status = 'pending'
         RETURNING *`,
        [req.params.transactionId, currentUser.staffId ? String(currentUser.staffId) : null]
      );
      const transaction = result.rows[0];
      if (!transaction) throw new Error('找不到待繳費交易，或此交易已處理');

      if (transaction.source_system === 'forms' && transaction.source_type === 'form_response') {
        await pool.query(
          `UPDATE form_responses
           SET payment_status = 'paid'
           WHERE response_id = $1`,
          [transaction.source_id]
        );
      }

      res.json({ success: true, message: '已完成收款', transactionId: req.params.transactionId });
    } catch (err) {
      next(err);
    }
  });
}

async function getCounterTransactions(query) {
  const status = String(query.status || '').trim();
  const values = [];
  const where = [];
  if (status) {
    values.push(status);
    where.push(`ct.status = $${values.length}`);
  }

  const { rows } = await pool.query(
    `SELECT ct.*
     FROM counter_transactions ct
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY ct.created_at DESC
     LIMIT 200`,
    values
  );
  return rows.map(row => ({
    transactionId: row.transaction_id,
    transactionCode: row.transaction_code,
    businessType: row.business_type,
    sourceSystem: row.source_system,
    sourceType: row.source_type,
    sourceId: row.source_id,
    payerName: row.payer_name,
    amount: Number(row.amount || 0),
    status: row.status,
    paymentMethod: row.payment_method,
    note: row.note,
    createdAt: row.created_at,
    receivedAt: row.received_at
  }));
}

async function getOrCreateCurrentPinCode(currentUser) {
  const week = getTaipeiSundayWeekRange();
  const { rows } = await pool.query(
    `SELECT *
     FROM counter_pin_codes
     WHERE valid_from = $1
       AND valid_until = $2
       AND is_active
     ORDER BY created_at DESC
     LIMIT 1`,
    [week.validFrom, week.validUntil]
  );
  if (rows[0]) return toPinCodeResponse(rows[0]);

  const pinCode = await generateUniquePinCode();
  const result = await pool.query(
    `INSERT INTO counter_pin_codes (
       pin_code, valid_from, valid_until, created_by_staff_id
     ) VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [
      pinCode,
      week.validFrom,
      week.validUntil,
      currentUser.staffId ? String(currentUser.staffId) : null
    ]
  );
  return toPinCodeResponse(result.rows[0]);
}

async function generateUniquePinCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const bytes = crypto.randomBytes(6);
    const code = [...bytes].map(value => alphabet[value % alphabet.length]).join('');
    const exists = await pool.query('SELECT 1 FROM counter_pin_codes WHERE pin_code = $1 LIMIT 1', [code]);
    if (!exists.rowCount) return code;
  }
  throw new Error('PIN Code 產生失敗，請稍後再試');
}

function toPinCodeResponse(row) {
  return {
    pinCode: row.pin_code,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    usageCount: Number(row.usage_count || 0),
    lastUsedAt: row.last_used_at
  };
}

function getTaipeiSundayWeekRange(now = new Date()) {
  const taipeiNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const y = taipeiNow.getUTCFullYear();
  const m = taipeiNow.getUTCMonth();
  const d = taipeiNow.getUTCDate();
  const start = new Date(Date.UTC(y, m, d));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return {
    validFrom: new Date(start.getTime() - 8 * 60 * 60 * 1000),
    validUntil: new Date(end.getTime() - 8 * 60 * 60 * 1000)
  };
}

module.exports = { registerCounterRoutes };
