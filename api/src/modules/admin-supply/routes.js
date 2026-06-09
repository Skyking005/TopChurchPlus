const { pool, tx } = require('../../db');
const { assertFeatureEditable, assertFeatureReadable } = require('../../shared/permissions');
const { parseUser } = require('../../shared/users');

const MOVEMENT_LABELS = {
  in: '入庫',
  out: '領用',
  transfer: '調撥',
  adjust: '盤點調整',
  discard: '報廢/耗損',
  return: '退回'
};

const LOCATION_SHORT_NAMES = {
  '卓越北大教會': '北大',
  '卓越桃園教會': '桃園',
  '卓越大學教會': '大學',
  '卓越飛航教會': '飛航',
  '卓越台北幸福教會': '台北幸福',
  '香港卓越盈峯行道會': '盈峯',
  '卓越溫哥華行道會': '溫哥華',
  '巨人倉庫': '巨人倉庫'
};

function registerAdminSupplyRoutes(app) {
  app.get('/admin-supplies/options', async (req, res, next) => {
    try {
      await assertFeatureReadable(parseUser(req), 'admin_supply');
      res.json(await getOptions());
    } catch (err) {
      next(err);
    }
  });

  app.get('/admin-supplies/items', async (req, res, next) => {
    try {
      await assertFeatureReadable(parseUser(req), 'admin_supply');
      res.json(await getItems(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.get('/admin-supplies/movements', async (req, res, next) => {
    try {
      await assertFeatureReadable(parseUser(req), 'admin_supply');
      res.json(await getMovements(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.post('/admin-supplies/items', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'admin_supply');
      res.json(await saveItem(req.body.item || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.put('/admin-supplies/items/:supplyId', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'admin_supply');
      res.json(await saveItem({ ...(req.body.item || {}), supplyId: req.params.supplyId }, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.post('/admin-supplies/movements', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'admin_supply');
      res.json(await createMovement(req.body.movement || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });
}

async function getOptions() {
  const [churches, categories, units] = await Promise.all([
    pool.query(
      `SELECT id, name, church_type
       FROM churches
       WHERE is_active
         AND (church_type = '本會' OR code = 'GIANT_WAREHOUSE')
       ORDER BY CASE WHEN code = 'GIANT_WAREHOUSE' THEN 1 ELSE 0 END, sort_order, id`
    ),
    pool.query(
      `SELECT DISTINCT category
       FROM admin_supply_items
       WHERE category <> ''
       ORDER BY category`
    ),
    pool.query(
      `SELECT DISTINCT unit
       FROM admin_supply_items
       WHERE unit <> ''
       ORDER BY unit`
    )
  ]);

  return {
    churches: churches.rows.map(row => ({
      churchId: row.id,
      churchName: row.name,
      churchShortName: getLocationShortName(row.name),
      locationType: row.church_type === '倉庫' ? 'warehouse' : 'church'
    })),
    categories: mergeDefaults(categories.rows.map(row => row.category), ['文具用品', '清潔用品', '紙品耗材', '行政耗材', '活動耗材', '其他']),
    units: mergeDefaults(units.rows.map(row => row.unit), ['個', '包', '盒', '瓶', '袋', '組', '卷', '箱'])
  };
}

function mergeDefaults(values, defaults) {
  return [...new Set([...(values || []), ...defaults].map(value => String(value || '').trim()).filter(Boolean))];
}

async function getItems(query = {}) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const offset = (page - 1) * pageSize;
  const keyword = String(query.keyword || '').trim();
  const category = String(query.category || '').trim();
  const status = String(query.status || '').trim();
  const values = [];
  const where = [];

  if (keyword) {
    values.push(`%${keyword}%`);
    where.push(`(i.supply_code ILIKE $${values.length} OR i.name ILIKE $${values.length} OR i.note ILIKE $${values.length})`);
  }
  if (category) {
    values.push(category);
    where.push(`i.category = $${values.length}`);
  }
  if (status === 'active') where.push('i.is_active');
  if (status === 'inactive') where.push('NOT i.is_active');

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const listValues = values.concat([pageSize, offset]);
  const { rows } = await pool.query(
    `SELECT i.*,
            COALESCE(sum(s.quantity), 0) AS total_quantity,
            COALESCE(jsonb_agg(
              jsonb_build_object(
                'churchId', c.id,
                'churchName', c.name,
                'locationType', CASE WHEN c.church_type = '倉庫' THEN 'warehouse' ELSE 'church' END,
                'quantity', COALESCE(s.quantity, 0)
              )
              ORDER BY CASE WHEN c.code = 'GIANT_WAREHOUSE' THEN 1 ELSE 0 END, c.sort_order, c.id
            ) FILTER (WHERE c.id IS NOT NULL), '[]'::jsonb) AS stocks
     FROM admin_supply_items i
     CROSS JOIN churches c
     LEFT JOIN admin_supply_stocks s ON s.supply_id = i.supply_id AND s.church_id = c.id
     ${whereSql ? `${whereSql} AND c.is_active AND (c.church_type = '本會' OR c.code = 'GIANT_WAREHOUSE')` : "WHERE c.is_active AND (c.church_type = '本會' OR c.code = 'GIANT_WAREHOUSE')"}
     GROUP BY i.supply_id
     ORDER BY i.is_active DESC, i.category, i.name
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    listValues
  );

  const countResult = await pool.query(
    `SELECT count(*)::int AS total
     FROM admin_supply_items i
     ${whereSql}`,
    values
  );

  return {
    rows: rows.map(toItem),
    page,
    pageSize,
    total: Number(countResult.rows[0].total || 0)
  };
}

async function saveItem(item, currentUser) {
  const supplyId = String(item.supplyId || '').trim();
  const name = normalizeRequired(item.name, '請填寫物資名稱');
  const category = String(item.category || '').trim();
  const unit = String(item.unit || '').trim();
  const minStock = normalizeNonNegativeNumber(item.minStock, '最低安全庫存不可小於 0');
  const note = String(item.note || '').trim();
  const isActive = item.isActive !== false;
  const supplyCode = String(item.supplyCode || '').trim() || await generateSupplyCode();

  if (supplyId) {
    const { rows } = await pool.query(
      `UPDATE admin_supply_items
       SET supply_code = $2,
           name = $3,
           category = $4,
           unit = $5,
           min_stock = $6,
           is_active = $7,
           note = $8,
           updated_at = now()
       WHERE supply_id = $1
       RETURNING supply_id`,
      [supplyId, supplyCode, name, category, unit, minStock, isActive, note]
    );
    if (!rows[0]) throw new Error('找不到此物資品項');
    return { success: true, message: '物資品項已更新', supplyId };
  }

  const { rows } = await pool.query(
    `INSERT INTO admin_supply_items (
       supply_code, name, category, unit, min_stock, is_active, note, created_by_staff_id, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
     RETURNING supply_id`,
    [supplyCode, name, category, unit, minStock, isActive, note, currentUser.staffId ? String(currentUser.staffId) : null]
  );
  return { success: true, message: '物資品項已建立', supplyId: rows[0].supply_id };
}

async function createMovement(movement, currentUser) {
  const movementType = normalizeMovementType(movement.movementType);
  const supplyId = normalizeRequired(movement.supplyId, '請選擇物資');
  const quantity = normalizePositiveNumber(movement.quantity, '數量必須大於 0');
  const fromChurchId = movement.fromChurchId ? Number(movement.fromChurchId) : null;
  const toChurchId = movement.toChurchId ? Number(movement.toChurchId) : null;
  const reason = String(movement.reason || '').trim();
  const note = String(movement.note || '').trim();
  const handoverToName = String(movement.handoverToName || '').trim();

  validateMovementTarget(movementType, fromChurchId, toChurchId);

  return tx(async client => {
    await ensureItemExists(client, supplyId);
    if (fromChurchId) await ensureStockEnough(client, supplyId, fromChurchId, quantity);
    if (movementType === 'adjust') {
      await setStockQuantity(client, supplyId, toChurchId, quantity);
    } else {
      if (fromChurchId) await addStockQuantity(client, supplyId, fromChurchId, -quantity);
      if (toChurchId) await addStockQuantity(client, supplyId, toChurchId, quantity);
    }

    const { rows } = await client.query(
      `INSERT INTO admin_supply_movements (
         movement_type, supply_id, from_church_id, to_church_id, quantity,
         reason, note, handled_by_staff_id, handled_by_name, handover_to_name
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING movement_id`,
      [
        movementType,
        supplyId,
        fromChurchId,
        toChurchId,
        quantity,
        reason,
        note,
        currentUser.staffId ? String(currentUser.staffId) : null,
        [currentUser.name, currentUser.position].filter(Boolean).join(' '),
        handoverToName
      ]
    );
    return { success: true, message: '庫存異動已建立', movementId: rows[0].movement_id };
  });
}

function validateMovementTarget(type, fromChurchId, toChurchId) {
  if (type === 'in' || type === 'return' || type === 'adjust') {
    if (!toChurchId) throw new Error('請選擇入庫/調整會堂');
    return;
  }
  if (type === 'out' || type === 'discard') {
    if (!fromChurchId) throw new Error('請選擇扣庫存會堂');
    return;
  }
  if (type === 'transfer') {
    if (!fromChurchId || !toChurchId) throw new Error('調撥需選擇來源與目的會堂');
    if (fromChurchId === toChurchId) throw new Error('來源與目的會堂不可相同');
  }
}

async function ensureItemExists(client, supplyId) {
  const { rows } = await client.query('SELECT 1 FROM admin_supply_items WHERE supply_id = $1', [supplyId]);
  if (!rows[0]) throw new Error('找不到此物資');
}

async function ensureStockEnough(client, supplyId, churchId, quantity) {
  const { rows } = await client.query(
    `SELECT quantity
     FROM admin_supply_stocks
     WHERE supply_id = $1 AND church_id = $2
     FOR UPDATE`,
    [supplyId, churchId]
  );
  const current = Number(rows[0]?.quantity || 0);
  if (current < quantity) throw new Error(`庫存不足，目前數量為 ${formatQuantity(current)}`);
}

async function addStockQuantity(client, supplyId, churchId, delta) {
  await client.query(
    `INSERT INTO admin_supply_stocks (supply_id, church_id, quantity, updated_at)
     VALUES ($1,$2,GREATEST($3, 0),now())
     ON CONFLICT (supply_id, church_id) DO UPDATE SET
       quantity = admin_supply_stocks.quantity + $3,
       updated_at = now()`,
    [supplyId, churchId, delta]
  );
}

async function setStockQuantity(client, supplyId, churchId, quantity) {
  await client.query(
    `INSERT INTO admin_supply_stocks (supply_id, church_id, quantity, updated_at)
     VALUES ($1,$2,$3,now())
     ON CONFLICT (supply_id, church_id) DO UPDATE SET
       quantity = EXCLUDED.quantity,
       updated_at = now()`,
    [supplyId, churchId, quantity]
  );
}

async function getMovements(query = {}) {
  const supplyId = String(query.supplyId || '').trim();
  const movementType = String(query.movementType || '').trim();
  const limit = Math.min(Math.max(Number(query.limit || 100), 1), 300);
  const values = [];
  const where = [];
  if (supplyId) {
    values.push(supplyId);
    where.push(`m.supply_id = $${values.length}`);
  }
  if (movementType) {
    values.push(movementType);
    where.push(`m.movement_type = $${values.length}`);
  }
  values.push(limit);
  const { rows } = await pool.query(
    `SELECT m.*,
            i.supply_code,
            i.name AS supply_name,
            i.unit,
            fc.name AS from_church_name,
            tc.name AS to_church_name
     FROM admin_supply_movements m
     JOIN admin_supply_items i ON i.supply_id = m.supply_id
     LEFT JOIN churches fc ON fc.id = m.from_church_id
     LEFT JOIN churches tc ON tc.id = m.to_church_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY m.created_at DESC
     LIMIT $${values.length}`,
    values
  );
  return rows.map(row => ({
    movementId: row.movement_id,
    movementType: row.movement_type,
    movementTypeLabel: MOVEMENT_LABELS[row.movement_type] || row.movement_type,
    supplyId: row.supply_id,
    supplyCode: row.supply_code,
    supplyName: row.supply_name,
    unit: row.unit,
    fromChurchId: row.from_church_id,
    fromChurchName: row.from_church_name || '',
    toChurchId: row.to_church_id,
    toChurchName: row.to_church_name || '',
    quantity: Number(row.quantity || 0),
    reason: row.reason || '',
    note: row.note || '',
    handledByName: row.handled_by_name || '',
    handoverToName: row.handover_to_name || '',
    createdAt: row.created_at
  }));
}

async function generateSupplyCode() {
  const { rows } = await pool.query(
    `SELECT supply_code
     FROM admin_supply_items
     WHERE supply_code ~ '^I[0-9]{4}$'
     ORDER BY substring(supply_code from 2)::int DESC
     LIMIT 1`
  );
  const last = rows[0]?.supply_code || '';
  const next = String((Number(last.slice(1)) || 0) + 1).padStart(4, '0');
  return `I${next}`;
}

function normalizeRequired(value, message) {
  const text = String(value || '').trim();
  if (!text) throw new Error(message);
  return text;
}

function normalizePositiveNumber(value, message) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(message);
  return number;
}

function normalizeNonNegativeNumber(value, message) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number < 0) throw new Error(message);
  return number;
}

function normalizeMovementType(value) {
  const type = String(value || '').trim();
  if (!MOVEMENT_LABELS[type]) throw new Error('庫存異動類型錯誤');
  return type;
}

function formatQuantity(value) {
  return Number(value || 0).toLocaleString('zh-TW', { maximumFractionDigits: 2 });
}

function getLocationShortName(name) {
  return LOCATION_SHORT_NAMES[name] || name;
}

function toItem(row) {
  const stocks = Array.isArray(row.stocks) ? row.stocks : [];
  return {
    supplyId: row.supply_id,
    supplyCode: row.supply_code,
    name: row.name,
    category: row.category || '',
    unit: row.unit || '',
    minStock: Number(row.min_stock || 0),
    isActive: Boolean(row.is_active),
    note: row.note || '',
    totalQuantity: Number(row.total_quantity || 0),
    isLowStock: stocks.some(stock => Number(stock.quantity || 0) < Number(row.min_stock || 0)),
    stocks: stocks.map(stock => ({
      churchId: stock.churchId,
      churchName: stock.churchName,
      churchShortName: getLocationShortName(stock.churchName),
      locationType: stock.locationType || 'church',
      quantity: Number(stock.quantity || 0),
      isLowStock: Number(stock.quantity || 0) < Number(row.min_stock || 0)
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

module.exports = { registerAdminSupplyRoutes };
