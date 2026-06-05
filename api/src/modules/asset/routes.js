const { pool, tx } = require('../../db');
const { createEntityLink, recordDomainEvent } = require('../../shared/cross-system');
const { FEATURE_ACCESS_RANK, SYSTEM_FEATURES } = require('../core/catalog');

function registerAssetRoutes(app) {
  app.get('/assets', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertAssetReadable(currentUser);
      res.json(await getAssets(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.get('/assets/:assetId', async (req, res, next) => {
    try {
      await assertAssetReadable(parseUser(req));
      const asset = await getAsset(req.params.assetId);
      if (!asset) throw new Error('找不到資產資料');
      res.json({ asset: toAssetDetail(asset) });
    } catch (err) {
      next(err);
    }
  });

  app.post('/assets', async (req, res, next) => {
    try {
      await assertAssetEditable(req.body.currentUser);
      res.json(await saveAsset(req.body.asset || {}, req.body.currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.put('/assets/:assetId', async (req, res, next) => {
    try {
      await assertAssetEditable(req.body.currentUser);
      const asset = req.body.asset || {};
      asset.assetId = req.params.assetId;
      res.json(await saveAsset(asset, req.body.currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.get('/locations', async (req, res, next) => {
    try {
      await assertAssetReadable(parseUser(req));
      res.json(await getLocations());
    } catch (err) {
      next(err);
    }
  });

  app.post('/locations', async (req, res, next) => {
    try {
      assertSuperAdmin(req.body.currentUser);
      const location = req.body.location || {};
      const result = await pool.query(
        `INSERT INTO asset_locations (hall, main_location, sub_location, is_bookable, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          normalizeValue(location.hall),
          normalizeValue(location.mainLocation),
          String(location.subLocation || '').trim(),
          Boolean(location.isBookable),
          Number(location.sortOrder || 0)
        ]
      );
      res.json({ success: true, message: '位置已新增', location: toLocationItem(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  });

  app.put('/locations/:locationId', async (req, res, next) => {
    try {
      assertSuperAdmin(req.body.currentUser);
      const location = req.body.location || {};
      const result = await pool.query(
        `UPDATE asset_locations
         SET hall = $1, main_location = $2, sub_location = $3, is_bookable = $4, sort_order = $5, updated_at = now()
         WHERE location_id = $6
         RETURNING *`,
        [
          normalizeValue(location.hall),
          normalizeValue(location.mainLocation),
          String(location.subLocation || '').trim(),
          Boolean(location.isBookable),
          Number(location.sortOrder || 0),
          req.params.locationId
        ]
      );
      if (!result.rowCount) throw new Error('找不到位置資料');
      res.json({ success: true, message: '位置已更新', location: toLocationItem(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/locations/:locationId', async (req, res, next) => {
    try {
      assertSuperAdmin(parseUser(req));
      const used = await pool.query('SELECT count(*)::int AS count FROM assets WHERE location_id = $1', [req.params.locationId]);
      if (used.rows[0].count > 0) throw new Error('此位置仍有資產使用，無法刪除');
      const result = await pool.query('DELETE FROM asset_locations WHERE location_id = $1', [req.params.locationId]);
      if (!result.rowCount) throw new Error('找不到位置資料');
      res.json({ success: true, message: '位置已刪除' });
    } catch (err) {
      next(err);
    }
  });
}

async function getAssets(query) {
  const keyword = String(query.keyword || '').trim().toLowerCase();
  const assetType = String(query.assetType || '').trim();
  const hall = String(query.hall || '').trim();
  const status = String(query.status || '').trim();
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const offset = (page - 1) * pageSize;
  const sortMap = {
    assetId: 'a.asset_id',
    assetName: 'a.asset_name',
    assetType: 'a.asset_type',
    locationLabel: 'l.hall, l.main_location, l.sub_location',
    status: 'a.status'
  };
  const sortBy = sortMap[query.sortBy] || sortMap.assetId;
  const sortDirection = String(query.sortDirection || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const where = [];
  const values = [];

  if (keyword) {
    values.push(`%${keyword}%`);
    where.push(`(
      lower(a.asset_id) LIKE $${values.length}
      OR lower(a.asset_name) LIKE $${values.length}
      OR lower(coalesce(a.brand, '')) LIKE $${values.length}
      OR lower(coalesce(a.model, '')) LIKE $${values.length}
      OR lower(coalesce(a.serial_no, '')) LIKE $${values.length}
      OR lower(coalesce(a.vendor, '')) LIKE $${values.length}
    )`);
  }
  if (assetType) {
    values.push(assetType);
    where.push(`a.asset_type = $${values.length}`);
  }
  if (hall) {
    values.push(hall);
    where.push(`l.hall = $${values.length}`);
  }
  if (status) {
    values.push(status);
    where.push(`a.status = $${values.length}`);
  }

  const countResult = await pool.query(
    `SELECT count(*)::int AS total
     FROM assets a
     LEFT JOIN asset_locations l ON l.location_id = a.location_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
    values
  );

  values.push(pageSize);
  const limitIndex = values.length;
  values.push(offset);
  const offsetIndex = values.length;

  const { rows } = await pool.query(
    `SELECT
       a.asset_id, a.asset_type, a.asset_name, a.brand, a.model, a.serial_no,
       a.purchase_price, a.purchase_date, a.vendor, a.status, a.location_id, a.note,
       l.hall, l.main_location, l.sub_location
     FROM assets a
     LEFT JOIN asset_locations l ON l.location_id = a.location_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY ${sortBy} ${sortDirection}, a.asset_id ASC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    values
  );

  return { rows: rows.map(toAssetListItem), total: countResult.rows[0].total, page, pageSize };
}

async function getLocations() {
  const { rows } = await pool.query(
    `SELECT * FROM asset_locations
     ORDER BY hall, main_location, sub_location`
  );
  return rows.map(toLocationItem);
}

async function getAsset(assetId) {
  const { rows } = await pool.query(
    `SELECT a.*, l.hall, l.main_location, l.sub_location
     FROM assets a
     LEFT JOIN asset_locations l ON l.location_id = a.location_id
     WHERE a.asset_id = $1`,
    [assetId]
  );
  return rows[0];
}

async function saveAsset(asset, currentUser = null) {
  if (!asset.assetName) throw new Error('請填寫設備名稱');
  if (!asset.assetType) throw new Error('請選擇設備類型');
  if (!asset.locationId) throw new Error('請選擇存放位置');

  const exists = await pool.query('SELECT location_id FROM asset_locations WHERE location_id = $1', [asset.locationId]);
  if (!exists.rows[0]) throw new Error('找不到存放位置');

  return tx(async client => {
    let assetId = String(asset.assetId || '').trim();
    const isNew = !assetId;
    if (!assetId) assetId = await generateAssetId(client, asset.assetType);

    await client.query(
      `INSERT INTO assets (
        asset_id, asset_type, asset_name, brand, model, serial_no,
        purchase_price, purchase_date, location_id, vendor, status, note,
        source_purchase_id, source_payment_id, source_payment_item_id, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now())
      ON CONFLICT (asset_id) DO UPDATE SET
        asset_type = EXCLUDED.asset_type,
        asset_name = EXCLUDED.asset_name,
        brand = EXCLUDED.brand,
        model = EXCLUDED.model,
        serial_no = EXCLUDED.serial_no,
        purchase_price = EXCLUDED.purchase_price,
        purchase_date = EXCLUDED.purchase_date,
        location_id = EXCLUDED.location_id,
        vendor = EXCLUDED.vendor,
        status = EXCLUDED.status,
        note = EXCLUDED.note,
        source_purchase_id = EXCLUDED.source_purchase_id,
        source_payment_id = EXCLUDED.source_payment_id,
        source_payment_item_id = EXCLUDED.source_payment_item_id,
        updated_at = now()`,
      [
        assetId,
        asset.assetType,
        asset.assetName,
        asset.brand || null,
        asset.model || null,
        asset.serialNo || null,
        asset.purchasePrice === '' || asset.purchasePrice === null || asset.purchasePrice === undefined ? null : Number(asset.purchasePrice),
        asset.purchaseDate || null,
        asset.locationId,
        asset.vendor || null,
        asset.status || '使用中',
        asset.note || null,
        asset.sourcePurchaseId || null,
        asset.sourcePaymentId || null,
        asset.sourcePaymentItemId || null
      ]
    );

    await linkAssetSource(client, { asset, assetId, currentUser });
    await recordDomainEvent({
      eventType: isNew ? 'asset.asset_created' : 'asset.asset_saved',
      systemKey: 'asset',
      entityType: 'asset',
      entityId: assetId,
      payload: {
        assetType: asset.assetType,
        sourcePurchaseId: asset.sourcePurchaseId || null,
        sourcePaymentId: asset.sourcePaymentId || null
      },
      currentUser
    }, client);
    return { success: true, assetId, message: isNew ? '資產已建立' : '資產已儲存' };
  });
}

async function linkAssetSource(client, { asset, assetId, currentUser }) {
  if (asset.sourcePaymentId) {
    await createEntityLink({
      sourceSystem: 'finance',
      sourceType: 'payment_request',
      sourceId: asset.sourcePaymentId,
      targetSystem: 'asset',
      targetType: 'asset',
      targetId: assetId,
      linkType: 'converted_to_asset',
      metadata: { sourcePaymentItemId: asset.sourcePaymentItemId || null },
      currentUser
    }, client);

    await client.query(
      `INSERT INTO asset_acquisition_links (asset_id, purchase_id, payment_id, payment_item_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (asset_id, payment_item_id) DO NOTHING`,
      [assetId, asset.sourcePurchaseId || null, asset.sourcePaymentId, asset.sourcePaymentItemId || null]
    );
  }

  if (asset.sourcePurchaseId) {
    await createEntityLink({
      sourceSystem: 'finance',
      sourceType: 'purchase',
      sourceId: asset.sourcePurchaseId,
      targetSystem: 'asset',
      targetType: 'asset',
      targetId: assetId,
      linkType: 'converted_to_asset',
      metadata: { sourcePaymentId: asset.sourcePaymentId || null },
      currentUser
    }, client);
  }
}

async function generateAssetId(client, assetType) {
  const prefixMap = {
    '其他設備': 'O',
    '音響設備': 'M',
    '電腦設備': 'C',
    '網路設備': 'E',
    '影視設備': 'V',
    '燈光設備': 'L',
    '錄音設備': 'R'
  };
  const prefix = prefixMap[assetType] || 'A';
  const { rows } = await client.query(
    'SELECT asset_id FROM assets WHERE asset_id LIKE $1 ORDER BY asset_id DESC LIMIT 1',
    [`${prefix}%`]
  );
  const current = rows[0] ? Number(String(rows[0].asset_id).replace(/^\D+/, '')) : 0;
  return `${prefix}${String(current + 1).padStart(4, '0')}`;
}

function toLocationItem(row) {
  return {
    locationId: row.location_id,
    hall: row.hall,
    mainLocation: row.main_location,
    subLocation: row.sub_location,
    isBookable: row.is_bookable,
    sortOrder: row.sort_order,
    label: [row.hall, row.main_location, row.sub_location].filter(Boolean).join(' / ')
  };
}

function toAssetListItem(row) {
  return {
    assetId: row.asset_id,
    assetType: row.asset_type,
    assetName: row.asset_name,
    brand: row.brand,
    model: row.model,
    serialNo: row.serial_no,
    purchasePrice: row.purchase_price,
    purchaseDate: formatDate(row.purchase_date),
    vendor: row.vendor,
    status: row.status,
    locationId: row.location_id,
    locationLabel: [row.hall, row.main_location, row.sub_location].filter(Boolean).join(' / '),
    note: row.note
  };
}

function toAssetDetail(row) {
  return {
    ...toAssetListItem(row),
    sourcePurchaseId: row.source_purchase_id,
    sourcePaymentId: row.source_payment_id,
    sourcePaymentItemId: row.source_payment_item_id
  };
}

function assertAssetReadable(user) {
  return assertFeatureReadable(user, 'asset');
}

function assertAssetEditable(user) {
  return assertFeatureEditable(user, 'asset');
}

async function assertFeatureReadable(user, featureKey) {
  if (!user || !user.name) throw new Error('缺少登入者資訊');
  const access = await getFeatureAccess(user, featureKey);
  if (access === 'read' || access === 'edit') return access;
  throw new Error('沒有此系統功能的使用權限');
}

async function assertFeatureEditable(user, featureKey) {
  assertDesktop(user);
  const access = await getFeatureAccess(user, featureKey);
  if (access === 'edit') return true;
  throw new Error('沒有此系統功能的操作權限');
}

async function getFeatureAccess(user, featureKey) {
  if (!SYSTEM_FEATURES.includes(featureKey)) return 'none';
  if (user && user.featurePermissions && user.featurePermissions[featureKey]) {
    return user.featurePermissions[featureKey];
  }
  const access = await getEffectiveFeaturePermissions(user);
  return access[featureKey] || 'none';
}

async function getEffectiveFeaturePermissions(user) {
  const roles = normalizeRoles(user && user.roles, user && user.role);
  if (!roles.length) return {};

  const { rows } = await pool.query(
    `SELECT feature_key, access_level
     FROM role_feature_permissions
     WHERE role = ANY($1::text[])`,
    [roles]
  );

  const access = {};
  rows.forEach(row => {
    const current = access[row.feature_key] || 'none';
    if ((FEATURE_ACCESS_RANK[row.access_level] || 0) > (FEATURE_ACCESS_RANK[current] || 0)) {
      access[row.feature_key] = row.access_level;
    }
  });
  if (roles.includes('超級管理者')) {
    SYSTEM_FEATURES.forEach(featureKey => {
      if (!access[featureKey] || (FEATURE_ACCESS_RANK[access[featureKey]] || 0) < FEATURE_ACCESS_RANK.read) {
        access[featureKey] = 'read';
      }
    });
  } else if (roles.includes('管理員')) {
    SYSTEM_FEATURES
      .filter(featureKey => featureKey !== 'system')
      .forEach(featureKey => {
        if (!access[featureKey] || (FEATURE_ACCESS_RANK[access[featureKey]] || 0) < FEATURE_ACCESS_RANK.read) {
          access[featureKey] = 'read';
        }
      });
  }
  return access;
}

function assertSuperAdmin(currentUser) {
  assertDesktop(currentUser);
  if (!currentUser.isSuperAdmin && !hasRole(currentUser, '超級管理者')) {
    throw new Error('只有超級管理者可以操作系統層級設定');
  }
}

function assertDesktop(currentUser) {
  if (!currentUser || currentUser.deviceType === 'mobile') {
    throw new Error('手機版僅提供瀏覽，請使用電腦版操作');
  }
}

function hasRole(user, role) {
  const roles = normalizeRoles(user && user.roles, user && user.role);
  return roles.includes(role);
}

function normalizeRoles(roles, fallbackRole) {
  const values = Array.isArray(roles) ? roles : [];
  const normalized = values
    .concat(fallbackRole || [])
    .map(role => String(role || '').trim())
    .filter(Boolean);
  return [...new Set(normalized)];
}

function normalizeValue(value) {
  const text = String(value || '').trim();
  if (!text) throw new Error('參數內容不可空白');
  return text;
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function parseUser(req) {
  const raw = req.get('x-current-user');
  if (!raw) return {};
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch (err) {
    return {};
  }
}

module.exports = { registerAssetRoutes };
