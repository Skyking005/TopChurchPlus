const { pool, tx } = require('../../db');
const { assertFeatureEditable, assertFeatureReadable } = require('../../shared/permissions');
const { parseUser } = require('../../shared/users');
const { formatDate } = require('../../shared/format');

function registerQtRoutes(app) {
  app.get('/qt/options', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'qt');
      res.json(await getQtOptions());
    } catch (err) {
      next(err);
    }
  });

  app.get('/qt/inventory', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'qt');
      res.json(await getInventory(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.get('/qt/inventory/movements', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'qt');
      res.json(await getInventoryMovements(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.post('/qt/inventory/movements', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'qt');
      res.json(await createInventoryMovement(req.body.movement || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.post('/qt/inventory/transfers', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'qt');
      res.json(await transferInventory(req.body.transfer || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.get('/qt/stock-check', async (req, res, next) => {
    try {
      res.json(await checkStock(req.query));
    } catch (err) {
      next(err);
    }
  });
}

async function getQtOptions() {
  const [productTypes, pricePlans, churches] = await Promise.all([
    pool.query(
      `SELECT product_type, product_name
       FROM qt_product_types
       WHERE is_active
       ORDER BY sort_order, product_type`
    ),
    pool.query(
      `SELECT plan_id, plan_name, product_type, duration_months, unit_price
       FROM qt_price_plans
       WHERE is_active
       ORDER BY plan_id`
    ),
    pool.query(
      `SELECT id, name
       FROM churches
       WHERE church_type = '本會'
       ORDER BY sort_order, id`
    )
  ]);

  return {
    productTypes: productTypes.rows.map(row => ({
      productType: row.product_type,
      productName: row.product_name
    })),
    pricePlans: pricePlans.rows.map(row => ({
      planId: row.plan_id,
      planName: row.plan_name,
      productType: row.product_type,
      durationMonths: row.duration_months,
      unitPrice: Number(row.unit_price || 0)
    })),
    churches: churches.rows.map(row => ({
      churchId: row.id,
      churchName: row.name
    }))
  };
}

async function getInventory(query) {
  const issueMonth = normalizeMonth(query.issueMonth || new Date());
  const values = [issueMonth];
  const where = ['m.issue_month = $1'];

  if (query.churchId) {
    values.push(Number(query.churchId));
    where.push(`m.church_id = $${values.length}`);
  }
  if (query.productType) {
    values.push(String(query.productType));
    where.push(`m.product_type = $${values.length}`);
  }

  const { rows } = await pool.query(
    `SELECT
       m.issue_month,
       m.church_id,
       c.name AS church_name,
       m.product_type,
       pt.product_name,
       COALESCE(sum(m.quantity) FILTER (WHERE m.movement_type IN ('initial_stock','receive','transfer_in','release','adjustment')), 0)::int AS inbound_quantity,
       ABS(COALESCE(sum(m.quantity) FILTER (WHERE m.movement_type IN ('sale','reserve','transfer_out')), 0))::int AS outbound_quantity,
       COALESCE(sum(m.quantity), 0)::int AS available_quantity
     FROM qt_inventory_movements m
     JOIN churches c ON c.id = m.church_id
     JOIN qt_product_types pt ON pt.product_type = m.product_type
     WHERE ${where.join(' AND ')}
     GROUP BY m.issue_month, m.church_id, c.id, c.name, c.sort_order, m.product_type, pt.product_name, pt.sort_order
     ORDER BY c.sort_order, c.id, pt.sort_order, m.product_type`,
    values
  );

  return rows.map(toInventoryItem);
}

async function getInventoryMovements(query) {
  const issueMonth = normalizeMonth(query.issueMonth || new Date());
  const values = [issueMonth];
  const where = ['m.issue_month = $1'];
  if (query.churchId) {
    values.push(Number(query.churchId));
    where.push(`m.church_id = $${values.length}`);
  }
  if (query.productType) {
    values.push(String(query.productType));
    where.push(`m.product_type = $${values.length}`);
  }

  const { rows } = await pool.query(
    `SELECT m.*, c.name AS church_name, pt.product_name, a.name AS created_by_name
     FROM qt_inventory_movements m
     JOIN churches c ON c.id = m.church_id
     JOIN qt_product_types pt ON pt.product_type = m.product_type
     LEFT JOIN accounts a ON a.staff_id = m.created_by_staff_id
     WHERE ${where.join(' AND ')}
     ORDER BY m.created_at DESC, m.movement_id DESC
     LIMIT 200`,
    values
  );
  return rows.map(toMovementItem);
}

async function createInventoryMovement(payload, currentUser) {
  const normalized = normalizeMovementPayload(payload);
  const signedQuantity = signQuantity(normalized.movementType, normalized.quantity);
  const result = await pool.query(
    `INSERT INTO qt_inventory_movements (
       issue_month, church_id, product_type, movement_type, quantity, note, created_by_staff_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING movement_id`,
    [
      normalized.issueMonth,
      normalized.churchId,
      normalized.productType,
      normalized.movementType,
      signedQuantity,
      normalized.note,
      currentUser.staffId ? String(currentUser.staffId) : null
    ]
  );
  return { success: true, movementId: result.rows[0].movement_id, message: 'QT 庫存異動已建立' };
}

async function transferInventory(payload, currentUser) {
  const issueMonth = normalizeMonth(payload.issueMonth);
  const productType = String(payload.productType || '').trim();
  const fromChurchId = Number(payload.fromChurchId || 0);
  const toChurchId = Number(payload.toChurchId || 0);
  const quantity = Number(payload.quantity || 0);
  const note = String(payload.note || '').trim();
  if (!productType) throw new Error('請選擇 QT 類型');
  if (!fromChurchId || !toChurchId || fromChurchId === toChurchId) throw new Error('請選擇不同的調出與調入會堂');
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('調撥數量需大於 0');

  const stock = await getAvailableQuantity({ issueMonth, churchId: fromChurchId, productType });
  if (stock < quantity) throw new Error(`調出會堂庫存不足，目前可用 ${stock} 本`);

  return tx(async client => {
    const outResult = await client.query(
      `INSERT INTO qt_inventory_movements (
         issue_month, church_id, product_type, movement_type, quantity, note, created_by_staff_id
       ) VALUES ($1,$2,$3,'transfer_out',$4,$5,$6)
       RETURNING movement_id`,
      [issueMonth, fromChurchId, productType, -quantity, note, currentUser.staffId ? String(currentUser.staffId) : null]
    );
    const inResult = await client.query(
      `INSERT INTO qt_inventory_movements (
         issue_month, church_id, product_type, movement_type, quantity, related_movement_id, note, created_by_staff_id
       ) VALUES ($1,$2,$3,'transfer_in',$4,$5,$6,$7)
       RETURNING movement_id`,
      [issueMonth, toChurchId, productType, quantity, outResult.rows[0].movement_id, note, currentUser.staffId ? String(currentUser.staffId) : null]
    );
    await client.query(
      'UPDATE qt_inventory_movements SET related_movement_id = $1 WHERE movement_id = $2',
      [inResult.rows[0].movement_id, outResult.rows[0].movement_id]
    );
    return { success: true, message: 'QT 庫存調撥已完成' };
  });
}

async function checkStock(query) {
  const issueMonth = normalizeMonth(query.issueMonth);
  const churchId = Number(query.churchId || 0);
  const productType = String(query.productType || '').trim();
  const quantity = Number(query.quantity || 1);
  if (!churchId || !productType) throw new Error('缺少會堂或 QT 類型');
  const availableQuantity = await getAvailableQuantity({ issueMonth, churchId, productType });
  return {
    issueMonth,
    churchId,
    productType,
    requestedQuantity: quantity,
    availableQuantity,
    canOrder: availableQuantity >= quantity
  };
}

async function getAvailableQuantity({ issueMonth, churchId, productType }) {
  const { rows } = await pool.query(
    `SELECT COALESCE(sum(quantity), 0)::int AS available_quantity
     FROM qt_inventory_movements
     WHERE issue_month = $1
       AND church_id = $2
       AND product_type = $3`,
    [normalizeMonth(issueMonth), churchId, productType]
  );
  return Number(rows[0].available_quantity || 0);
}

function normalizeMovementPayload(payload) {
  const issueMonth = normalizeMonth(payload.issueMonth);
  const churchId = Number(payload.churchId || 0);
  const productType = String(payload.productType || '').trim();
  const movementType = String(payload.movementType || '').trim();
  const quantity = Number(payload.quantity || 0);
  if (!churchId) throw new Error('請選擇會堂');
  if (!productType) throw new Error('請選擇 QT 類型');
  if (!['initial_stock', 'receive', 'sale', 'reserve', 'release', 'adjustment'].includes(movementType)) {
    throw new Error('庫存異動類型錯誤');
  }
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('數量需大於 0');
  return {
    issueMonth,
    churchId,
    productType,
    movementType,
    quantity,
    note: String(payload.note || '').trim()
  };
}

function signQuantity(movementType, quantity) {
  if (['sale', 'reserve'].includes(movementType)) return -Math.abs(quantity);
  return Math.abs(quantity);
}

function normalizeMonth(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error('月份格式錯誤');
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function toInventoryItem(row) {
  return {
    issueMonth: formatDate(row.issue_month),
    churchId: row.church_id,
    churchName: row.church_name,
    productType: row.product_type,
    productName: row.product_name,
    inboundQuantity: Number(row.inbound_quantity || 0),
    outboundQuantity: Number(row.outbound_quantity || 0),
    availableQuantity: Number(row.available_quantity || 0)
  };
}

function toMovementItem(row) {
  return {
    movementId: row.movement_id,
    issueMonth: formatDate(row.issue_month),
    churchId: row.church_id,
    churchName: row.church_name,
    productType: row.product_type,
    productName: row.product_name,
    movementType: row.movement_type,
    quantity: Number(row.quantity || 0),
    note: row.note || '',
    sourceSystem: row.source_system || '',
    sourceId: row.source_id || '',
    createdBy: row.created_by_name || '',
    createdAt: row.created_at
  };
}

module.exports = { registerQtRoutes };
