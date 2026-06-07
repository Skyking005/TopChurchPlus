const crypto = require('crypto');

const { pool } = require('../../db');
const { assertFeatureEditable, assertFeatureReadable } = require('../../shared/permissions');
const { parseUser } = require('../../shared/users');

function registerCounterRoutes(app) {
  app.get('/counter/options', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureEditable(currentUser, 'counter');
      res.json(await getCounterOptions());
    } catch (err) {
      next(err);
    }
  });

  app.get('/counter/pin-codes', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureEditable(currentUser, 'counter');
      res.json(await getCurrentPinCodes());
    } catch (err) {
      next(err);
    }
  });

  app.post('/counter/pin-codes', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'counter');
      const pinCode = await createPinCode(currentUser, req.body.pin || req.body);
      res.json({ success: true, message: 'PIN Code 已建立', pinCode });
    } catch (err) {
      next(err);
    }
  });

  app.put('/counter/pin-codes/:pinId', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'counter');
      res.json(await updatePinCode(req.params.pinId, req.body.pin || req.body));
    } catch (err) {
      next(err);
    }
  });

  app.patch('/counter/pin-codes/:pinId/deactivate', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'counter');
      const result = await pool.query(
        `UPDATE counter_pin_codes
         SET is_active = false, status = 'inactive', updated_at = now()
         WHERE pin_id = $1
         RETURNING *`,
        [req.params.pinId]
      );
      if (!result.rowCount) throw new Error('找不到 PIN Code');
      res.json({ success: true, message: 'PIN Code 已停用', pinCode: toPinCodeResponse(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  });

  app.post('/counter/pin-codes/reset-current-week', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'counter');
      await pool.query(
        `UPDATE counter_pin_codes
         SET is_active = false, status = 'inactive', updated_at = now()
         WHERE is_active`
      );
      const pinCode = await createPinCode(currentUser, req.body.pin || req.body);
      res.json({ success: true, message: 'PIN Code 已重設', pinCode });
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
             received_church_id = $3,
             received_at = now(),
             updated_at = now()
         WHERE transaction_id = $1
           AND status = 'pending'
         RETURNING *`,
        [
          req.params.transactionId,
          currentUser.staffId ? String(currentUser.staffId) : null,
          normalizeChurchId(req.body.churchId || currentUser.counterChurchId)
        ]
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
    receivedChurchId: row.received_church_id,
    note: row.note,
    createdAt: row.created_at,
    receivedAt: row.received_at
  }));
}

async function getCounterOptions() {
  const [churches, accounts] = await Promise.all([
    pool.query(
      `SELECT id, name
       FROM churches
       WHERE is_active
         AND church_type = '本會'
       ORDER BY sort_order, id`
    ),
    pool.query(
      `SELECT staff_id, name, position, department
       FROM accounts
       WHERE coalesce(name, '') <> ''
       ORDER BY
         CASE WHEN staff_id ~ '^[0-9]+$' THEN staff_id::int END NULLS LAST,
         staff_id`
    )
  ]);
  return {
    churches: churches.rows.map(row => ({
      churchId: row.id,
      churchName: row.name
    })),
    accounts: accounts.rows.map(row => ({
      staffId: row.staff_id,
      name: row.name,
      position: row.position || '',
      department: row.department || '',
      label: `${row.name}${row.position ? ` ${row.position}` : ''}`
    })),
    statuses: [
      { value: 'active', label: '啟用' },
      { value: 'inactive', label: '停用' }
    ]
  };
}

async function getCurrentPinCodes() {
  const { rows } = await pool.query(
    `SELECT p.*, a.name AS assigned_name, a.position AS assigned_position,
            c.name AS church_name
     FROM counter_pin_codes p
     LEFT JOIN accounts a ON a.staff_id = p.assigned_staff_id
     LEFT JOIN churches c ON c.id = p.church_id
     ORDER BY p.is_active DESC, p.created_at DESC`
  );
  return rows.map(toPinCodeResponse);
}

async function createPinCode(currentUser, pin = {}) {
  const pinCode = await generateUniquePinCode();
  const normalized = await normalizePinPayload(pin);
  const result = await pool.query(
    `INSERT INTO counter_pin_codes (
       pin_code, valid_from, valid_until, created_by_staff_id, display_name,
       assigned_staff_id, church_id, status, is_active
     ) VALUES ($1, now(), 'infinity'::timestamptz, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      pinCode,
      currentUser.staffId ? String(currentUser.staffId) : null,
      normalized.displayName,
      normalized.assignedStaffId,
      normalized.churchId,
      normalized.status,
      normalized.status === 'active'
    ]
  );
  return getPinCodeById(result.rows[0].pin_id);
}

