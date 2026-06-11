const { pool, tx } = require('../../db');
const { PARAM_CATEGORIES, SYSTEM_FEATURES } = require('../core/catalog');
const { getIdRules, saveIdRule } = require('../../shared/id-rules');

function registerSystemRoutes(app) {
  app.get('/initial-data', async (req, res, next) => {
    try {
      const [params, accounts, featurePermissions] = await Promise.all([
        getParams(),
        getAccounts(),
        getFeaturePermissions()
      ]);
      res.json({ params, accounts, featurePermissions });
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
      const staffId = normalizeRequiredValue(user.staffId, '序號不可空白');
      const email = normalizeRequiredValue(user.email, '電子信箱不可空白').toLowerCase();
      const name = normalizeRequiredValue(user.name, '姓名不可空白');
      const position = String(user.position || '').trim();
      const department = normalizeDepartments(user.departments || user.department).join('、');

      await pool.query(
        `INSERT INTO accounts (staff_id, email, name, position, department, role, updated_at)
         VALUES ($1, $2, $3, $4, $5, '使用者', now())
         ON CONFLICT (staff_id) DO UPDATE SET
           email = EXCLUDED.email,
           name = EXCLUDED.name,
           position = EXCLUDED.position,
           department = EXCLUDED.department,
           updated_at = now()`,
        [staffId, email, name, position, department]
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

  app.get('/system/logs', async (req, res, next) => {
    try {
      assertSuperAdmin(parseUser(req));
      res.json(await getSystemLogs(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.get('/system/id-rules', async (req, res, next) => {
    try {
      assertSuperAdmin(parseUser(req));
      res.json({ rows: await getIdRules() });
    } catch (err) {
      next(err);
    }
  });

  app.put('/system/id-rules/:entityKey', async (req, res, next) => {
    try {
      assertSuperAdmin(req.body.currentUser);
      const rule = await saveIdRule(Object.assign({}, req.body.rule || {}, { entityKey: req.params.entityKey }));
      res.json({ success: true, message: '編碼規則已儲存', rule, rows: await getIdRules() });
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
      const value = normalizeRequiredValue(req.body.value, '參數內容不可空白');
      const type = normalizeParamType(req.params.type);
      const existing = await getParamValues(type);
      if (existing.includes(value)) throw new Error('參數已存在');
      await tx(async client => {
        await client.query(
          'INSERT INTO params (category, value, sort_order) VALUES ($1, $2, $3)',
          [type, value, existing.length + 1]
        );
        if (type === 'departments') await upsertDepartment(client, value, existing.length + 1);
      });
      res.json({ success: true, message: '已新增參數' });
    } catch (err) {
      next(err);
    }
  });

  app.put('/params/:type', async (req, res, next) => {
    try {
      assertSuperAdmin(req.body.currentUser);
      const type = normalizeParamType(req.params.type);
      const oldValue = normalizeRequiredValue(req.body.oldValue, '原參數內容不可空白');
      const newValue = normalizeRequiredValue(req.body.newValue, '新參數內容不可空白');
      await tx(async client => {
        const result = await client.query(
          'UPDATE params SET value = $1, updated_at = now() WHERE category = $2 AND value = $3',
          [newValue, type, oldValue]
        );
        if (!result.rowCount) throw new Error('找不到要修改的參數');
        if (type === 'departments') {
          const sortResult = await client.query(
            'SELECT sort_order FROM params WHERE category = $1 AND value = $2',
            [type, newValue]
          );
          await client.query(
            `UPDATE departments
             SET department_name = $1, sort_order = COALESCE($2, sort_order), is_active = true, updated_at = now()
             WHERE department_name = $3`,
            [newValue, sortResult.rows[0]?.sort_order || 0, oldValue]
          );
          await upsertDepartment(client, newValue, sortResult.rows[0]?.sort_order || 0);
        }
      });
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
      await tx(async client => {
        const result = await client.query('DELETE FROM params WHERE category = $1 AND value = $2', [type, value]);
        if (!result.rowCount) throw new Error('找不到要刪除的參數');
        if (type === 'departments') {
          await client.query('UPDATE departments SET is_active = false, updated_at = now() WHERE department_name = $1', [value]);
        }
      });
      res.json({ success: true, message: '已刪除參數' });
    } catch (err) {
      next(err);
    }
  });
}

async function getParams() {
  const params = {};
  Object.keys(PARAM_CATEGORIES).forEach(key => { params[key] = []; });
  const { rows } = await pool.query('SELECT category, value FROM params ORDER BY category, sort_order, value');
  rows.forEach(row => {
    if (!params[row.category]) params[row.category] = [];
    params[row.category].push(row.value);
  });
  params.chargeOptions = params.chargeOptions.length ? params.chargeOptions : ['是', '否'];
  params.departments = await getDepartmentValues();
  return params;
}

async function getParamValues(type) {
  const category = normalizeParamType(type);
  if (category === 'departments') return getDepartmentValues();
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
      a.department,
      a.role,
      array_remove(array_agg(DISTINCT ar.role), NULL) AS roles,
      array_remove(array_agg(DISTINCT apcp.church_id), NULL) AS pastoral_church_ids
    FROM accounts a
    LEFT JOIN account_roles ar ON ar.staff_id = a.staff_id
    LEFT JOIN account_pastoral_church_permissions apcp ON apcp.staff_id = a.staff_id
    GROUP BY a.staff_id, a.email, a.name, a.position, a.department, a.role
    ORDER BY
      CASE WHEN a.staff_id ~ '^[0-9]+$' THEN a.staff_id::int END NULLS LAST,
      a.staff_id
  `);
  return rows.map(row => ({
    staffId: row.staff_id,
    email: row.email,
    name: row.name,
    position: row.position,
    department: row.department || '',
    departments: normalizeDepartments(row.department),
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

async function saveFeaturePermissions(permissions) {
  return tx(async client => {
    await client.query('DELETE FROM role_feature_permissions');
    for (const item of permissions) {
      const role = normalizeRequiredValue(item.role, '權限身分不可空白');
      const featureKey = normalizeRequiredValue(item.featureKey, '系統功能不可空白');
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

async function getSystemLogs(query) {
  const logType = String(query.type || 'audit').trim();
  const keyword = String(query.keyword || '').trim().toLowerCase();
  const systemKey = String(query.systemKey || '').trim();
  const staffId = String(query.staffId || '').trim();
  const limit = Math.min(Math.max(Number(query.limit || 100), 1), 200);

  if (logType === 'login') return getLoginLogs({ keyword, staffId, limit });
  if (logType === 'usage') return getUsageLogs({ keyword, systemKey, staffId, limit });
  return getAuditLogs({ keyword, systemKey, staffId, limit });
}

async function getAuditLogs({ keyword, systemKey, staffId, limit }) {
  const values = [];
  const where = [];
  if (systemKey) {
    values.push(systemKey);
    where.push(`al.system_key = $${values.length}`);
  }
  if (staffId) {
    values.push(staffId);
    where.push(`al.staff_id = $${values.length}`);
  }
  if (keyword) {
    values.push(`%${keyword}%`);
    where.push(`(
      lower(coalesce(a.name, '')) LIKE $${values.length}
      OR lower(coalesce(al.staff_id, '')) LIKE $${values.length}
      OR lower(al.system_key) LIKE $${values.length}
      OR lower(al.entity_type) LIKE $${values.length}
      OR lower(al.entity_id) LIKE $${values.length}
      OR lower(al.action) LIKE $${values.length}
    )`);
  }
  values.push(limit);
  const { rows } = await pool.query(
    `SELECT al.audit_id AS id, al.created_at, al.staff_id, a.name AS staff_name, a.position,
            al.system_key, al.entity_type, al.entity_id, al.action, al.ip_address, al.user_agent,
            al.metadata
     FROM audit_logs al
     LEFT JOIN accounts a ON a.staff_id = al.staff_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY al.created_at DESC
     LIMIT $${values.length}`,
    values
  );
  return { rows: rows.map(row => toSystemLog('audit', row)) };
}

async function getLoginLogs({ keyword, staffId, limit }) {
  const values = [];
  const where = [];
  if (staffId) {
    values.push(staffId);
    where.push(`le.staff_id = $${values.length}`);
  }
  if (keyword) {
    values.push(`%${keyword}%`);
    where.push(`(
      lower(coalesce(a.name, '')) LIKE $${values.length}
      OR lower(coalesce(le.staff_id, '')) LIKE $${values.length}
      OR lower(le.email) LIKE $${values.length}
      OR lower(le.event_type) LIKE $${values.length}
      OR lower(coalesce(le.device_label, '')) LIKE $${values.length}
      OR lower(coalesce(le.device_type, '')) LIKE $${values.length}
    )`);
  }
  values.push(limit);
  const { rows } = await pool.query(
    `SELECT le.id, le.created_at, le.staff_id, a.name AS staff_name, a.position,
            le.event_type AS action, le.email, le.device_label, le.device_type,
            le.client_ip::text AS ip_address, le.api_ip::text AS api_ip, le.user_agent, le.metadata
     FROM login_events le
     LEFT JOIN accounts a ON a.staff_id = le.staff_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY le.created_at DESC
     LIMIT $${values.length}`,
    values
  );
  return { rows: rows.map(row => toSystemLog('login', row)) };
}

async function getUsageLogs({ keyword, systemKey, staffId, limit }) {
  const values = [];
  const where = [];
  if (systemKey) {
    values.push(systemKey);
    where.push(`sul.feature_key = $${values.length}`);
  }
  if (staffId) {
    values.push(staffId);
    where.push(`sul.staff_id = $${values.length}`);
  }
  if (keyword) {
    values.push(`%${keyword}%`);
    where.push(`(
      lower(coalesce(a.name, '')) LIKE $${values.length}
      OR lower(coalesce(sul.staff_id, '')) LIKE $${values.length}
      OR lower(sul.feature_key) LIKE $${values.length}
      OR lower(sul.action) LIKE $${values.length}
    )`);
  }
  values.push(limit);
  const { rows } = await pool.query(
    `SELECT sul.id, sul.created_at, sul.staff_id, a.name AS staff_name, a.position,
            sul.feature_key AS system_key, sul.action, sul.metadata
     FROM system_usage_logs sul
     LEFT JOIN accounts a ON a.staff_id = sul.staff_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY sul.created_at DESC
     LIMIT $${values.length}`,
    values
  );
  return { rows: rows.map(row => toSystemLog('usage', row)) };
}

function toSystemLog(type, row) {
  return {
    type,
    id: row.id,
    createdAt: row.created_at,
    staffId: row.staff_id || '',
    staffName: formatStaffName(row),
    systemKey: row.system_key || '',
    entityType: row.entity_type || '',
    entityId: row.entity_id || '',
    action: row.action || '',
    ipAddress: row.ip_address || '',
    apiIp: row.api_ip || '',
    userAgent: row.user_agent || '',
    email: row.email || '',
    deviceLabel: row.device_label || '',
    deviceType: row.device_type || '',
    metadata: row.metadata || {}
  };
}

function formatStaffName(row) {
  return [row.staff_name, row.position].filter(Boolean).join(' ');
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

function normalizeDepartments(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(/[、,，]/);
  return [...new Set(values.map(item => String(item || '').trim()).filter(Boolean))];
}

function normalizeParamType(type) {
  if (!PARAM_CATEGORIES[type]) throw new Error('未知的參數類型');
  return type;
}

function normalizeRequiredValue(value, message) {
  const text = String(value || '').trim();
  if (!text) throw new Error(message || '欄位不可空白');
  return text;
}

function getDefaultDepartments() {
  return ['牧養部', '教育部', '媒體部', '敬拜部', '技術部', '資訊部', '行政部', '財務部', '總務部'];
}

async function getDepartmentValues() {
  const { rows } = await pool.query(
    `SELECT department_name
     FROM departments
     WHERE is_active = true
     ORDER BY sort_order, department_name`
  );
  const values = rows.map(row => row.department_name).filter(Boolean);
  return values.length ? values : getDefaultDepartments();
}

async function upsertDepartment(client, departmentName, sortOrder) {
  await client.query(
    `INSERT INTO departments (department_name, sort_order, is_active)
     VALUES ($1, $2, true)
     ON CONFLICT (department_name) DO UPDATE SET
       sort_order = EXCLUDED.sort_order,
       is_active = true,
       updated_at = now()`,
    [departmentName, Number(sortOrder) || 0]
  );
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

module.exports = { registerSystemRoutes };

