require('dotenv').config();

const { createApp } = require('./app');
const { pool, tx } = require('./db');
const { createApiKeyMiddleware } = require('./middleware/api-key');
const { FEATURE_ACCESS_RANK, PARAM_CATEGORIES, SYSTEM_FEATURES } = require('./modules/core/catalog');
const { registerCoreRoutes } = require('./modules/core/routes');

const app = createApp();

app.use(createApiKeyMiddleware({ publicPaths: ['/health'] }));
registerCoreRoutes(app);

app.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const deviceType = req.body.deviceType === 'mobile' ? 'mobile' : 'desktop';
    if (!email) throw new Error('請輸入電子信箱');

    const { rows } = await pool.query('SELECT * FROM accounts WHERE lower(email) = $1', [email]);
    const user = rows[0];
    if (!user) throw new Error('此電子信箱沒有系統使用權限');
    const roles = await getAccountRoles(user.staff_id, user.role);
    const featurePermissions = await getEffectiveFeaturePermissions({ roles, role: user.role });
    const featureUsage = await getFeatureUsageSummary(user.staff_id);

    res.json({
      staffId: user.staff_id,
      email,
      name: user.name,
      position: user.position,
      role: user.role,
      roles,
      featurePermissions,
      featureUsage,
      deviceType,
      isAdmin: roles.includes('管理員') || roles.includes('超級管理者'),
      isSuperAdmin: roles.includes('超級管理者')
    });
  } catch (err) {
    next(err);
  }
});

app.get('/initial-data', async (req, res, next) => {
  try {
    const [params, accounts, featurePermissions] = await Promise.all([getParams(), getAccounts(), getFeaturePermissions()]);
    res.json({ params, accounts, featurePermissions });
  } catch (err) {
    next(err);
  }
});

app.get('/projects', async (req, res, next) => {
  try {
    let currentUser = parseUser(req);
    if (!currentUser || !currentUser.name) currentUser = parseQueryUser(req);
    const keyword = String(req.query.keyword || '').trim().toLowerCase();
    const projectType = String(req.query.projectType || '').trim();
    const unit = String(req.query.unit || '').trim();
    const where = [];
    const values = [];
    const joins = [];

    if (!currentUser || !currentUser.name) {
      throw new Error('缺少登入者資訊，無法查詢專案清單');
    }

    await assertFeatureReadable(currentUser, 'project');

    if (!hasAnyRole(currentUser, ['管理員', '超級管理者'])) {
      joins.push('JOIN project_permissions pp ON pp.project_id = p.project_id');
      if (currentUser.staffId) {
        values.push(String(currentUser.staffId));
        where.push(`pp.staff_id = $${values.length}`);
      } else {
        values.push(currentUser.name);
        where.push(`pp.name = $${values.length}`);
      }
    }

    if (keyword) {
      values.push(`%${keyword}%`);
      where.push(`(lower(p.project_id) LIKE $${values.length} OR lower(p.project_name) LIKE $${values.length} OR lower(p.content) LIKE $${values.length} OR lower(p.login_user) LIKE $${values.length})`);
    }
    if (projectType) {
      values.push(projectType);
      where.push(`p.project_type = $${values.length}`);
    }
    if (unit) {
      values.push(unit);
      where.push(`$${values.length} = ANY(p.units)`);
    }

    const sql = `
      SELECT DISTINCT p.project_id, p.login_user, p.project_name, p.project_type, p.start_date, p.end_date, p.units, p.status
      FROM projects p
      ${joins.join(' ')}
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY p.project_id DESC
    `;
    const { rows } = await pool.query(sql, values);
    res.json(rows.map(toProjectListItem));
  } catch (err) {
    next(err);
  }
});