async function updatePinCode(pinId, pin = {}) {
  const normalized = await normalizePinPayload(pin);
  const result = await pool.query(
    `UPDATE counter_pin_codes
     SET display_name = $2,
         assigned_staff_id = $3,
         church_id = $4,
         status = $5,
         is_active = $6,
         updated_at = now()
     WHERE pin_id = $1
     RETURNING *`,
    [
      pinId,
      normalized.displayName,
      normalized.assignedStaffId,
      normalized.churchId,
      normalized.status,
      normalized.status === 'active'
    ]
  );
  if (!result.rows[0]) throw new Error('找不到 PIN Code');
  return { success: true, message: 'PIN Code 已更新', pinCode: await getPinCodeById(result.rows[0].pin_id) };
}

async function getPinCodeById(pinId) {
  const { rows } = await pool.query(
    `SELECT p.*, a.name AS assigned_name, a.position AS assigned_position, c.name AS church_name
     FROM counter_pin_codes p
     LEFT JOIN accounts a ON a.staff_id = p.assigned_staff_id
     LEFT JOIN churches c ON c.id = p.church_id
     WHERE p.pin_id = $1`,
    [pinId]
  );
  return toPinCodeResponse(rows[0]);
}

async function normalizePinPayload(pin) {
  const assignedStaffId = String(pin.assignedStaffId || pin.staffId || '').trim();
  if (!assignedStaffId) throw new Error('請選擇 PIN 使用者');
  const churchId = normalizeChurchId(pin.churchId);
  if (!churchId) throw new Error('請選擇 PIN 所屬會堂');
  const status = String(pin.status || 'active').trim();
  if (!['active', 'inactive'].includes(status)) throw new Error('PIN 狀態錯誤');

  const { rows } = await pool.query(
    `SELECT a.staff_id, a.name, a.position, c.id AS church_id
     FROM accounts a
     CROSS JOIN churches c
     WHERE a.staff_id = $1
       AND c.id = $2
       AND c.is_active
     LIMIT 1`,
    [assignedStaffId, churchId]
  );
  if (!rows[0]) throw new Error('找不到使用者或會堂資料');
  return {
    assignedStaffId,
    churchId,
    status,
    displayName: `${rows[0].name}${rows[0].position ? ` ${rows[0].position}` : ''}`
  };
}

function normalizeChurchId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function generateUniquePinCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const bytes = crypto.randomBytes(6);
    const code = letters[bytes[0] % letters.length] + [...bytes.slice(1, 6)].map(value => String(value % 10)).join('');
    const exists = await pool.query('SELECT 1 FROM counter_pin_codes WHERE pin_code = $1 LIMIT 1', [code]);
    if (!exists.rowCount) return code;
  }
  throw new Error('PIN Code 產生失敗，請稍後再試');
}

function toPinCodeResponse(row) {
  return {
    pinId: row.pin_id,
    pinCode: row.pin_code,
    displayName: row.display_name || '',
    assignedStaffId: row.assigned_staff_id || '',
    assignedName: row.assigned_name || row.display_name || '',
    assignedPosition: row.assigned_position || '',
    churchId: row.church_id,
    churchName: row.church_name || '',
    status: row.status || (row.is_active ? 'active' : 'inactive'),
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    isActive: Boolean(row.is_active),
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
