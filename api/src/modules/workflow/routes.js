const { pool, tx } = require('../../db');
const { recordAuditLog } = require('../../shared/audit');
const { assertFeatureEditable, assertFeatureReadable, getFeatureAccess } = require('../../shared/permissions');
const { hasRole, normalizeRoles, parseUser } = require('../../shared/users');

const VALID_STATUSES = new Set(['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
const VALID_ACTIONS = new Set(['SUBMIT', 'APPROVE', 'REJECT', 'COMMENT', 'CANCEL']);

function registerWorkflowRoutes(app) {
  app.get('/workflow/definitions', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'workflow');
      res.json(await getDefinitions(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.post('/workflow/definitions', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'workflow');
      res.json(await saveDefinition(req.body.definition || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.get('/workflow/instances', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'workflow');
      res.json(await getInstances(req.query, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.get('/workflow/dashboard', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'workflow');
      res.json(await getDashboard(req.query, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.get('/workflow/instances/:id', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      const detail = await getInstanceDetail(req.params.id);
      await assertInstanceReadable(detail.instance, currentUser);
      res.json(detail);
    } catch (err) {
      next(err);
    }
  });

  app.post('/workflow/instances', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      res.json(await createInstance(req.body.instance || {}, currentUser, req));
    } catch (err) {
      next(err);
    }
  });

  app.post('/workflow/instances/:id/history', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      res.json(await addHistory(req.params.id, req.body.history || {}, currentUser, req));
    } catch (err) {
      next(err);
    }
  });
}

async function getDefinitions(query = {}) {
  const includeInactive = String(query.includeInactive || '') === 'true';
  const { rows } = await pool.query(
    `SELECT id, name, definition_key, owner_role, is_active, metadata, created_at, updated_at
     FROM bpm_definitions
     WHERE ($1::boolean OR is_active = true)
     ORDER BY name`,
    [includeInactive]
  );
  return rows.map(mapDefinition);
}

async function saveDefinition(payload, currentUser) {
  const id = normalizeText(payload.id);
  const name = normalizeRequired(payload.name, '請填寫流程名稱');
  const definitionKey = normalizeKey(payload.key || payload.definitionKey);
  const ownerRole = normalizeRequired(payload.ownerRole || payload.owner_role, '請填寫流程負責角色');
  const isActive = payload.isActive === undefined ? true : Boolean(payload.isActive);
  const metadata = normalizeObject(payload.metadata);

  const { rows } = await pool.query(
    `INSERT INTO bpm_definitions (id, name, definition_key, owner_role, is_active, metadata)
     VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (definition_key) DO UPDATE SET
       name = EXCLUDED.name,
       owner_role = EXCLUDED.owner_role,
       is_active = EXCLUDED.is_active,
       metadata = EXCLUDED.metadata,
       updated_at = now()
     RETURNING id, name, definition_key, owner_role, is_active, metadata, created_at, updated_at`,
    [id || null, name, definitionKey, ownerRole, isActive, JSON.stringify(metadata)]
  );

  await recordAuditLog({
    systemKey: 'workflow',
    entityType: 'bpm_definition',
    entityId: rows[0].id,
    action: id ? 'update_definition' : 'save_definition',
    afterData: mapDefinition(rows[0]),
    currentUser
  });

  return mapDefinition(rows[0]);
}

async function getInstances(query = {}, currentUser = {}) {
  const values = [];
  const where = [];
  const status = normalizeText(query.status);
  const entityType = normalizeText(query.entityType || query.entity_type);
  const keyword = normalizeText(query.keyword).toLowerCase();

  if (status) {
    values.push(status);
    where.push(`i.status = $${values.length}`);
  }
  if (entityType) {
    values.push(entityType);
    where.push(`i.entity_type = $${values.length}`);
  }
  if (keyword) {
    values.push(`%${keyword}%`);
    where.push(`(lower(i.entity_type) LIKE $${values.length}
      OR lower(i.entity_id) LIKE $${values.length}
      OR lower(coalesce(i.entity_code, '')) LIKE $${values.length}
      OR lower(d.name) LIKE $${values.length})`);
  }

  const access = await getFeatureAccess(currentUser, 'workflow');
  if (access !== 'edit') {
    const staffId = normalizeStaffId(currentUser);
    values.push(staffId);
    const staffParam = values.length;
    const roles = normalizeRoles(currentUser && currentUser.roles, currentUser && currentUser.role);
    values.push(roles);
    const rolesParam = values.length;
    where.push(`(
      i.creator_id = $${staffParam}
      OR d.owner_role = ANY($${rolesParam}::text[])
      OR EXISTS (
        SELECT 1 FROM bpm_history h
        WHERE h.instance_id = i.id AND h.approver_id = $${staffParam}
      )
    )`);
  }

  const { rows } = await pool.query(
    `SELECT i.*, d.name AS definition_name, d.definition_key, d.owner_role,
            h.node_key AS latest_node_key, h.node_name AS latest_node_name,
            h.action AS latest_action, h.created_at AS latest_action_at
     FROM bpm_instances i
     JOIN bpm_definitions d ON d.id = i.definition_id
     LEFT JOIN LATERAL (
       SELECT node_key, node_name, action, created_at
       FROM bpm_history
       WHERE instance_id = i.id
       ORDER BY created_at DESC
       LIMIT 1
     ) h ON true
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY i.updated_at DESC
     LIMIT 200`,
    values
  );
  return rows.map(mapInstance);
}

async function getDashboard(query, currentUser) {
  const instances = await getInstances({ ...query, status: query.status || 'IN_PROGRESS' }, currentUser);
  return {
    pending: instances,
    count: instances.length
  };
}

async function getInstanceDetail(instanceId) {
  const { rows } = await pool.query(
    `SELECT i.*, d.name AS definition_name, d.definition_key, d.owner_role
     FROM bpm_instances i
     JOIN bpm_definitions d ON d.id = i.definition_id
     WHERE i.id = $1`,
    [instanceId]
  );
  if (!rows.length) throw new Error('找不到流程實例');

  const history = await pool.query(
    `SELECT id, instance_id, node_key, node_name, approver_id, approver_name, action, comment, file_link_ids, created_at
     FROM bpm_history
     WHERE instance_id = $1
     ORDER BY created_at ASC`,
    [instanceId]
  );
  return {
    instance: mapInstance(rows[0]),
    history: history.rows.map(mapHistory)
  };
}

async function createInstance(payload, currentUser, req) {
  const definition = await resolveDefinition(payload);
  await assertDefinitionWritable(definition, currentUser);

  const entityType = normalizeRequired(payload.entityType || payload.entity_type, '請填寫關聯類型');
  const entityId = normalizeRequired(payload.entityId || payload.entity_id, '請填寫關聯 ID');
  const entityCode = normalizeText(payload.entityCode || payload.entity_code);
  const status = normalizeStatus(payload.status || 'DRAFT');

  return tx(async client => {
    const { rows } = await client.query(
      `INSERT INTO bpm_instances (definition_id, entity_type, entity_id, entity_code, status, creator_id, creator_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        definition.id,
        entityType,
        entityId,
        entityCode || null,
        status,
        normalizeStaffId(currentUser),
        currentUser.name || null
      ]
    );

    await recordAuditLog({
      systemKey: 'workflow',
      entityType: 'bpm_instance',
      entityId: rows[0].id,
      action: 'create_instance',
      afterData: rows[0],
      metadata: { definitionKey: definition.key },
      currentUser,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }, client);

    return mapInstance({
      ...rows[0],
      definition_name: definition.name,
      definition_key: definition.key,
      owner_role: definition.ownerRole
    });
  });
}

async function addHistory(instanceId, payload, currentUser, req) {
  const detail = await getInstanceDetail(instanceId);
  await assertInstanceWritable(detail.instance, currentUser);

  const action = normalizeAction(payload.action);
  const status = payload.status ? normalizeStatus(payload.status) : statusForAction(action, detail.instance.status);
  const fileLinkIds = normalizeFileLinkIds(payload.fileLinkIds || payload.file_link_ids);

  return tx(async client => {
    const { rows } = await client.query(
      `INSERT INTO bpm_history (instance_id, node_key, node_name, approver_id, approver_name, action, comment, file_link_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::bigint[])
       RETURNING id, instance_id, node_key, node_name, approver_id, approver_name, action, comment, file_link_ids, created_at`,
      [
        instanceId,
        normalizeText(payload.nodeKey || payload.node_key) || null,
        normalizeText(payload.nodeName || payload.node_name) || null,
        normalizeStaffId(currentUser),
        currentUser.name || null,
        action,
        normalizeText(payload.comment) || null,
        fileLinkIds
      ]
    );

    await client.query(
      'UPDATE bpm_instances SET status = $1, updated_at = now() WHERE id = $2',
      [status, instanceId]
    );

    const history = mapHistory(rows[0]);
    await recordAuditLog({
      systemKey: 'workflow',
      entityType: 'bpm_instance',
      entityId: instanceId,
      action: action.toLowerCase(),
      beforeData: detail.instance,
      afterData: { ...detail.instance, status, latestAction: history },
      metadata: { historyId: history.id },
      currentUser,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }, client);

    return {
      success: true,
      instanceId,
      status,
      history
    };
  });
}

async function resolveDefinition(payload) {
  const definitionId = normalizeText(payload.definitionId || payload.definition_id);
  const definitionKey = normalizeText(payload.definitionKey || payload.definition_key || payload.key);
  if (!definitionId && !definitionKey) throw new Error('缺少流程定義');

  const { rows } = await pool.query(
    `SELECT id, name, definition_key, owner_role, is_active, metadata, created_at, updated_at
     FROM bpm_definitions
     WHERE ($1::uuid IS NOT NULL AND id = $1::uuid)
        OR ($2::text <> '' AND definition_key = $2::text)
     LIMIT 1`,
    [definitionId || null, definitionKey || '']
  );
  if (!rows.length) throw new Error('找不到流程定義');
  if (!rows[0].is_active) throw new Error('流程定義已停用');
  return mapDefinition(rows[0]);
}

async function assertDefinitionWritable(definition, currentUser) {
  const access = await getFeatureAccess(currentUser, 'workflow');
  if (access === 'edit') return;
  if (definition.ownerRole && hasRole(currentUser, definition.ownerRole)) return;
  throw new Error('沒有此流程的操作權限');
}

async function assertInstanceReadable(instance, currentUser) {
  const access = await getFeatureAccess(currentUser, 'workflow');
  if (access === 'read' || access === 'edit') return;
  if (isParticipant(instance, currentUser)) return;
  throw new Error('沒有此流程的讀取權限');
}

async function assertInstanceWritable(instance, currentUser) {
  const access = await getFeatureAccess(currentUser, 'workflow');
  if (access === 'edit') return;
  if (instance.ownerRole && hasRole(currentUser, instance.ownerRole)) return;
  if (isParticipant(instance, currentUser)) return;
  throw new Error('沒有此流程的操作權限');
}

function isParticipant(instance, currentUser) {
  const staffId = normalizeStaffId(currentUser);
  return Boolean(staffId && instance && instance.creatorId === staffId);
}

function mapDefinition(row) {
  return {
    id: row.id,
    name: row.name,
    key: row.definition_key,
    ownerRole: row.owner_role,
    isActive: row.is_active,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapInstance(row) {
  return {
    id: row.id,
    definitionId: row.definition_id,
    definitionName: row.definition_name,
    definitionKey: row.definition_key,
    ownerRole: row.owner_role,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityCode: row.entity_code,
    status: row.status,
    creatorId: row.creator_id,
    creatorName: row.creator_name,
    latestNodeKey: row.latest_node_key || null,
    latestNodeName: row.latest_node_name || null,
    latestAction: row.latest_action || null,
    latestActionAt: row.latest_action_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapHistory(row) {
  return {
    id: row.id,
    instanceId: row.instance_id,
    nodeKey: row.node_key,
    nodeName: row.node_name,
    approverId: row.approver_id,
    approverName: row.approver_name,
    action: row.action,
    comment: row.comment,
    fileLinkIds: row.file_link_ids || [],
    createdAt: row.created_at
  };
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeRequired(value, message) {
  const text = normalizeText(value);
  if (!text) throw new Error(message);
  return text;
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeKey(value) {
  const text = normalizeRequired(value, '請填寫流程代碼').toLowerCase();
  if (!/^[a-z][a-z0-9_]{1,60}$/.test(text)) throw new Error('流程代碼格式不正確');
  return text;
}

function normalizeStatus(value) {
  const status = normalizeRequired(value, '請填寫流程狀態').toUpperCase();
  if (!VALID_STATUSES.has(status)) throw new Error('不支援的流程狀態');
  return status;
}

function normalizeAction(value) {
  const action = normalizeRequired(value, '請填寫流程動作').toUpperCase();
  if (!VALID_ACTIONS.has(action)) throw new Error('不支援的流程動作');
  return action;
}

function normalizeFileLinkIds(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map(value => Number(value))
    .filter(value => Number.isInteger(value) && value > 0);
}

function normalizeStaffId(currentUser) {
  return currentUser && currentUser.staffId ? String(currentUser.staffId) : null;
}

function statusForAction(action, currentStatus) {
  if (action === 'CANCEL') return 'CANCELLED';
  if (action === 'APPROVE') return 'COMPLETED';
  if (action === 'SUBMIT') return 'IN_PROGRESS';
  return currentStatus || 'IN_PROGRESS';
}

module.exports = { registerWorkflowRoutes };