app.get('/projects/:projectId/detail', async (req, res, next) => {
  try {
    const currentUser = parseUser(req);
    const data = await getProjectDetail(req.params.projectId, currentUser);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

app.post('/projects/detail', async (req, res, next) => {
  try {
    const currentUser = req.body.currentUser;
    const projectId = req.body.projectId || '';
    if (!projectId) return res.json(createEmptyProject(currentUser));
    const data = await getProjectDetail(projectId, currentUser);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

app.post('/projects', async (req, res, next) => {
  try {
    await assertFeatureEditable(req.body.currentUser, 'project');
    const result = await saveProject(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.get('/purchases', async (req, res, next) => {
  try {
    await assertFeatureReadable(parseUser(req), 'finance');
    const keyword = String(req.query.keyword || '').trim().toLowerCase();
    const where = [];
    const values = [];

    if (keyword) {
      values.push(`%${keyword}%`);
      where.push(`(lower(purchase_id) LIKE $${values.length} OR lower(summary) LIKE $${values.length} OR lower(applicant) LIKE $${values.length} OR lower(department) LIKE $${values.length})`);
    }

    const { rows } = await pool.query(
      `SELECT purchase_id, summary, status, total_amount
       FROM purchases
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY purchase_id DESC`,
      values
    );

    res.json(rows.map(toPurchaseListItem));
  } catch (err) {
    next(err);
  }
});

app.post('/purchases/detail', async (req, res, next) => {
  try {
    const currentUser = req.body.currentUser || {};
    await assertFeatureReadable(currentUser, 'finance');
    const purchaseId = req.body.purchaseId || '';
    if (!purchaseId) return res.json(createEmptyPurchase(currentUser));
    res.json(await getPurchaseDetail(purchaseId));
  } catch (err) {
    next(err);
  }
});

app.post('/purchases', async (req, res, next) => {
  try {
    await assertFeatureEditable(req.body.currentUser, 'finance');
    res.json(await savePurchase(req.body));
  } catch (err) {
    next(err);
  }
});

app.patch('/purchases/:purchaseId/close', async (req, res, next) => {
  try {
    await assertFeatureEditable(req.body.currentUser, 'finance');
    const result = await pool.query(
      `UPDATE purchases SET status = '已結案', updated_at = now() WHERE purchase_id = $1`,
      [req.params.purchaseId]
    );
    if (!result.rowCount) throw new Error('找不到採購資料');
    res.json({ success: true, message: '採購案已結案' });
  } catch (err) {
    next(err);
  }
});

app.post('/purchases/:purchaseId/advances', async (req, res, next) => {
  try {
    await assertFeatureEditable(req.body.currentUser, 'finance');
    res.json(await savePurchaseAdvance(req.params.purchaseId, req.body));
  } catch (err) {
    next(err);
  }
});

app.post('/purchases/:purchaseId/expense-proofs', async (req, res, next) => {
  try {
    await assertFeatureEditable(req.body.currentUser, 'finance');
    res.json(await saveExpenseProof(req.params.purchaseId, req.body));
  } catch (err) {
    next(err);
  }
});

app.post('/purchases/:purchaseId/payment-requests', async (req, res, next) => {
  try {
    await assertFeatureEditable(req.body.currentUser, 'finance');
    res.json(await savePaymentRequest(req.params.purchaseId, req.body));
  } catch (err) {
    next(err);
  }
});

app.get('/assets', async (req, res, next) => {
  try {
    const currentUser = parseUser(req);
    await assertAssetReadable(currentUser);

    const keyword = String(req.query.keyword || '').trim().toLowerCase();
    const assetType = String(req.query.assetType || '').trim();
    const hall = String(req.query.hall || '').trim();
    const status = String(req.query.status || '').trim();
    const page = Math.max(Number(req.query.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize || 10), 1), 100);
    const offset = (page - 1) * pageSize;
    const sortMap = {
      assetId: 'a.asset_id',
      assetName: 'a.asset_name',
      assetType: 'a.asset_type',
      locationLabel: 'l.hall, l.main_location, l.sub_location',
      status: 'a.status'
    };
    const sortBy = sortMap[req.query.sortBy] || sortMap.assetId;
    const sortDirection = String(req.query.sortDirection || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
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

    res.json({ rows: rows.map(toAssetListItem), total: countResult.rows[0].total, page, pageSize });
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

app.get('/pastoral/options', async (req, res, next) => {
  try {
    const currentUser = parseUser(req);
    await assertPastoralReadable(currentUser);
    res.json(await getPastoralOptions(currentUser));
  } catch (err) {
    next(err);
  }
});

app.get('/pastoral/members', async (req, res, next) => {
  try {
    const currentUser = parseUser(req);
    await assertPastoralReadable(currentUser);
    res.json(await getPastoralMembers(req.query, currentUser));
  } catch (err) {
    next(err);
  }
});

app.get('/pastoral/members/:memberId', async (req, res, next) => {
  try {
    const currentUser = parseUser(req);
    await assertPastoralReadable(currentUser);
    const data = await getPastoralMemberDetail(req.params.memberId, currentUser);
    if (!data.member) throw new Error('找不到會友資料');
    res.json(data);
  } catch (err) {
    next(err);
  }
});

app.post('/assets', async (req, res, next) => {
  try {
    await assertAssetEditable(req.body.currentUser);
    res.json(await saveAsset(req.body.asset || {}));
  } catch (err) {
    next(err);
  }
});

app.put('/assets/:assetId', async (req, res, next) => {
  try {
    await assertAssetEditable(req.body.currentUser);
    const asset = req.body.asset || {};
    asset.assetId = req.params.assetId;
    res.json(await saveAsset(asset));
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

app.get('/system/users', async (req, res, next) => {
  try {
    assertSuperAdmin(parseUser(req));
    res.json(await getAccounts());
  } catch (err) {
    next(err);
  }
});

app.post('/system/users', async (req, res, next) => {
  try {
    assertSuperAdmin(req.body.currentUser);
    const user = req.body.user || {};
    const staffId = normalizeValue(user.staffId);
    const email = normalizeValue(user.email).toLowerCase();
    const name = normalizeValue(user.name);
    const position = String(user.position || '').trim();

    await pool.query(
      `INSERT INTO accounts (staff_id, email, name, position, role, updated_at)
       VALUES ($1, $2, $3, $4, '使用者', now())
       ON CONFLICT (staff_id) DO UPDATE SET
         email = EXCLUDED.email,
         name = EXCLUDED.name,
         position = EXCLUDED.position,
         updated_at = now()`,
      [staffId, email, name, position]
    );

    await pool.query(
      `INSERT INTO account_roles (staff_id, role)
       VALUES ($1, $2)
       ON CONFLICT (staff_id, role) DO NOTHING`,
      [staffId, '使用者']
    );

    res.json({ success: true, message: '使用者已儲存' });
  } catch (err) {
    next(err);
  }
});

app.put('/system/users/:staffId/pastoral-churches', async (req, res, next) => {
  try {
    assertSuperAdmin(req.body.currentUser);
    const staffId = req.params.staffId;
    const churchIds = Array.isArray(req.body.churchIds) ? req.body.churchIds : [];
    await savePastoralChurchPermissions(staffId, churchIds);
    res.json({ success: true, message: '牧養資料權限已儲存', users: await getAccounts() });
  } catch (err) {
    next(err);
  }
});

app.put('/system/users/:staffId/roles', async (req, res, next) => {
  try {
    assertSuperAdmin(req.body.currentUser);
    const staffId = req.params.staffId;
    const roles = normalizeRoles(req.body.roles, null);
    if (!roles.length) throw new Error('請至少選擇一個權限身分');

    const exists = await pool.query('SELECT staff_id FROM accounts WHERE staff_id = $1', [staffId]);
    if (!exists.rows[0]) throw new Error('找不到使用者資料');

    await tx(async client => {
      await client.query('DELETE FROM account_roles WHERE staff_id = $1', [staffId]);
      for (const role of roles) {
        await client.query(
          `INSERT INTO account_roles (staff_id, role)
           VALUES ($1, $2)
           ON CONFLICT (staff_id, role) DO NOTHING`,
          [staffId, role]
        );
      }
      await client.query('UPDATE accounts SET role = $1, updated_at = now() WHERE staff_id = $2', [roles[0], staffId]);
    });

    res.json({ success: true, message: '使用者權限已儲存' });
  } catch (err) {
    next(err);
  }
});

app.post('/usage', async (req, res, next) => {
  try {
    await recordUsage(req.body.currentUser, req.body.featureKey, req.body.action, req.body.metadata);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

app.get('/system/feature-permissions', async (req, res, next) => {
  try {
    assertSuperAdmin(parseUser(req));
    res.json(await getFeaturePermissions());
  } catch (err) {
    next(err);
  }
});

app.put('/system/feature-permissions', async (req, res, next) => {
  try {
    assertSuperAdmin(req.body.currentUser);
    const permissions = Array.isArray(req.body.permissions) ? req.body.permissions : [];
    await saveFeaturePermissions(permissions);
    res.json({ success: true, message: '功能權限已儲存', featurePermissions: await getFeaturePermissions() });
  } catch (err) {
    next(err);
  }
});

app.get('/projects/:projectId/meetings', async (req, res, next) => {
  try {
    const currentUser = parseUser(req);
    await assertProjectAccess(req.params.projectId, currentUser);
    res.json(await getMeetings(req.params.projectId));
  } catch (err) {
    next(err);
  }
});

app.post('/projects/:projectId/permissions', async (req, res, next) => {
  try {
    const { currentUser, staffId, permission } = req.body;
    await assertFullControl(req.params.projectId, currentUser);
    if (!staffId || !permission) throw new Error('權限資料不完整');

    const { rows } = await pool.query('SELECT staff_id, name FROM accounts WHERE staff_id = $1', [staffId]);
    const account = rows[0];
    if (!account) throw new Error('找不到人員資料');

    await pool.query(
      `INSERT INTO project_permissions (project_id, staff_id, name, permission)
       VALUES ($1, $2, $3, $4)`,
      [req.params.projectId, staffId, account.name, permission]
    );

    res.json({ success: true, message: '已新增專案權限' });
  } catch (err) {
    next(err);
  }
});

app.delete('/projects/:projectId/permissions/:staffId', async (req, res, next) => {
  try {
    await assertFullControl(req.params.projectId, parseUser(req));
    const result = await pool.query(
      'DELETE FROM project_permissions WHERE project_id = $1 AND staff_id = $2',
      [req.params.projectId, req.params.staffId]
    );
    if (!result.rowCount) throw new Error('找不到要刪除的權限資料');
    res.json({ success: true, message: '已刪除專案權限' });
  } catch (err) {
    next(err);
  }
});

app.post('/meetings', async (req, res, next) => {
  try {
    const { currentUser, meeting } = req.body;
    const projectId = meeting['計畫編號'];
    await assertFullControl(projectId, currentUser);
    const meetingId = await generateMeetingId();

    await pool.query(
      `INSERT INTO meetings (meeting_id, project_id, meeting_time, topic, agenda, decision, attendees, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        meetingId,
        projectId,
        meeting['會議時間'] || null,
        meeting['會議主題'] || '',
        meeting['討論議題'] || '',
        meeting['會議決議'] || '',
        splitCsv(meeting['與會者']),
        meeting['會議狀態'] || '預約中'
      ]
    );
    res.json({ success: true, message: '已新增會議記錄' });
  } catch (err) {
    next(err);
  }
});

app.put('/projects/:projectId/meetings/:meetingId', async (req, res, next) => {
  try {
    const { currentUser, meeting } = req.body;
    await assertFullControl(req.params.projectId, currentUser);
    const old = await pool.query('SELECT status FROM meetings WHERE meeting_id = $1', [req.params.meetingId]);
    if (!old.rows[0]) throw new Error('找不到會議資料');

    await pool.query(
      `UPDATE meetings
       SET meeting_time = $1, topic = $2, agenda = $3, decision = $4, attendees = $5, status = $6, updated_at = now()
       WHERE meeting_id = $7`,
      [
        meeting['會議時間'] || null,
        meeting['會議主題'] || '',
        meeting['討論議題'] || '',
        meeting['會議決議'] || '',
        splitCsv(meeting['與會者']),
        meeting['會議狀態'] || old.rows[0].status,
        req.params.meetingId
      ]
    );
    res.json({ success: true, message: '已更新會議記錄' });
  } catch (err) {
    next(err);
  }
});

app.patch('/projects/:projectId/meetings/:meetingId/status', async (req, res, next) => {
  try {
    const { currentUser, status } = req.body;
    await assertFullControl(req.params.projectId, currentUser);
    const result = await pool.query(
      'UPDATE meetings SET status = $1, updated_at = now() WHERE meeting_id = $2',
      [status, req.params.meetingId]
    );
    if (!result.rowCount) throw new Error('找不到會議資料');
    res.json({ success: true, message: `會議狀態已改為「${status}」` });
  } catch (err) {
    next(err);
  }
});

app.get('/params/:type', async (req, res, next) => {
  try {
    assertSuperAdmin(parseUser(req));
    res.json(await getParamValues(req.params.type));
  } catch (err) {
    next(err);
  }
});

app.post('/params/:type', async (req, res, next) => {
  try {
    assertSuperAdmin(req.body.currentUser);
    const value = normalizeValue(req.body.value);
    const type = normalizeParamType(req.params.type);
    const existing = await getParamValues(type);
    if (existing.includes(value)) throw new Error('參數已存在');
    await pool.query(
      'INSERT INTO params (category, value, sort_order) VALUES ($1, $2, $3)',
      [type, value, existing.length + 1]
    );
    res.json({ success: true, message: '已新增參數' });
  } catch (err) {
    next(err);
  }
});

app.put('/params/:type', async (req, res, next) => {
  try {
    assertSuperAdmin(req.body.currentUser);
    const type = normalizeParamType(req.params.type);
    const oldValue = normalizeValue(req.body.oldValue);
    const newValue = normalizeValue(req.body.newValue);
    const result = await pool.query(
      'UPDATE params SET value = $1, updated_at = now() WHERE category = $2 AND value = $3',
      [newValue, type, oldValue]
    );
    if (!result.rowCount) throw new Error('找不到要修改的參數');
    res.json({ success: true, message: '已更新參數' });
  } catch (err) {
    next(err);
  }
});

app.delete('/params/:type/:value', async (req, res, next) => {
  try {
    assertSuperAdmin(parseUser(req));
    const type = normalizeParamType(req.params.type);
    const value = decodeURIComponent(req.params.value);
    const result = await pool.query('DELETE FROM params WHERE category = $1 AND value = $2', [type, value]);
    if (!result.rowCount) throw new Error('找不到要刪除的參數');
    res.json({ success: true, message: '已刪除參數' });
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).json({ error: err.message || String(err) });
});

async function getParams() {
  const params = {};
  Object.keys(PARAM_CATEGORIES).forEach(key => { params[key] = []; });
  const { rows } = await pool.query('SELECT category, value FROM params ORDER BY category, sort_order, value');
  rows.forEach(row => {
    if (!params[row.category]) params[row.category] = [];
    params[row.category].push(row.value);
  });
  params.chargeOptions = params.chargeOptions.length ? params.chargeOptions : ['是', '否'];
  params.departments = params.departments.length ? params.departments : getDefaultDepartments();
  return params;
}

async function getParamValues(type) {
  const category = normalizeParamType(type);
  const { rows } = await pool.query(
    'SELECT value FROM params WHERE category = $1 ORDER BY sort_order, value',
    [category]
  );
  return rows.map(row => row.value);
}

async function getAccounts() {
  const { rows } = await pool.query(`
    SELECT
      a.staff_id,
      a.email,
      a.name,
      a.position,
      a.role,
      array_remove(array_agg(DISTINCT ar.role), NULL) AS roles,
      array_remove(array_agg(DISTINCT apcp.church_id), NULL) AS pastoral_church_ids
    FROM accounts a
    LEFT JOIN account_roles ar ON ar.staff_id = a.staff_id
    LEFT JOIN account_pastoral_church_permissions apcp ON apcp.staff_id = a.staff_id
    GROUP BY a.staff_id, a.email, a.name, a.position, a.role
    ORDER BY
      CASE WHEN a.staff_id ~ '^[0-9]+$' THEN a.staff_id::int END NULLS LAST,
      a.staff_id
  `);
  return rows.map(row => ({
    staffId: row.staff_id,
    email: row.email,
    name: row.name,
    position: row.position,
    role: row.role,
    roles: normalizeRoles(row.roles, row.role),
    pastoralChurchIds: (row.pastoral_church_ids || []).map(Number).filter(Number.isFinite)
  }));
}

async function savePastoralChurchPermissions(staffId, churchIds) {
  const exists = await pool.query('SELECT staff_id FROM accounts WHERE staff_id = $1', [staffId]);
  if (!exists.rows[0]) throw new Error('找不到使用者資料');

  const normalizedChurchIds = [...new Set(churchIds.map(id => Number(id)).filter(id => Number.isInteger(id)))];
  if (normalizedChurchIds.length) {
    const found = await pool.query('SELECT id FROM churches WHERE id = ANY($1::int[])', [normalizedChurchIds]);
    if (found.rows.length !== normalizedChurchIds.length) throw new Error('包含不存在的會堂資料');
  }

  await tx(async client => {
    await client.query('DELETE FROM account_pastoral_church_permissions WHERE staff_id = $1', [staffId]);
    for (const churchId of normalizedChurchIds) {
      await client.query(
        `INSERT INTO account_pastoral_church_permissions (staff_id, church_id)
         VALUES ($1, $2)
         ON CONFLICT (staff_id, church_id) DO NOTHING`,
        [staffId, churchId]
      );
    }
  });
}

async function getAccountRoles(staffId, fallbackRole) {
  const { rows } = await pool.query(
    'SELECT role FROM account_roles WHERE staff_id = $1 ORDER BY role',
    [staffId]
  );
  return normalizeRoles(rows.map(row => row.role), fallbackRole);
}

async function getFeaturePermissions() {
  const { rows } = await pool.query(
    `SELECT role, feature_key, access_level
     FROM role_feature_permissions
     ORDER BY role, feature_key`
  );
  return rows.map(row => ({
    role: row.role,
    featureKey: row.feature_key,
    accessLevel: row.access_level
  }));
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
  return access;
}

async function getFeatureAccess(user, featureKey) {
  if (!SYSTEM_FEATURES.includes(featureKey)) return 'none';
  if (user && user.featurePermissions && user.featurePermissions[featureKey]) {
    return user.featurePermissions[featureKey];
  }
  const access = await getEffectiveFeaturePermissions(user);
  return access[featureKey] || 'none';
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

async function saveFeaturePermissions(permissions) {
  return tx(async client => {
    await client.query('DELETE FROM role_feature_permissions');
    for (const item of permissions) {
      const role = normalizeValue(item.role);
      const featureKey = normalizeValue(item.featureKey);
      const accessLevel = String(item.accessLevel || 'none').trim();
      if (!SYSTEM_FEATURES.includes(featureKey)) throw new Error(`未知的系統功能：${featureKey}`);
      if (!['none', 'read', 'edit'].includes(accessLevel)) throw new Error('未知的權限層級');
      await client.query(
        `INSERT INTO role_feature_permissions (role, feature_key, access_level)
         VALUES ($1, $2, $3)
         ON CONFLICT (role, feature_key) DO UPDATE SET access_level = EXCLUDED.access_level, updated_at = now()`,
        [role, featureKey, accessLevel]
      );
    }
  });
}

function normalizeRoles(roles, fallbackRole) {
  const values = Array.isArray(roles) ? roles : [];
  const normalized = values
    .concat(fallbackRole || [])
    .map(role => String(role || '').trim())
    .filter(Boolean);
  return [...new Set(normalized)];
}

function hasRole(user, role) {
  const roles = normalizeRoles(user && user.roles, user && user.role);
  return roles.includes(role);
}

function hasAnyRole(user, rolesToCheck) {
  const roles = normalizeRoles(user && user.roles, user && user.role);
  return rolesToCheck.some(role => roles.includes(role));
}

async function getProjectDetail(projectId, currentUser) {
  await assertFeatureReadable(currentUser, 'project');
  const project = await getProject(projectId);
  if (!project) throw new Error('找不到此專案資料');
  const access = await assertProjectAccess(projectId, currentUser);
  const [people, income, budget, meetings, permissions] = await Promise.all([
    getChildRows('project_people', projectId),
    getChildRows('project_income', projectId),
    getChildRows('project_budget', projectId),
    getMeetings(projectId),
    getPermissions(projectId)
  ]);
  return {
    project: toProjectDetail(project),
    people: people.map(toPeopleRow),
    income: income.map(toIncomeRow),
    budget: budget.map(toBudgetRow),
    meetings,
    projectPermissions: permissions.map(toPermissionRow),
    projectAccess: hasAnyRole(currentUser, ['管理員', '超級管理者']) ? '完全控制' : access,
    permission: await getProjectPermission(project, currentUser, access)
  };
}

async function saveProject(payload) {
  const { currentUser, project, people = [], income = [], budget = [] } = payload;
  assertDesktop(currentUser);

  return tx(async client => {
    let projectId = project['計畫編號'];
    let isNew = false;
    let oldProject = null;

    if (!projectId) {
      projectId = await generateProjectId(client);
      project['計畫編號'] = projectId;
      isNew = true;
    } else {
      oldProject = (await client.query('SELECT * FROM projects WHERE project_id = $1', [projectId])).rows[0];
      if (!oldProject) throw new Error('找不到專案資料');
      await validateEditPermission(oldProject, project, currentUser);
    }

    const totalIncome = income.reduce((sum, r) => sum + Number(r['小計'] || 0), 0);
    const totalBudget = budget.reduce((sum, r) => sum + Number(r['小計'] || 0), 0);

    await client.query(
      `INSERT INTO projects (
        project_id, login_user, project_name, project_type, start_date, end_date, units, content,
        is_charged, total_income, total_budget, difference_method, status, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
      ON CONFLICT (project_id) DO UPDATE SET
        login_user = EXCLUDED.login_user,
        project_name = EXCLUDED.project_name,
        project_type = EXCLUDED.project_type,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        units = EXCLUDED.units,
        content = EXCLUDED.content,
        is_charged = EXCLUDED.is_charged,
        total_income = EXCLUDED.total_income,
        total_budget = EXCLUDED.total_budget,
        difference_method = EXCLUDED.difference_method,
        status = EXCLUDED.status,
        updated_at = now()`,
      [
        projectId,
        project['專案登入人'],
        project['專案名稱'],
        project['專案類型'],
        project['專案執行開始時間'] || null,
        project['專案執行結束時間'] || null,
        splitCsv(project['專案執行單位']),
        project['專案內容'],
        project['專案是否收費'] || '否',
        totalIncome,
        totalBudget,
        project['收支差額處理方式'],
        project['專案狀態'] || '規劃中'
      ]
    );

    if (isNew) await createDefaultProjectPermission(client, projectId, project['專案登入人']);
    await replaceRows(client, 'project_people', projectId, people, insertPeopleRow);
    await replaceRows(client, 'project_income', projectId, income, insertIncomeRow);
    await replaceRows(client, 'project_budget', projectId, budget, insertBudgetRow);
    return { success: true, projectId, message: '專案資料已儲存' };
  });
}

async function getPurchaseDetail(purchaseId) {
  const { rows } = await pool.query('SELECT * FROM purchases WHERE purchase_id = $1', [purchaseId]);
  const purchase = rows[0];
  if (!purchase) throw new Error('找不到採購資料');

  const [items, advances, advanceItems, expenseProofs, expenseProofItems, payments, paymentItems] = await Promise.all([
    getPurchaseChildRows('purchase_items', 'purchase_id', purchaseId),
    getPurchaseChildRows('purchase_advances', 'purchase_id', purchaseId),
    getAdvanceItems(purchaseId),
    getPurchaseChildRows('purchase_expense_proofs', 'purchase_id', purchaseId),
    getExpenseProofItems(purchaseId),
    getPurchaseChildRows('purchase_payment_requests', 'purchase_id', purchaseId),
    getPaymentItems(purchaseId)
  ]);

  return {
    purchase: toPurchaseDetail(purchase),
    items: items.map(toPurchaseItem),
    advances: advances.map(row => toAdvance(row, advanceItems.filter(item => item.advance_id === row.advance_id))),
    expenseProofs: expenseProofs.map(row => toExpenseProof(row, expenseProofItems.filter(item => item.proof_id === row.proof_id))),
    payments: payments.map(row => toPaymentRequest(row, paymentItems.filter(item => item.payment_id === row.payment_id)))
  };
}

async function savePurchase(payload) {
  const { currentUser, purchase, items = [] } = payload;
  assertDesktop(currentUser);
  if (!purchase['採購摘要']) throw new Error('請填寫採購摘要');
  if (!items.length) throw new Error('請至少新增一筆請購詳情');

  return tx(async client => {
    let purchaseId = purchase['採購編號'];
    const isNew = !purchaseId;
    if (!purchaseId) purchaseId = await generateSerialId(client, 'purchases', 'purchase_id', 'P');

    const totalAmount = items.reduce((sum, row) => sum + Number(row['總價'] || 0), 0);
    await client.query(
      `INSERT INTO purchases (
        purchase_id, hall, department, applicant, request_date, summary, reason, status, total_amount, created_by, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
      ON CONFLICT (purchase_id) DO UPDATE SET
        hall = EXCLUDED.hall,
        department = EXCLUDED.department,
        applicant = EXCLUDED.applicant,
        request_date = EXCLUDED.request_date,
        summary = EXCLUDED.summary,
        reason = EXCLUDED.reason,
        status = EXCLUDED.status,
        total_amount = EXCLUDED.total_amount,
        updated_at = now()`,
      [
        purchaseId,
        purchase['會堂'] || '',
        purchase['部門'] || '',
        purchase['申請人'] || currentUser.name || '',
        purchase['申請日期'] || new Date(),
        purchase['採購摘要'],
        purchase['申請詳細原因'] || '',
        purchase['請購狀態'] || '申請中',
        totalAmount,
        currentUser.name || ''
      ]
    );

    await replacePurchaseRows(client, 'purchase_items', 'purchase_id', purchaseId, items, insertPurchaseItem);
    return { success: true, purchaseId, message: isNew ? '採購申請已建立' : '採購申請已儲存' };
  });
}

async function savePurchaseAdvance(purchaseId, payload) {
  const { currentUser, advance, items = [] } = payload;
  assertDesktop(currentUser);
  await assertPurchaseEditable(purchaseId);
  if (!items.length) throw new Error('請至少新增一筆預借詳情');
  if (needsBankInfo(advance['支付方式']) && !advance['帳號']) throw new Error('非現金交付時請填寫匯款資料');

  return tx(async client => {
    const advanceId = await generateSerialId(client, 'purchase_advances', 'advance_id', 'A');
    const totalAmount = items.reduce((sum, row) => sum + Number(row['金額'] || 0), 0);
    await client.query(
      `INSERT INTO purchase_advances (
        advance_id, purchase_id, hall, borrower, request_date, total_amount, expected_clear_date,
        payment_method, bank, branch, account_name, account_no
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        advanceId,
        purchaseId,
        advance['請款會堂'] || '',
        advance['借款人'] || currentUser.name || '',
        advance['申請日期'] || new Date(),
        totalAmount,
        advance['預計核銷日期'] || null,
        advance['支付方式'] || '',
        advance['匯款銀行'] || '',
        advance['分行'] || '',
        advance['帳戶名稱'] || '',
        advance['帳號'] || ''
      ]
    );
    await replacePurchaseRows(client, 'purchase_advance_items', 'advance_id', advanceId, items, insertAdvanceItem);
    return { success: true, advanceId, message: '預借申請已建立' };
  });
}

async function saveExpenseProof(purchaseId, payload) {
  const { currentUser, proof, items = [] } = payload;
  assertDesktop(currentUser);
  await assertPurchaseEditable(purchaseId);
  if (!items.length) throw new Error('請至少新增一筆支出證明詳情');

  return tx(async client => {
    const proofId = await generateSerialId(client, 'purchase_expense_proofs', 'proof_id', 'E');
    const paidAmount = items.reduce((sum, row) => sum + Number(row['費用'] || 0), 0);
    await client.query(
      `INSERT INTO purchase_expense_proofs (
        proof_id, purchase_id, hall, request_date, paid_amount, no_receipt_reason,
        recipient_name, recipient_identity_no, recipient_address
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        proofId,
        purchaseId,
        proof['請款會堂'] || '',
        proof['申請日期'] || new Date(),
        Number(proof['實付金額'] || paidAmount),
        proof['不能取得單據原因'] || '',
        proof['姓名'] || '',
        proof['身分證字號'] || '',
        proof['地址'] || ''
      ]
    );
    await replacePurchaseRows(client, 'purchase_expense_proof_items', 'proof_id', proofId, items, insertExpenseProofItem);
    return { success: true, proofId, message: '支出證明申請已建立' };
  });
}

async function savePaymentRequest(purchaseId, payload) {
  const { currentUser, payment, items = [] } = payload;
  assertDesktop(currentUser);
  await assertPurchaseEditable(purchaseId);
  if (!items.length) throw new Error('請至少新增一筆請款詳情');
  if (payment['支付方式'] === '匯款交付墊款人' && !payment['帳號']) throw new Error('匯款交付墊款人時請填寫匯款資料');

  return tx(async client => {
    const paymentId = await generateSerialId(client, 'purchase_payment_requests', 'payment_id', 'R');
    const totalAmount = items.reduce((sum, row) => sum + Number(row['總價'] || 0), 0);
    await client.query(
      `INSERT INTO purchase_payment_requests (
        payment_id, purchase_id, hall, claimant, request_date, total_amount, has_advance,
        payment_method, advance_id, advance_amount, offset_amount, behalf_amount, return_amount,
        bank, branch, account_name, account_no
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        paymentId,
        purchaseId,
        payment['請款會堂'] || '',
        payment['請款人'] || currentUser.name || '',
        payment['申請日期'] || new Date(),
        totalAmount,
        String(payment['是否有預借'] || '') === '是',
        payment['支付方式'] || '',
        payment['預借編號'] || null,
        Number(payment['前已預借金額'] || 0),
        Number(payment['轉正'] || 0),
        Number(payment['代支'] || 0),
        Number(payment['繳回'] || 0),
        payment['匯款銀行'] || '',
        payment['分行'] || '',
        payment['帳戶名稱'] || '',
        payment['帳號'] || ''
      ]
    );
    await replacePurchaseRows(client, 'purchase_payment_items', 'payment_id', paymentId, items, insertPaymentItem);
    return { success: true, paymentId, message: '請款申請已建立' };
  });
}

async function getProject(projectId) {
  const { rows } = await pool.query('SELECT * FROM projects WHERE project_id = $1', [projectId]);
  return rows[0];
}

async function assertProjectAccess(projectId, currentUser) {
  if (hasAnyRole(currentUser, ['管理員', '超級管理者'])) return '完全控制';
  if (!currentUser || !currentUser.name) throw new Error('缺少登入者資訊');
  if (currentUser.staffId) {
    const { rows } = await pool.query(
      'SELECT permission FROM project_permissions WHERE project_id = $1 AND staff_id = $2',
      [projectId, String(currentUser.staffId)]
    );
    if (rows[0]) return rows[0].permission;
  }
  const { rows } = await pool.query(
    'SELECT permission FROM project_permissions WHERE project_id = $1 AND name = $2',
    [projectId, currentUser.name]
  );
  if (!rows[0]) throw new Error('您未被賦予此專案權限');
  return rows[0].permission;
}

async function assertFullControl(projectId, currentUser) {
  assertDesktop(currentUser);
  if (hasAnyRole(currentUser, ['管理員', '超級管理者'])) return true;
  const access = await assertProjectAccess(projectId, currentUser);
  if (access !== '完全控制') throw new Error('您沒有此專案的完全控制權限');
  return true;
}

function assertDesktop(currentUser) {
  if (!currentUser || currentUser.deviceType === 'mobile') {
    throw new Error('手機版僅提供瀏覽功能，請使用電腦操作');
  }
}

function assertSuperAdmin(currentUser) {
  assertDesktop(currentUser);
  if (!currentUser.isSuperAdmin && !hasRole(currentUser, '超級管理者')) {
    throw new Error('只有超級管理者可以操作系統層級設定');
  }
}

async function getProjectPermission(project, user, projectAccess) {
  const access = hasAnyRole(user, ['管理員', '超級管理者']) ? '完全控制' : projectAccess;
  if (user.deviceType === 'mobile') {
    return { canEdit: false, canChangeStatus: false, canViewFinance: access !== '不含收支瀏覽', access, statusOptions: [project.status], readonlyReason: '手機版僅提供瀏覽模式' };
  }
  if (access === '完全控制') {
    const params = await getParams();
    return { canEdit: true, canChangeStatus: true, canViewFinance: true, access, statusOptions: params.projectStatus };
  }
  if (access === '完全瀏覽') {
    return { canEdit: false, canChangeStatus: false, canViewFinance: true, access, statusOptions: [project.status], readonlyReason: '您只有瀏覽權限' };
  }
  return { canEdit: false, canChangeStatus: false, canViewFinance: false, access, statusOptions: [project.status], readonlyReason: '您沒有編輯權限' };
}

async function validateEditPermission(oldProject, newProject, user) {
  await assertFullControl(oldProject.project_id, user);
  return true;
}

async function generateProjectId(client = pool) {
  const now = new Date();
  const prefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const { rows } = await client.query(
    `SELECT project_id FROM projects WHERE project_id LIKE $1 ORDER BY project_id DESC LIMIT 1`,
    [`${prefix}%`]
  );
  const next = rows[0] ? Number(rows[0].project_id.slice(6, 8)) + 1 : 1;
  if (next > 99) throw new Error('本月份專案流水碼已超過 99 筆');
  return `${prefix}${String(next).padStart(2, '0')}`;
}

async function generateMeetingId() {
  const now = new Date();
  const prefix = `M${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const { rows } = await pool.query(
    'SELECT meeting_id FROM meetings WHERE meeting_id LIKE $1 ORDER BY meeting_id DESC LIMIT 1',
    [`${prefix}%`]
  );
  const next = rows[0] ? Number(rows[0].meeting_id.slice(-4)) + 1 : 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

async function createDefaultProjectPermission(client, projectId, loginUserName) {
  const { rows } = await client.query('SELECT staff_id, name FROM accounts WHERE name = $1', [loginUserName]);
  const account = rows[0];
  if (!account) return;
  await client.query(
    'INSERT INTO project_permissions (project_id, staff_id, name, permission) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
    [projectId, account.staff_id, account.name, '完全控制']
  );
}

async function getChildRows(table, projectId) {
  const { rows } = await pool.query(`SELECT * FROM ${table} WHERE project_id = $1 ORDER BY sort_order, id`, [projectId]);
  return rows;
}

async function getPermissions(projectId) {
  const { rows } = await pool.query(
    `SELECT pp.*, a.position
     FROM project_permissions pp
     LEFT JOIN accounts a ON a.staff_id = pp.staff_id
     WHERE pp.project_id = $1
     ORDER BY pp.name`,
    [projectId]
  );
  return rows;
}

async function getMeetings(projectId) {
  const { rows } = await pool.query('SELECT * FROM meetings WHERE project_id = $1 ORDER BY meeting_time', [projectId]);
  return rows.map(toMeetingRow);
}

async function replaceRows(client, table, projectId, rows, insertFn) {
  await client.query(`DELETE FROM ${table} WHERE project_id = $1`, [projectId]);
  for (let i = 0; i < rows.length; i += 1) await insertFn(client, projectId, rows[i], i + 1);
}

function insertPeopleRow(client, projectId, row, sortOrder) {
  return client.query(
    'INSERT INTO project_people (project_id, duty, person, item, note, sort_order) VALUES ($1,$2,$3,$4,$5,$6)',
    [projectId, row['職責'] || '', row['主責人'] || '', row['主責項目'] || '', row['備註'] || '', sortOrder]
  );
}

function insertIncomeRow(client, projectId, row, sortOrder) {
  return client.query(
    'INSERT INTO project_income (project_id, unit, item, quantity, unit_price, subtotal, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [projectId, row['會堂'] || '', row['收入項目'] || '', Number(row['數量'] || 0), Number(row['單價'] || 0), Number(row['小計'] || 0), sortOrder]
  );
}

function insertBudgetRow(client, projectId, row, sortOrder) {
  return client.query(
    'INSERT INTO project_budget (project_id, unit, item, quantity, unit_price, subtotal, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [projectId, row['會堂'] || '', row['支出項目'] || '', Number(row['數量'] || 0), Number(row['單價'] || 0), Number(row['小計'] || 0), sortOrder]
  );
}

function toProjectListItem(row) {
  return {
    projectId: row.project_id,
    loginUser: row.login_user,
    projectName: row.project_name,
    projectType: row.project_type,
    startDate: formatDate(row.start_date),
    endDate: formatDate(row.end_date),
    unit: (row.units || []).join(','),
    status: row.status
  };
}

function toProjectDetail(row) {
  return {
    '計畫編號': row.project_id,
    '專案登入人': row.login_user,
    '專案名稱': row.project_name,
    '專案類型': row.project_type,
    '專案執行開始時間': formatDate(row.start_date),
    '專案執行結束時間': formatDate(row.end_date),
    '專案執行單位': (row.units || []).join(','),
    '專案內容': row.content,
    '專案是否收費': row.is_charged,
    '專案總收入': Number(row.total_income || 0),
    '專案總支出': Number(row.total_budget || 0),
    '收支差額處理方式': row.difference_method,
    '專案狀態': row.status
  };
}

function toPeopleRow(row) {
  return { '職責': row.duty, '主責人': row.person, '主責項目': row.item, '備註': row.note };
}
function toIncomeRow(row) {
  return { '會堂': row.unit, '收入項目': row.item, '數量': Number(row.quantity), '單價': Number(row.unit_price), '小計': Number(row.subtotal) };
}
function toBudgetRow(row) {
  return { '會堂': row.unit, '支出項目': row.item, '數量': Number(row.quantity), '單價': Number(row.unit_price), '小計': Number(row.subtotal) };
}
function toPermissionRow(row) {
  return { '人員序號': row.staff_id, '姓名': [row.name, row.position].filter(Boolean).join(' '), '權限': row.permission };
}
function toMeetingRow(row) {
  return {
    '會議編號': row.meeting_id,
    '計畫編號': row.project_id,
    '會議時間': formatDateTime(row.meeting_time),
    '會議主題': row.topic,
    '討論議題': row.agenda,
    '會議決議': row.decision,
    '與會者': (row.attendees || []).join(','),
    '會議狀態': row.status
  };
}

function toPurchaseListItem(row) {
  return {
    purchaseId: row.purchase_id,
    summary: row.summary,
    status: row.status,
    totalAmount: Number(row.total_amount || 0)
  };
}

function toPurchaseDetail(row) {
  return {
    '採購編號': row.purchase_id,
    '會堂': row.hall,
    '部門': row.department,
    '申請人': row.applicant,
    '申請日期': formatDate(row.request_date),
    '採購摘要': row.summary,
    '申請詳細原因': row.reason,
    '請購狀態': row.status,
    '總計金額': Number(row.total_amount || 0)
  };
}

function toPurchaseItem(row) {
  return {
    '項目': row.item,
    '數量': Number(row.quantity || 0),
    '單價': Number(row.unit_price || 0),
    '總價': Number(row.subtotal || 0),
    '備註': row.note
  };
}

function toAdvance(row, items) {
  return {
    '預借編號': row.advance_id,
    '請購編號': row.purchase_id,
    '請款會堂': row.hall,
    '借款人': row.borrower,
    '申請日期': formatDate(row.request_date),
    '預借總金額': Number(row.total_amount || 0),
    '預計核銷日期': formatDate(row.expected_clear_date),
    '支付方式': row.payment_method,
    '匯款銀行': row.bank,
    '分行': row.branch,
    '帳戶名稱': row.account_name,
    '帳號': row.account_no,
    items: items.map(item => ({
      '項次': item.sort_order,
      '事由': item.reason,
      '金額': Number(item.amount || 0),
      '備註/說明': item.note
    }))
  };
}

function toExpenseProof(row, items) {
  return {
    '支出證明編號': row.proof_id,
    '請購編號': row.purchase_id,
    '請款會堂': row.hall,
    '申請日期': formatDate(row.request_date),
    '實付金額': Number(row.paid_amount || 0),
    '不能取得單據原因': row.no_receipt_reason,
    '姓名': row.recipient_name,
    '身分證字號': row.recipient_identity_no,
    '地址': row.recipient_address,
    items: items.map(item => ({
      '項次': item.sort_order,
      '項目': item.item,
      '費用': Number(item.amount || 0)
    }))
  };
}

function toPaymentRequest(row, items) {
  return {
    '請款編號': row.payment_id,
    '請購編號': row.purchase_id,
    '請款會堂': row.hall,
    '請款人': row.claimant,
    '申請日期': formatDate(row.request_date),
    '請款總金額': Number(row.total_amount || 0),
    '是否有預借': row.has_advance ? '是' : '否',
    '支付方式': row.payment_method,
    '預借編號': row.advance_id,
    '前已預借金額': Number(row.advance_amount || 0),
    '轉正': Number(row.offset_amount || 0),
    '代支': Number(row.behalf_amount || 0),
    '繳回': Number(row.return_amount || 0),
    '匯款銀行': row.bank,
    '分行': row.branch,
    '帳戶名稱': row.account_name,
    '帳號': row.account_no,
    items: items.map(item => ({
      '項目': item.item,
      '數量': Number(item.quantity || 0),
      '單價': Number(item.unit_price || 0),
      '總價': Number(item.subtotal || 0),
      '備註': item.note
    }))
  };
}

function createEmptyProject(currentUser) {
  return {
    project: {
      '計畫編號': '',
      '專案登入人': currentUser.name || '',
      '專案名稱': '',
      '專案類型': '',
      '專案執行開始時間': '',
      '專案執行結束時間': '',
      '專案執行單位': '',
      '專案內容': '',
      '專案是否收費': '否',
      '專案總收入': 0,
      '專案總支出': 0,
      '收支差額處理方式': '',
      '專案狀態': '規劃中'
    },
    people: [],
    income: [],
    budget: [],
    meetings: [],
    projectPermissions: [],
    permission: { canEdit: true, canChangeStatus: false, canViewFinance: true, statusOptions: ['規劃中'] }
  };
}

function createEmptyPurchase(currentUser) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    purchase: {
      '採購編號': '',
      '會堂': '',
      '部門': '',
      '申請人': currentUser.name || '',
      '申請日期': today,
      '採購摘要': '',
      '申請詳細原因': '',
      '請購狀態': '申請中',
      '總計金額': 0
    },
    items: [],
    advances: [],
    expenseProofs: [],
    payments: []
  };
}

async function getPurchaseChildRows(table, column, value) {
  const orderBy = table.endsWith('_items') || table === 'purchase_items'
    ? 'sort_order, id'
    : 'created_at, updated_at';
  const { rows } = await pool.query(`SELECT * FROM ${table} WHERE ${column} = $1 ORDER BY ${orderBy}`, [value]);
  return rows;
}

async function getAdvanceItems(purchaseId) {
  const { rows } = await pool.query(
    `SELECT i.*
     FROM purchase_advance_items i
     JOIN purchase_advances a ON a.advance_id = i.advance_id
     WHERE a.purchase_id = $1
     ORDER BY i.advance_id, i.sort_order, i.id`,
    [purchaseId]
  );
  return rows;
}

async function getExpenseProofItems(purchaseId) {
  const { rows } = await pool.query(
    `SELECT i.*
     FROM purchase_expense_proof_items i
     JOIN purchase_expense_proofs p ON p.proof_id = i.proof_id
     WHERE p.purchase_id = $1
     ORDER BY i.proof_id, i.sort_order, i.id`,
    [purchaseId]
  );
  return rows;
}

async function getPaymentItems(purchaseId) {
  const { rows } = await pool.query(
    `SELECT i.*
     FROM purchase_payment_items i
     JOIN purchase_payment_requests p ON p.payment_id = i.payment_id
     WHERE p.purchase_id = $1
     ORDER BY i.payment_id, i.sort_order, i.id`,
    [purchaseId]
  );
  return rows;
}

async function replacePurchaseRows(client, table, column, value, rows, insertFn) {
  await client.query(`DELETE FROM ${table} WHERE ${column} = $1`, [value]);
  for (let i = 0; i < rows.length; i += 1) await insertFn(client, value, rows[i], i + 1);
}

async function getPastoralOptions(currentUser) {
  const churchAccess = await getPastoralChurchAccess(currentUser);
  const churchWhere = churchAccess.all ? '' : 'WHERE id = ANY($1::int[])';
  const churchValues = churchAccess.all ? [] : [churchAccess.churchIds];
  const groupWhere = churchAccess.all ? '' : 'WHERE g.church_id = ANY($1::int[])';
  const groupValues = churchAccess.all ? [] : [churchAccess.churchIds];

  const [churches, categories, groups] = await Promise.all([
    pool.query(`
      SELECT id, name, church_type
      FROM churches
      ${churchWhere}
      ORDER BY sort_order, id
    `, churchValues),
    pool.query(`
      SELECT code, name
      FROM membership_categories
      ORDER BY sort_order, code
    `),
    pool.query(`
      SELECT
        g.id,
        g.name,
        g.path,
        g.level_no,
        gt.name AS group_type,
        c.name AS church_name,
        count(a.member_id)::int AS member_count
      FROM pastoral_groups g
      LEFT JOIN pastoral_group_types gt ON gt.id = g.group_type_id
      LEFT JOIN churches c ON c.id = g.church_id
      LEFT JOIN pastoral_member_group_assignments a ON a.group_id = g.id AND a.is_current
      ${groupWhere}
      GROUP BY g.id, g.name, g.path, g.level_no, gt.name, c.name, g.sort_order
      ORDER BY g.level_no, g.sort_order, g.name
    `, groupValues)
  ]);

  return {
    churches: churches.rows.map(row => ({ id: row.id, name: row.name, churchType: row.church_type })),
    categories: categories.rows.map(row => ({ code: row.code, name: row.name })),
    groups: groups.rows.map(toPastoralGroupItem)
  };
}

async function getPastoralMembers(query, currentUser) {
  const churchAccess = await getPastoralChurchAccess(currentUser);
  const keyword = String(query.keyword || '').trim().toLowerCase();
  const category = String(query.category || '').trim();
  const churchId = String(query.churchId || '').trim();
  const groupId = String(query.groupId || '').trim();
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 10), 1), 100);
  const offset = (page - 1) * pageSize;
  const where = [];
  const values = [];

  if (!churchAccess.all) {
    if (!churchAccess.churchIds.length) {
      return { rows: [], total: 0, page, pageSize };
    }
    values.push(churchAccess.churchIds);
    where.push(`pm.church_id = ANY($${values.length}::int[])`);
  }

  if (keyword) {
    values.push(`%${keyword}%`);
    where.push(`(
      lower(pm.name) LIKE $${values.length}
      OR lower(coalesce(pc.mobile_phone, '')) LIKE $${values.length}
      OR lower(coalesce(pm.line_user_id, '')) LIKE $${values.length}
      OR lower(coalesce(g.path, '')) LIKE $${values.length}
    )`);
  }
  if (category) {
    values.push(category);
    where.push(`pm.membership_category_code = $${values.length}`);
  }
  if (churchId) {
    values.push(Number(churchId));
    where.push(`pm.church_id = $${values.length}`);
  }
  if (groupId) {
    values.push(Number(groupId));
    where.push(`EXISTS (
      SELECT 1
      FROM pastoral_member_group_assignments ga
      JOIN pastoral_group_closure gc ON gc.descendant_id = ga.group_id
      WHERE ga.member_id = pm.id
        AND ga.is_current
        AND gc.ancestor_id = $${values.length}
    )`);
  }

  const fromSql = `
    FROM pastoral_members pm
    LEFT JOIN churches ch ON ch.id = pm.church_id
    LEFT JOIN membership_categories mc ON mc.code = pm.membership_category_code
    LEFT JOIN pastoral_titles pt ON pt.id = pm.title_id
    LEFT JOIN marital_statuses ms ON ms.id = pm.marital_status_id
    LEFT JOIN pastoral_member_contacts pc ON pc.member_id = pm.id
    LEFT JOIN pastoral_member_addresses addr ON addr.member_id = pm.id AND addr.is_primary
    LEFT JOIN pastoral_member_faith faith ON faith.member_id = pm.id
    LEFT JOIN pastoral_member_group_assignments pga ON pga.member_id = pm.id AND pga.is_current
    LEFT JOIN pastoral_groups g ON g.id = pga.group_id
    LEFT JOIN accounts follow_account ON follow_account.staff_id = pm.followup_staff_id::text
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
  `;

  const countResult = await pool.query(`SELECT count(DISTINCT pm.id)::int AS total ${fromSql}`, values);
  const pageValues = values.slice();
  pageValues.push(pageSize);
  const limitIndex = pageValues.length;
  pageValues.push(offset);
  const offsetIndex = pageValues.length;

  const { rows } = await pool.query(
    `SELECT DISTINCT
       pm.id,
       pm.name,
       pm.gender,
       pm.created_date,
       pm.birthday,
       pm.light_status,
       pm.line_user_id,
       ch.name AS church_name,
       mc.name AS category_name,
       pt.name AS title_name,
       ms.name AS marital_status_name,
       pc.mobile_phone,
       addr.address_line,
       addr.city,
       addr.district,
       faith.is_christian,
       faith.accepted_christ,
       pm.baptized_date,
       follow_account.name AS followup_name,
       follow_account.position AS followup_position,
       g.path AS group_path
     ${fromSql}
     ORDER BY pm.id DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    pageValues
  );

  return { rows: rows.map(toPastoralMemberListItem), total: countResult.rows[0].total, page, pageSize };
}

async function getPastoralMemberDetail(memberId, currentUser) {
  const churchAccess = await getPastoralChurchAccess(currentUser);
  if (!churchAccess.all && !churchAccess.churchIds.length) return { member: null, careRecords: [] };
  const values = [memberId];
  let accessWhere = '';
  if (!churchAccess.all) {
    values.push(churchAccess.churchIds);
    accessWhere = ` AND pm.church_id = ANY($${values.length}::int[])`;
  }

  const { rows } = await pool.query(
    `SELECT
       pm.*,
       ch.name AS church_name,
       ch.church_type,
       mc.name AS category_name,
       pt.name AS title_name,
       pr.name AS profession_name,
       ms.name AS marital_status_name,
       pc.email,
       pc.home_phone,
       pc.office_phone,
       pc.mobile_phone,
       pc.preferred_contact_time,
       pc.referrer_name,
       pc.referrer_phone,
       addr.address_line,
       addr.city,
       addr.district,
       faith.is_christian,
       faith.previous_church_text,
       faith.willing_join_church,
       faith.willing_contact,
       faith.accepted_christ,
       faith.willing_continue_group,
       faith.willing_baptism,
       faith.prayer_request,
       faith.feedback,
       fam.spouse_text,
       fam.father_text,
       fam.mother_text,
       fam.children_text,
       g.path AS group_path
     FROM pastoral_members pm
     LEFT JOIN churches ch ON ch.id = pm.church_id
     LEFT JOIN membership_categories mc ON mc.code = pm.membership_category_code
     LEFT JOIN pastoral_titles pt ON pt.id = pm.title_id
     LEFT JOIN professions pr ON pr.id = pm.profession_id
     LEFT JOIN marital_statuses ms ON ms.id = pm.marital_status_id
     LEFT JOIN pastoral_member_contacts pc ON pc.member_id = pm.id
     LEFT JOIN pastoral_member_addresses addr ON addr.member_id = pm.id AND addr.is_primary
     LEFT JOIN pastoral_member_faith faith ON faith.member_id = pm.id
     LEFT JOIN pastoral_member_family_notes fam ON fam.member_id = pm.id
     LEFT JOIN pastoral_member_group_assignments pga ON pga.member_id = pm.id AND pga.is_current
     LEFT JOIN pastoral_groups g ON g.id = pga.group_id
     WHERE pm.id = $1${accessWhere}`,
    values
  );

  const member = rows[0];
  if (!member) return { member: null, careRecords: [] };

  const careRecords = await pool.query(
    `SELECT cr.id, cr.staff_id, cr.care_at, cr.content, a.name AS staff_name, a.position AS staff_position
     FROM pastoral_care_records cr
     LEFT JOIN accounts a ON a.staff_id = cr.staff_id::text
     WHERE cr.member_id = $1
     ORDER BY cr.care_at DESC NULLS LAST, cr.id DESC
     LIMIT 20`,
    [memberId]
  );

  return {
    member: toPastoralMemberDetail(member),
    careRecords: careRecords.rows.map(toPastoralCareRecord)
  };
}

function insertPurchaseItem(client, purchaseId, row, sortOrder) {
  return client.query(
    'INSERT INTO purchase_items (purchase_id, item, quantity, unit_price, subtotal, note, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [purchaseId, row['項目'] || '', Number(row['數量'] || 0), Number(row['單價'] || 0), Number(row['總價'] || 0), row['備註'] || '', sortOrder]
  );
}

function insertAdvanceItem(client, advanceId, row, sortOrder) {
  return client.query(
    'INSERT INTO purchase_advance_items (advance_id, reason, amount, note, sort_order) VALUES ($1,$2,$3,$4,$5)',
    [advanceId, row['事由'] || '', Number(row['金額'] || 0), row['備註/說明'] || '', sortOrder]
  );
}

function insertExpenseProofItem(client, proofId, row, sortOrder) {
  return client.query(
    'INSERT INTO purchase_expense_proof_items (proof_id, item, amount, sort_order) VALUES ($1,$2,$3,$4)',
    [proofId, row['項目'] || '', Number(row['費用'] || 0), sortOrder]
  );
}

function insertPaymentItem(client, paymentId, row, sortOrder) {
  return client.query(
    'INSERT INTO purchase_payment_items (payment_id, item, quantity, unit_price, subtotal, note, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [paymentId, row['項目'] || '', Number(row['數量'] || 0), Number(row['單價'] || 0), Number(row['總價'] || 0), row['備註'] || '', sortOrder]
  );
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

async function saveAsset(asset) {
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
        purchase_price, purchase_date, location_id, vendor, status, note, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
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
        asset.note || null
      ]
    );

    return { success: true, assetId, message: isNew ? '資產已建立' : '資產已儲存' };
  });
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

function toPastoralGroupItem(row) {
  return {
    groupId: row.id,
    name: row.name,
    path: row.path,
    levelNo: row.level_no,
    groupType: row.group_type,
    churchName: row.church_name,
    memberCount: row.member_count || 0
  };
}

function toPastoralMemberListItem(row) {
  return {
    memberId: row.id,
    name: row.name,
    gender: formatGender(row.gender),
    createdDate: formatDate(row.created_date),
    birthday: formatDate(row.birthday),
    churchName: row.church_name || '',
    categoryName: row.category_name || '',
    titleName: row.title_name || '',
    maritalStatusName: row.marital_status_name || '',
    mobilePhone: row.mobile_phone || '',
    address: [row.city, row.district, row.address_line].filter(Boolean).join(' '),
    groupPath: row.group_path || '',
    lightStatus: formatLightStatus(row.light_status),
    faithStatus: formatFaithStatus(row),
    followupName: [row.followup_name, row.followup_position].filter(Boolean).join(' '),
    communityText: row.group_path || '無社區資料',
    lineBound: Boolean(row.line_user_id)
  };
}

function toPastoralMemberDetail(row) {
  return {
    memberId: row.id,
    name: row.name,
    gender: formatGender(row.gender),
    birthday: formatDate(row.birthday),
    churchName: row.church_name || '',
    churchType: row.church_type || '',
    categoryName: row.category_name || '',
    titleName: row.title_name || '',
    professionName: row.profession_name || '',
    professionNote: row.profession_note || '',
    maritalStatusName: row.marital_status_name || '',
    maritalNote: row.marital_note || '',
    sourceText: row.source_text || '',
    groupPath: row.group_path || '',
    mobilePhone: row.mobile_phone || '',
    homePhone: row.home_phone || '',
    officePhone: row.office_phone || '',
    email: row.email || '',
    preferredContactTime: row.preferred_contact_time || '',
    address: [row.city, row.district, row.address_line].filter(Boolean).join(' '),
    referrerName: row.referrer_name || '',
    referrerPhone: row.referrer_phone || '',
    lineDisplayId: row.line_display_id || '',
    lineBound: Boolean(row.line_user_id),
    lightStatus: formatLightStatus(row.light_status),
    isChristian: formatBoolean(row.is_christian),
    previousChurchText: row.previous_church_text || '',
    willingJoinChurch: formatBoolean(row.willing_join_church),
    willingContact: formatBoolean(row.willing_contact),
    acceptedChrist: formatBoolean(row.accepted_christ),
    willingContinueGroup: formatBoolean(row.willing_continue_group),
    willingBaptism: formatBoolean(row.willing_baptism),
    baptizedDate: formatDate(row.baptized_date),
    prayerRequest: row.prayer_request || '',
    feedback: row.feedback || '',
    spouseText: row.spouse_text || '',
    fatherText: row.father_text || '',
    motherText: row.mother_text || '',
    childrenText: row.children_text || '',
    note: row.note || ''
  };
}

function toPastoralCareRecord(row) {
  return {
    recordId: row.id,
    careAt: formatDateTime(row.care_at),
    staffName: [row.staff_name, row.staff_position].filter(Boolean).join(' '),
    content: row.content || ''
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

function assertPastoralReadable(user) {
  return assertFeatureReadable(user, 'pastoral');
}

async function getPastoralChurchAccess(user) {
  if (hasAnyRole(user, ['管理員', '超級管理者'])) {
    return { all: true, churchIds: [] };
  }
  const staffId = user && user.staffId ? String(user.staffId) : '';
  if (!staffId) return { all: false, churchIds: [] };
  const { rows } = await pool.query(
    'SELECT church_id FROM account_pastoral_church_permissions WHERE staff_id = $1 ORDER BY church_id',
    [staffId]
  );
  return { all: false, churchIds: rows.map(row => Number(row.church_id)).filter(Number.isFinite) };
}

async function recordUsage(user, featureKey, action = 'open', metadata = {}) {
  if (!user || !user.staffId) return;
  if (!SYSTEM_FEATURES.includes(featureKey)) return;
  await pool.query(
    `INSERT INTO system_usage_logs (staff_id, feature_key, action, metadata)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [
      String(user.staffId),
      featureKey,
      String(action || 'open').slice(0, 50),
      JSON.stringify(metadata && typeof metadata === 'object' ? metadata : {})
    ]
  );
}

async function getFeatureUsageSummary(staffId) {
  if (!staffId) return {};
  const { rows } = await pool.query(
    `SELECT feature_key, count(*)::int AS count, max(created_at) AS last_used_at
     FROM system_usage_logs
     WHERE staff_id = $1
       AND action = 'open'
       AND created_at >= now() - interval '180 days'
     GROUP BY feature_key`,
    [String(staffId)]
  );
  return rows.reduce((acc, row) => {
    acc[row.feature_key] = {
      count: row.count,
      lastUsedAt: row.last_used_at
    };
    return acc;
  }, {});
}

function formatGender(value) {
  if (value === 1) return '男';
  if (value === 0) return '女';
  return '';
}

function formatBoolean(value) {
  if (value === true) return '是';
  if (value === false) return '否';
  return '';
}

function formatLightStatus(value) {
  const map = {
    0: '灰燈',
    1: '綠燈',
    2: '黃燈',
    3: '紅燈'
  };
  return map[value] || '';
}

function formatFaithStatus(row) {
  if (row.baptized_date) return '已受洗';
  if (row.accepted_christ === true) return '已決志';
  if (row.is_christian === true) return '基督徒';
  if (row.is_christian === false) return '未信主';
  return '';
}

async function assertPurchaseEditable(purchaseId) {
  const { rows } = await pool.query('SELECT status FROM purchases WHERE purchase_id = $1', [purchaseId]);
  if (!rows[0]) throw new Error('找不到採購資料');
  if (rows[0].status === '已結案') throw new Error('已結案的採購案不可新增申請單');
}

async function generateSerialId(client, table, column, prefix) {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const idPrefix = `${prefix}${datePart}`;
  const { rows } = await client.query(
    `SELECT ${column} AS id FROM ${table} WHERE ${column} LIKE $1 ORDER BY ${column} DESC LIMIT 1`,
    [`${idPrefix}%`]
  );
  const next = rows[0] ? Number(String(rows[0].id).slice(-4)) + 1 : 1;
  return `${idPrefix}${String(next).padStart(4, '0')}`;
}

function needsBankInfo(paymentMethod) {
  return paymentMethod === '已匯款交付借款人' || paymentMethod === '逕行匯款給廠商';
}

function splitCsv(value) {
  if (Array.isArray(value)) return value;
  return String(value || '').split(',').map(v => v.trim()).filter(Boolean);
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toISOString();
}

function normalizeParamType(type) {
  if (!PARAM_CATEGORIES[type]) throw new Error('未知的參數類型');
  return type;
}

function normalizeValue(value) {
  const text = String(value || '').trim();
  if (!text) throw new Error('參數內容不可空白');
  return text;
}

function getDefaultDepartments() {
  return ['秘書部', '牧養部', '教育部', '行政部', '財務部', '資訊部', '技術部', '媒體部'];
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

function parseQueryUser(req) {
  const raw = req.query.currentUser;
  if (!raw) return {};
  try {
    return JSON.parse(Buffer.from(String(raw), 'base64url').toString('utf8'));
  } catch (err) {
    return {};
  }
}

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Project API listening on ${port}`);
});
