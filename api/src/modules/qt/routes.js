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

  app.get('/qt/orders', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'qt');
      res.json(await getOrders(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.get('/qt/orders/:orderId', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'qt');
      res.json(await getOrderDetail(req.params.orderId));
    } catch (err) {
      next(err);
    }
  });

  app.get('/qt/reports/:type', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'qt');
      res.json(await getReport(req.params.type, req.query));
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

async function getOrders(query) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 50);
  const offset = (page - 1) * pageSize;
  const keyword = String(query.keyword || '').trim();
  const values = [];
  const where = [];

  if (keyword) {
    values.push(`%${keyword}%`);
    where.push(`(
      CAST(o.order_id AS text) ILIKE $${values.length}
      OR COALESCE(m.name, '') ILIKE $${values.length}
      OR COALESCE(pc.mobile_phone, '') ILIKE $${values.length}
      OR COALESCE(pg.name, '') ILIKE $${values.length}
    )`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const listValues = values.concat([pageSize, offset]);
  const { rows } = await pool.query(
    `${orderListSelect()}
     ${whereSql}
     ORDER BY o.order_id DESC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    listValues
  );
  const countResult = await pool.query(
    `SELECT count(*)::int AS total
     FROM qt_orders o
     LEFT JOIN pastoral_members m ON m.id = o.member_id
     LEFT JOIN pastoral_member_contacts pc ON pc.member_id = m.id
     LEFT JOIN LATERAL (
       SELECT g.name
       FROM pastoral_member_group_assignments a
       JOIN pastoral_groups g ON g.id = a.group_id
       WHERE a.member_id = m.id AND a.is_current
       ORDER BY g.level_no DESC, g.sort_order DESC, g.id DESC
       LIMIT 1
     ) pg ON true
     ${whereSql}`,
    values
  );

  return {
    rows: rows.map(toOrderListItem),
    page,
    pageSize,
    total: Number(countResult.rows[0].total || 0)
  };
}

async function getOrderDetail(orderId) {
  const { rows } = await pool.query(
    `${orderListSelect()}
     WHERE o.order_id = $1`,
    [Number(orderId)]
  );
  if (!rows.length) throw new Error('找不到此 QT 訂單');

  const items = await pool.query(
    `SELECT i.order_item_id, i.issue_month, i.is_received, i.received_at, rm.name AS receiver_name
     FROM qt_order_items i
     LEFT JOIN pastoral_members rm ON rm.id = i.receiver_member_id
     WHERE i.order_id = $1
     ORDER BY i.issue_month, i.order_item_id`,
    [Number(orderId)]
  );

  return {
    ...toOrderListItem(rows[0]),
    items: items.rows.map(row => ({
      orderItemId: row.order_item_id,
      issueMonth: formatDate(row.issue_month),
      isReceived: Boolean(row.is_received),
      receiverName: row.receiver_name || '',
      receivedAt: row.received_at
    }))
  };
}

async function getReport(type, query) {
  if (type === 'finance') return getFinanceReport(query);
  if (type === 'expiring') return getExpiringReport(query);
  if (type === 'pickup') return getPickupReport(query);
  if (type === 'pastoral-summary') return getPastoralSummaryReport(query);
  throw new Error('QT 報表類型錯誤');
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

function orderListSelect() {
  return `SELECT
       o.order_id,
       o.start_month,
       o.end_month,
       o.quantity,
       o.amount,
       o.order_status,
       o.finance_status,
       o.ordered_at,
       o.paid_at,
       o.cancelled_at,
       c.name AS church_name,
       m.name AS member_name,
       pc.mobile_phone,
       pg.name AS pastoral_group_name,
       p.plan_name,
       pt.payment_type_name
     FROM qt_orders o
     LEFT JOIN churches c ON c.id = o.church_id
     LEFT JOIN pastoral_members m ON m.id = o.member_id
     LEFT JOIN pastoral_member_contacts pc ON pc.member_id = m.id
     LEFT JOIN qt_price_plans p ON p.plan_id = o.plan_id
     LEFT JOIN qt_payment_types pt ON pt.payment_type_id = o.payment_type_id
     LEFT JOIN LATERAL (
       SELECT g.name
       FROM pastoral_member_group_assignments a
       JOIN pastoral_groups g ON g.id = a.group_id
       WHERE a.member_id = m.id AND a.is_current
       ORDER BY g.level_no DESC, g.sort_order DESC, g.id DESC
       LIMIT 1
     ) pg ON true`;
}

async function getFinanceReport(query) {
  const issueMonth = normalizeMonth(query.issueMonth || new Date());
  const { rows } = await pool.query(
    `SELECT c.name AS church_name, pt.payment_type_name, o.finance_status,
       count(*)::int AS order_count,
       COALESCE(sum(o.quantity), 0)::int AS quantity,
       COALESCE(sum(o.amount), 0)::int AS amount
     FROM qt_orders o
     LEFT JOIN churches c ON c.id = o.church_id
     LEFT JOIN qt_payment_types pt ON pt.payment_type_id = o.payment_type_id
     WHERE date_trunc('month', o.paid_at)::date = $1
     GROUP BY c.sort_order, c.name, pt.payment_type_name, o.finance_status
     ORDER BY c.sort_order, c.name, pt.payment_type_name, o.finance_status`,
    [issueMonth]
  );
  return rows.map(row => ({
    churchName: row.church_name || '未設定會堂',
    paymentTypeName: row.payment_type_name || '未設定',
    financeStatus: row.finance_status,
    orderCount: Number(row.order_count || 0),
    quantity: Number(row.quantity || 0),
    amount: Number(row.amount || 0)
  }));
}

async function getExpiringReport(query) {
  const issueMonth = normalizeMonth(query.issueMonth || new Date());
  const { rows } = await pool.query(
    `${orderListSelect()}
     WHERE date_trunc('month', o.end_month)::date = $1
       AND o.order_status <> 'cancelled'
     ORDER BY c.sort_order, pg.name, m.name, o.order_id`,
    [issueMonth]
  );
  return rows.map(toOrderListItem);
}

async function getPickupReport(query) {
  const issueMonth = normalizeMonth(query.issueMonth || new Date());
  const { rows } = await pool.query(
    `SELECT c.name AS church_name, pg.name AS pastoral_group_name, m.name AS member_name,
       pc.mobile_phone, o.order_id, p.plan_name, i.issue_month, i.is_received,
       i.received_at, rm.name AS receiver_name
     FROM qt_order_items i
     JOIN qt_orders o ON o.order_id = i.order_id
     LEFT JOIN churches c ON c.id = o.church_id
     LEFT JOIN pastoral_members m ON m.id = o.member_id
     LEFT JOIN pastoral_member_contacts pc ON pc.member_id = m.id
     LEFT JOIN pastoral_members rm ON rm.id = i.receiver_member_id
     LEFT JOIN qt_price_plans p ON p.plan_id = o.plan_id
     LEFT JOIN LATERAL (
       SELECT g.name
       FROM pastoral_member_group_assignments a
       JOIN pastoral_groups g ON g.id = a.group_id
       WHERE a.member_id = m.id AND a.is_current
       ORDER BY g.level_no DESC, g.sort_order DESC, g.id DESC
       LIMIT 1
     ) pg ON true
     WHERE i.issue_month = $1
     ORDER BY c.sort_order, pg.name, m.name, o.order_id
     LIMIT 500`,
    [issueMonth]
  );
  return rows.map(row => ({
    churchName: row.church_name || '未設定會堂',
    pastoralGroupName: row.pastoral_group_name || '未分配',
    memberName: row.member_name || '',
    mobilePhone: row.mobile_phone || '',
    orderId: row.order_id,
    planName: row.plan_name || '',
    issueMonth: formatDate(row.issue_month),
    isReceived: Boolean(row.is_received),
    receiverName: row.receiver_name || '',
    receivedAt: row.received_at
  }));
}

async function getPastoralSummaryReport(query) {
  const issueMonth = normalizeMonth(query.issueMonth || new Date());
  const { rows } = await pool.query(
    `SELECT c.name AS church_name, COALESCE(pg.name, '未分配') AS pastoral_group_name,
       p.plan_name,
       count(DISTINCT o.order_id)::int AS order_count,
       COALESCE(sum(o.quantity), 0)::int AS quantity,
       COALESCE(sum(o.amount), 0)::int AS amount
     FROM qt_order_items i
     JOIN qt_orders o ON o.order_id = i.order_id
     LEFT JOIN churches c ON c.id = o.church_id
     LEFT JOIN pastoral_members m ON m.id = o.member_id
     LEFT JOIN qt_price_plans p ON p.plan_id = o.plan_id
     LEFT JOIN LATERAL (
       SELECT g.name
       FROM pastoral_member_group_assignments a
       JOIN pastoral_groups g ON g.id = a.group_id
       WHERE a.member_id = m.id AND a.is_current
       ORDER BY g.level_no DESC, g.sort_order DESC, g.id DESC
       LIMIT 1
     ) pg ON true
     WHERE i.issue_month = $1
     GROUP BY c.sort_order, c.name, pg.name, p.plan_name
     ORDER BY c.sort_order, c.name, pg.name, p.plan_name`,
    [issueMonth]
  );
  return rows.map(row => ({
    churchName: row.church_name || '未設定會堂',
    pastoralGroupName: row.pastoral_group_name || '未分配',
    planName: row.plan_name || '',
    orderCount: Number(row.order_count || 0),
    quantity: Number(row.quantity || 0),
    amount: Number(row.amount || 0)
  }));
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

function toOrderListItem(row) {
  return {
    orderId: row.order_id,
    churchName: row.church_name || '未設定會堂',
    pastoralGroupName: row.pastoral_group_name || '未分配',
    memberName: row.member_name || '',
    mobilePhone: row.mobile_phone || '',
    startMonth: formatDate(row.start_month),
    endMonth: formatDate(row.end_month),
    planName: row.plan_name || '',
    quantity: Number(row.quantity || 0),
    amount: Number(row.amount || 0),
    orderStatus: row.order_status,
    financeStatus: row.finance_status,
    paymentTypeName: row.payment_type_name || '',
    orderedAt: row.ordered_at,
    paidAt: row.paid_at,
    cancelledAt: row.cancelled_at
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
