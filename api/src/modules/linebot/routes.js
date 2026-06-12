const { pool, tx } = require('../../db');
const { assertFeatureEditable, assertFeatureReadable } = require('../../shared/permissions');
const { parseUser } = require('../../shared/users');
const { recordAuditLog } = require('../../shared/audit');
const { recordNotificationLog, renderNotification } = require('../../shared/notifications');
const { listConfig, saveConfig } = require('../../shared/config');
const { createLineApiClient, getLineApiReadiness, normalizeLineApiConfig } = require('./line-api-client');
const { resolveLineChannelMetadata } = require('./config');
const { getLiffSecurityReadiness, normalizeLiffSecurityConfig } = require('../liff/security');

const PAGE_SIZE = 20;

function registerLineBotRoutes(app) {
  app.get('/linebot/dashboard', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'linebot');
      res.json(await getLineBotDashboard());
    } catch (err) {
      next(err);
    }
  });

  app.get('/linebot/users', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'linebot');
      res.json(await getLineBotUsers(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.get('/linebot/channels', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'linebot');
      res.json(await getLineBotChannels());
    } catch (err) {
      next(err);
    }
  });

  app.post('/linebot/channels', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'linebot');
      res.json(await saveLineBotChannel(null, req.body.channel || {}));
    } catch (err) {
      next(err);
    }
  });

  app.put('/linebot/channels/:channelId', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'linebot');
      res.json(await saveLineBotChannel(req.params.channelId, req.body.channel || {}));
    } catch (err) {
      next(err);
    }
  });

  app.get('/linebot/channels/:channelId/line-api-readiness', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'linebot');
      res.json(await getLineBotChannelApiReadiness(req.params.channelId));
    } catch (err) {
      next(err);
    }
  });

  app.get('/linebot/links', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'linebot');
      res.json(await getLineBotLinks(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.post('/linebot/links', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'linebot');
      res.json(await saveLineBotLink(null, req.body.link || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.put('/linebot/links/:linkId', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'linebot');
      res.json(await saveLineBotLink(req.params.linkId, req.body.link || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.delete('/linebot/links/:linkId', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureEditable(currentUser, 'linebot');
      await pool.query('UPDATE line_bot_links SET is_active = false, updated_at = now() WHERE link_id = $1', [req.params.linkId]);
      res.json({ success: true, message: 'LINE 連結已停用' });
    } catch (err) {
      next(err);
    }
  });

  app.get('/linebot/modules', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'linebot');
      res.json(await getLineBotModules());
    } catch (err) {
      next(err);
    }
  });

  app.get('/linebot/rich-menus', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'linebot');
      res.json(await getLineBotRichMenus());
    } catch (err) {
      next(err);
    }
  });

  app.post('/linebot/rich-menus', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'linebot');
      res.json(await saveLineBotRichMenu(null, req.body.richMenu || {}));
    } catch (err) {
      next(err);
    }
  });

  app.put('/linebot/rich-menus/:richMenuId', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'linebot');
      res.json(await saveLineBotRichMenu(req.params.richMenuId, req.body.richMenu || {}));
    } catch (err) {
      next(err);
    }
  });

  app.put('/linebot/modules/:moduleKey', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'linebot');
      res.json(await updateLineBotModule(req.params.moduleKey, req.body.module || {}));
    } catch (err) {
      next(err);
    }
  });

  app.get('/linebot/events', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'linebot');
      res.json(await getLineBotEvents(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.get('/linebot/config', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'linebot');
      res.json({ rows: await listConfig({ revealSecrets: false }) });
    } catch (err) {
      next(err);
    }
  });

  app.put('/linebot/config/:configKey', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'linebot');
      const saved = await saveConfig({
        ...(req.body.config || {}),
        configKey: req.params.configKey
      }, currentUser);
      res.json({ success: true, message: 'LINE 系統設定已更新', config: saved });
    } catch (err) {
      next(err);
    }
  });

  app.get('/linebot/notification-templates', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'linebot');
      res.json(await getLineNotificationTemplates(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.put('/linebot/notification-templates/:templateCode/:channel', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'linebot');
      res.json(await saveLineNotificationTemplate(req.params.templateCode, req.params.channel, req.body.template || {}, currentUser, req));
    } catch (err) {
      next(err);
    }
  });

  app.get('/linebot/menu-items', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'linebot');
      res.json(await getLineMenuItems());
    } catch (err) {
      next(err);
    }
  });

  app.put('/linebot/menu-items/:menuCode', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'linebot');
      res.json(await saveLineMenuItem(req.params.menuCode, req.body.menuItem || {}, currentUser, req));
    } catch (err) {
      next(err);
    }
  });

  app.get('/linebot/audit-logs', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'linebot');
      res.json(await getLineAuditLogs(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.get('/linebot/binding-requests', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'linebot');
      res.json(await getLineBindingRequests(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.post('/linebot/binding-requests/:requestId/approve', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'linebot');
      res.json(await approveLineBindingRequest(req.params.requestId, req.body || {}, currentUser, req));
    } catch (err) {
      next(err);
    }
  });

  app.post('/linebot/binding-requests/:requestId/reject', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'linebot');
      res.json(await rejectLineBindingRequest(req.params.requestId, req.body || {}, currentUser, req));
    } catch (err) {
      next(err);
    }
  });

  app.post('/linebot/users/:lineUserId/rich-menu/sync', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'linebot');
      res.json(await syncLineUserRichMenu(req.params.lineUserId, currentUser, req));
    } catch (err) {
      next(err);
    }
  });

  app.post('/linebot/rich-menus/sync-all', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'linebot');
      res.json(await syncAllLineUserRichMenus(req.body || {}, currentUser, req));
    } catch (err) {
      next(err);
    }
  });
}

async function getLineBotDashboard() {
  const [summary, churchStats, modules, links, events, pendingRequests] = await Promise.all([
    pool.query(
      `SELECT
         (SELECT count(*)::int FROM line_users) AS line_user_count,
         (SELECT count(*)::int FROM pastoral_members WHERE coalesce(line_user_id, '') <> '') AS bound_member_count,
         (SELECT count(*)::int FROM line_bot_links WHERE is_active) AS active_link_count,
         (SELECT count(*)::int FROM line_bot_edm_campaigns WHERE status <> 'archived') AS edm_campaign_count,
         (SELECT count(*)::int FROM line_bot_webhook_events) AS webhook_event_count,
         (SELECT max(last_interaction_at) FROM line_users) AS last_interaction_at`
    ),
    pool.query(
      `SELECT c.id AS church_id, c.name AS church_name,
         count(pm.id)::int AS member_count,
         count(pm.id) FILTER (WHERE coalesce(pm.line_user_id, '') <> '')::int AS bound_count
       FROM churches c
       LEFT JOIN pastoral_members pm ON pm.church_id = c.id AND pm.is_active
       WHERE c.is_active
       GROUP BY c.id, c.name, c.sort_order
       ORDER BY c.sort_order, c.id`
    ),
    getLineBotModules(),
    getLineBotLinks({ page: 1, pageSize: 5, activeOnly: '1' }),
    getLineBotEvents({ page: 1, pageSize: 5 }),
    pool.query(`SELECT count(*)::int AS pending_count FROM line_binding_requests WHERE status = 'PENDING'`)
  ]);

  const row = summary.rows[0] || {};
  return {
    lineUserCount: Number(row.line_user_count || 0),
    boundMemberCount: Number(row.bound_member_count || 0),
    activeLinkCount: Number(row.active_link_count || 0),
    edmCampaignCount: Number(row.edm_campaign_count || 0),
    webhookEventCount: Number(row.webhook_event_count || 0),
    lastInteractionAt: row.last_interaction_at,
    churchStats: churchStats.rows.map(item => ({
      churchId: item.church_id,
      churchName: item.church_name,
      memberCount: Number(item.member_count || 0),
      boundCount: Number(item.bound_count || 0)
    })),
    features: modules.rows,
    recentLinks: links.rows,
    recentEvents: events.rows,
    pendingBindingRequestCount: pendingRequests.rows[0]?.pending_count || 0
  };
}

async function getLineBotUsers(query = {}) {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || PAGE_SIZE)));
  const keyword = normalizeText(query.keyword).toLowerCase();
  const binding = normalizeText(query.binding);
  const values = [];
  const where = ['pm.is_active'];

  if (keyword) {
    values.push(`%${keyword}%`);
    where.push(`(
      lower(pm.name) LIKE $${values.length}
      OR lower(coalesce(pm.line_user_id, '')) LIKE $${values.length}
      OR lower(coalesce(lu.display_name, '')) LIKE $${values.length}
      OR lower(coalesce(ch.name, '')) LIKE $${values.length}
    )`);
  }
  if (binding === 'bound') {
    where.push(`coalesce(pm.line_user_id, '') <> ''`);
  } else if (binding === 'unbound') {
    where.push(`coalesce(pm.line_user_id, '') = ''`);
  }

  values.push(pageSize);
  const limitIndex = values.length;
  values.push((page - 1) * pageSize);
  const offsetIndex = values.length;

  const sql = `
    SELECT pm.id AS member_id,
      pm.name AS member_name,
      pm.line_user_id,
      lu.display_name AS line_display_name,
      lu.picture_url,
      lu.last_interaction_at,
      ch.name AS church_name,
      count(*) OVER()::int AS total_count
    FROM pastoral_members pm
    LEFT JOIN line_users lu ON lu.line_user_id = pm.line_user_id
    LEFT JOIN churches ch ON ch.id = pm.church_id
    WHERE ${where.join(' AND ')}
    ORDER BY coalesce(lu.last_interaction_at, pm.updated_at) DESC NULLS LAST, pm.id
    LIMIT $${limitIndex} OFFSET $${offsetIndex}`;
  const result = await pool.query(sql, values);
  return {
    rows: result.rows.map(row => ({
      memberId: row.member_id,
      memberName: row.member_name,
      churchName: row.church_name || '',
      lineUserId: row.line_user_id || '',
      lineDisplayName: row.line_display_name || '',
      pictureUrl: row.picture_url || '',
      lastInteractionAt: row.last_interaction_at
    })),
    page,
    pageSize,
    total: result.rows[0]?.total_count || 0
  };
}

async function getLineBotChannels() {
  const result = await pool.query(
    `SELECT channel_id, channel_key, channel_name, channel_type, webhook_url, liff_base_url,
       is_active, metadata, created_at, updated_at
     FROM line_bot_channels
     ORDER BY is_active DESC, channel_name, channel_key`
  );
  return { rows: result.rows.map(mapLineBotChannel) };
}

async function saveLineBotChannel(channelId, payload) {
  const normalized = normalizeLineBotChannel(payload);
  let metadata = normalized.metadata;
  if (channelId) {
    const existing = await pool.query('SELECT metadata FROM line_bot_channels WHERE channel_id = $1', [channelId]);
    if (!existing.rowCount) throw new Error('找不到 LINE Channel 設定');
    metadata = mergeLineBotSecretMetadata(existing.rows[0].metadata || {}, metadata);
  }
  const result = await pool.query(
    `INSERT INTO line_bot_channels (
       channel_id, channel_key, channel_name, channel_type, webhook_url, liff_base_url,
       is_active, metadata, updated_at
     ) VALUES (COALESCE($1::uuid, gen_random_uuid()), $2,$3,$4,$5,$6,$7,$8::jsonb,now())
     ON CONFLICT (channel_key) DO UPDATE SET
       channel_name = EXCLUDED.channel_name,
       channel_type = EXCLUDED.channel_type,
       webhook_url = EXCLUDED.webhook_url,
       liff_base_url = EXCLUDED.liff_base_url,
       is_active = EXCLUDED.is_active,
       metadata = EXCLUDED.metadata,
       updated_at = now()
     RETURNING channel_id, channel_key, channel_name, channel_type, webhook_url, liff_base_url,
       is_active, metadata, created_at, updated_at`,
    [
      channelId || null,
      normalized.channelKey,
      normalized.channelName,
      normalized.channelType,
      normalized.webhookUrl,
      normalized.liffBaseUrl,
      normalized.isActive,
      JSON.stringify(metadata)
    ]
  );
  return { success: true, message: channelId ? 'LINE Channel 設定已更新' : 'LINE Channel 設定已新增', channel: mapLineBotChannel(result.rows[0]) };
}

async function getLineBotChannelApiReadiness(channelId) {
  const result = await pool.query(
    `SELECT channel_id, channel_key, channel_name, metadata
     FROM line_bot_channels
     WHERE channel_id = $1`,
    [channelId]
  );
  if (!result.rowCount) throw new Error('找不到 LINE Channel 設定');
  const row = result.rows[0];
  const metadata = await resolveLineChannelMetadata(row);
  return {
    channelId: row.channel_id,
    channelKey: row.channel_key,
    channelName: row.channel_name,
    readiness: getLineApiReadiness(metadata)
  };
}

async function getLineBotLinks(query = {}) {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || PAGE_SIZE)));
  const keyword = normalizeText(query.keyword).toLowerCase();
  const activeOnly = String(query.activeOnly || '') === '1';
  const values = [];
  const where = [];

  if (activeOnly) where.push('is_active');
  if (keyword) {
    values.push(`%${keyword}%`);
    where.push(`(lower(title) LIKE $${values.length} OR lower(url) LIKE $${values.length} OR lower(coalesce(note, '')) LIKE $${values.length})`);
  }
  values.push(pageSize);
  const limitIndex = values.length;
  values.push((page - 1) * pageSize);
  const offsetIndex = values.length;

  const result = await pool.query(
    `SELECT *, count(*) OVER()::int AS total_count
     FROM line_bot_links
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY is_active DESC, sort_order, updated_at DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    values
  );
  return {
    rows: result.rows.map(mapLineBotLink),
    page,
    pageSize,
    total: result.rows[0]?.total_count || 0
  };
}

async function saveLineBotLink(linkId, payload, currentUser) {
  const link = normalizeLineBotLink(payload);
  const result = await pool.query(
    `INSERT INTO line_bot_links (
       link_id, title, url, link_type, visibility, is_active, sort_order, note, created_by_staff_id, updated_at
     ) VALUES (COALESCE($1::uuid, gen_random_uuid()), $2,$3,$4,$5,$6,$7,$8,$9,now())
     ON CONFLICT (link_id) DO UPDATE SET
       title = EXCLUDED.title,
       url = EXCLUDED.url,
       link_type = EXCLUDED.link_type,
       visibility = EXCLUDED.visibility,
       is_active = EXCLUDED.is_active,
       sort_order = EXCLUDED.sort_order,
       note = EXCLUDED.note,
       updated_at = now()
     RETURNING *`,
    [
      linkId || null,
      link.title,
      link.url,
      link.linkType,
      link.visibility,
      link.isActive,
      link.sortOrder,
      link.note,
      currentUser.staffId ? String(currentUser.staffId) : null
    ]
  );
  return { success: true, message: linkId ? 'LINE 連結已更新' : 'LINE 連結已新增', link: mapLineBotLink(result.rows[0]) };
}

async function getLineBotModules() {
  const result = await pool.query(
    `SELECT module_key, module_name, description, is_enabled, sort_order, metadata, updated_at
     FROM line_bot_module_settings
     ORDER BY sort_order, module_key`
  );
  return {
    rows: result.rows.map(row => ({
      key: row.module_key,
      title: row.module_name,
      description: row.description || '',
      enabled: Boolean(row.is_enabled),
      sortOrder: Number(row.sort_order || 0),
      metadata: row.metadata || {},
      updatedAt: row.updated_at
    }))
  };
}

async function getLineBotRichMenus() {
  const result = await pool.query(
    `SELECT rich_menu_id, menu_name, line_rich_menu_id, audience_rule, status, sort_order, created_at, updated_at
     FROM line_bot_rich_menus
     ORDER BY sort_order, menu_name`
  );
  return {
    rows: result.rows.map(row => ({
      richMenuId: row.rich_menu_id,
      menuName: row.menu_name,
      lineRichMenuId: row.line_rich_menu_id || '',
      audienceRule: row.audience_rule || {},
      audienceType: row.audience_rule?.type || 'bound',
      actionType: row.audience_rule?.actionType || 'open_liff',
      promptTitle: row.audience_rule?.promptTitle || '',
      unboundPrompt: row.audience_rule?.prompts?.unbound || '',
      boundPrompt: row.audience_rule?.prompts?.bound || '',
      targetUrl: row.audience_rule?.targetUrl || '',
      status: row.status || 'draft',
      sortOrder: Number(row.sort_order || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  };
}

async function saveLineBotRichMenu(richMenuId, payload) {
  const richMenu = normalizeLineBotRichMenu(payload);
  const result = await pool.query(
    `INSERT INTO line_bot_rich_menus (
       rich_menu_id, menu_name, line_rich_menu_id, audience_rule, status, sort_order, updated_at
     ) VALUES (COALESCE($1::uuid, gen_random_uuid()), $2,$3,$4::jsonb,$5,$6,now())
     ON CONFLICT (rich_menu_id) DO UPDATE SET
       menu_name = EXCLUDED.menu_name,
       line_rich_menu_id = EXCLUDED.line_rich_menu_id,
       audience_rule = EXCLUDED.audience_rule,
       status = EXCLUDED.status,
       sort_order = EXCLUDED.sort_order,
       updated_at = now()
     RETURNING rich_menu_id`,
    [
      richMenuId || null,
      richMenu.menuName,
      richMenu.lineRichMenuId,
      JSON.stringify(richMenu.audienceRule),
      richMenu.status,
      richMenu.sortOrder
    ]
  );
  return { success: true, message: richMenuId ? 'Rich Menu 設定已更新' : 'Rich Menu 設定已新增', richMenuId: result.rows[0].rich_menu_id };
}

async function updateLineBotModule(moduleKey, payload) {
  const enabled = payload.enabled !== false;
  const result = await pool.query(
    `UPDATE line_bot_module_settings
     SET is_enabled = $1, updated_at = now()
     WHERE module_key = $2
     RETURNING module_key`,
    [enabled, moduleKey]
  );
  if (!result.rowCount) throw new Error('找不到 Line App 會友功能設定');
  return { success: true, message: 'Line App 會友功能設定已更新' };
}

async function getLineBotEvents(query = {}) {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || PAGE_SIZE)));
  const keyword = normalizeText(query.keyword).toLowerCase();
  const values = [];
  const where = [];

  if (keyword) {
    values.push(`%${keyword}%`);
    where.push(`(
      lower(coalesce(line_user_id, '')) LIKE $${values.length}
      OR lower(event_type) LIKE $${values.length}
      OR lower(coalesce(message_type, '')) LIKE $${values.length}
      OR lower(coalesce(error_message, '')) LIKE $${values.length}
    )`);
  }
  values.push(pageSize);
  const limitIndex = values.length;
  values.push((page - 1) * pageSize);
  const offsetIndex = values.length;

  const result = await pool.query(
    `SELECT *, count(*) OVER()::int AS total_count
     FROM line_bot_webhook_events
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY received_at DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    values
  );
  return {
    rows: result.rows.map(row => ({
      eventId: row.event_id,
      lineEventId: row.line_event_id || '',
      lineUserId: row.line_user_id || '',
      eventType: row.event_type,
      messageType: row.message_type || '',
      handledStatus: row.handled_status,
      errorMessage: row.error_message || '',
      receivedAt: row.received_at,
      handledAt: row.handled_at
    })),
    page,
    pageSize,
    total: result.rows[0]?.total_count || 0
  };
}

async function getLineBindingRequests(query = {}) {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || PAGE_SIZE)));
  const status = normalizeBindingRequestStatus(query.status || 'PENDING', true);
  const keyword = normalizeText(query.keyword).toLowerCase();
  const values = [];
  const where = [];
  if (status) {
    values.push(status);
    where.push(`lbr.status = $${values.length}`);
  }
  if (keyword) {
    values.push(`%${keyword}%`);
    where.push(`(
      lower(lbr.name) LIKE $${values.length}
      OR lower(lbr.mobile) LIKE $${values.length}
      OR lower(coalesce(lbr.email, '')) LIKE $${values.length}
      OR lower(coalesce(lbr.display_name, '')) LIKE $${values.length}
      OR lower(coalesce(lbr.line_user_id, '')) LIKE $${values.length}
    )`);
  }
  values.push(pageSize);
  const limitIndex = values.length;
  values.push((page - 1) * pageSize);
  const offsetIndex = values.length;

  const result = await pool.query(
    `SELECT lbr.id, lbr.line_user_id, lbr.display_name, lbr.name, lbr.zone, lbr.mobile,
       lbr.email, lbr.status, lbr.admin_note, lbr.processed_at, lbr.processed_by,
       lbr.created_at, lbr.updated_at,
       lu.picture_url,
       count(*) OVER()::int AS total_count
     FROM line_binding_requests lbr
     LEFT JOIN line_users lu ON lu.line_user_id = lbr.line_user_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY lbr.created_at DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    values
  );

  return {
    rows: result.rows.map(mapLineBindingRequest),
    page,
    pageSize,
    total: result.rows[0]?.total_count || 0
  };
}

async function approveLineBindingRequest(requestId, payload, currentUser, req) {
  const memberId = Number(payload.memberId || payload.member_id || payload.pastoralMemberId);
  if (!Number.isInteger(memberId)) throw new Error('請指定要綁定的會友');
  const adminNote = normalizeText(payload.adminNote || payload.admin_note);

  const result = await tx(async client => {
    const request = await lockPendingBindingRequest(client, requestId);
    const member = await getActivePastoralMemberForBinding(client, memberId);
    if (!member) throw new Error('找不到可綁定的會友資料');

    const existingLine = await client.query(
      `SELECT pastoral_member_id
       FROM identity_providers
       WHERE provider_type = 'LINE'
         AND provider_user_id = $1
         AND status = 'ACTIVE'
       LIMIT 1`,
      [request.line_user_id]
    );
    if (existingLine.rowCount && Number(existingLine.rows[0].pastoral_member_id) !== memberId) {
      throw new Error('此 LINE 身份已綁定其他會友');
    }

    const existingMemberLine = await client.query(
      `SELECT provider_user_id
       FROM identity_providers
       WHERE provider_type = 'LINE'
         AND pastoral_member_id = $1
         AND status = 'ACTIVE'
       LIMIT 1`,
      [memberId]
    );
    if (existingMemberLine.rowCount && existingMemberLine.rows[0].provider_user_id !== request.line_user_id) {
      throw new Error('此會友已綁定其他 LINE 身份');
    }

    const pastoralBind = await client.query(
      `UPDATE pastoral_members
       SET line_user_id = $1,
           updated_at = now()
       WHERE id = $2
         AND (coalesce(line_user_id, '') = '' OR line_user_id = $1)
       RETURNING id`,
      [request.line_user_id, memberId]
    );
    if (!pastoralBind.rowCount) throw new Error('此會友已綁定其他 LINE 帳號');

    const account = await client.query(
      `INSERT INTO member_accounts (member_id, login_identifier, display_name, last_login_at, updated_at)
       VALUES ($1,$2,$3,now(),now())
       ON CONFLICT (login_identifier) DO UPDATE SET
         member_id = EXCLUDED.member_id,
         display_name = EXCLUDED.display_name,
         is_active = true,
         last_login_at = now(),
         updated_at = now()
       RETURNING member_account_id`,
      [memberId, `line:${request.line_user_id}`, member.name]
    );

    await client.query(
      `UPDATE line_users
       SET member_id = $1,
           member_account_id = $2,
           bound_at = coalesce(bound_at, now()),
           last_interaction_at = now(),
           metadata = metadata || $3::jsonb,
           updated_at = now()
       WHERE line_user_id = $4`,
      [
        memberId,
        account.rows[0].member_account_id,
        JSON.stringify({
          approvedBy: currentUser.staffId || '',
          approvedRequestId: request.id,
          approvedAt: new Date().toISOString()
        }),
        request.line_user_id
      ]
    );

    await client.query(
      `INSERT INTO identity_providers (
         pastoral_member_id, provider_type, provider_user_id, display_name,
         picture_url, email, status, linked_at, last_login_at, updated_at
       )
       SELECT $1, 'LINE', lu.line_user_id, lu.display_name, lu.picture_url,
         coalesce(nullif($3, ''), lu.metadata->>'email'), 'ACTIVE', now(), now(), now()
       FROM line_users lu
       WHERE lu.line_user_id = $2
       ON CONFLICT (provider_type, provider_user_id) DO UPDATE SET
         pastoral_member_id = EXCLUDED.pastoral_member_id,
         display_name = EXCLUDED.display_name,
         picture_url = EXCLUDED.picture_url,
         email = EXCLUDED.email,
         status = 'ACTIVE',
         last_login_at = now(),
         updated_at = now()`,
      [memberId, request.line_user_id, request.email || '']
    );

    const updated = await client.query(
      `UPDATE line_binding_requests
       SET status = 'APPROVED',
           admin_note = NULLIF($2, ''),
           processed_at = now(),
           processed_by = NULLIF($3, ''),
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [request.id, adminNote, currentUser.staffId || '']
    );

    await recordAuditLog({
      systemKey: 'line_binding',
      entityType: 'line_binding_requests',
      entityId: String(request.id),
      action: 'APPROVE',
      currentUser,
      memberId,
      beforeData: request,
      afterData: updated.rows[0],
      metadata: {
        lineUserId: request.line_user_id,
        requestId: req.requestId || ''
      },
      ipAddress: getIpAddress(req),
      userAgent: req.get('user-agent') || ''
    }, client);

    await recordLineBindingRequestNotification(client, 'LINE_BIND_REQUEST_APPROVED', request, member.name, 'SENT');
    return { request: updated.rows[0], member };
  });

  return {
    success: true,
    message: 'LINE 綁定申請已通過',
    request: mapLineBindingRequest(result.request),
    member: {
      memberId: result.member.id,
      name: result.member.name
    }
  };
}

async function rejectLineBindingRequest(requestId, payload, currentUser, req) {
  const adminNote = normalizeText(payload.adminNote || payload.admin_note);
  const result = await tx(async client => {
    const request = await lockPendingBindingRequest(client, requestId);
    const updated = await client.query(
      `UPDATE line_binding_requests
       SET status = 'REJECTED',
           admin_note = NULLIF($2, ''),
           processed_at = now(),
           processed_by = NULLIF($3, ''),
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [request.id, adminNote, currentUser.staffId || '']
    );

    await recordAuditLog({
      systemKey: 'line_binding',
      entityType: 'line_binding_requests',
      entityId: String(request.id),
      action: 'REJECT',
      currentUser,
      beforeData: request,
      afterData: updated.rows[0],
      metadata: {
        lineUserId: request.line_user_id,
        requestId: req.requestId || ''
      },
      ipAddress: getIpAddress(req),
      userAgent: req.get('user-agent') || ''
    }, client);

    await recordLineBindingRequestNotification(client, 'LINE_BIND_REQUEST_REJECTED', request, request.name, 'SENT');
    return updated.rows[0];
  });

  return {
    success: true,
    message: 'LINE 綁定申請已拒絕',
    request: mapLineBindingRequest(result)
  };
}

async function lockPendingBindingRequest(client, requestId) {
  const result = await client.query(
    `SELECT *
     FROM line_binding_requests
     WHERE id = $1
     FOR UPDATE`,
    [requestId]
  );
  if (!result.rowCount) throw new Error('找不到 LINE 綁定申請');
  if (result.rows[0].status !== 'PENDING') throw new Error('此 LINE 綁定申請已處理');
  return result.rows[0];
}

async function getActivePastoralMemberForBinding(client, memberId) {
  const result = await client.query(
    `SELECT id, name, line_user_id
     FROM pastoral_members
     WHERE id = $1
       AND is_active
     LIMIT 1`,
    [memberId]
  );
  return result.rows[0] || null;
}

async function recordLineBindingRequestNotification(client, templateCode, request, fallbackName, status) {
  if (!request.email) return null;
  const rendered = await renderNotification(templateCode, 'EMAIL', {
    Name: request.name || fallbackName || '',
    BindDatetime: new Date().toISOString(),
    OfficialWebsiteUrl: ''
  }, client);
  return recordNotificationLog({
    templateCode,
    channel: 'EMAIL',
    recipient: request.email,
    subject: rendered.subject,
    contentSnapshot: rendered.content,
    status
  }, client);
}

async function getLineNotificationTemplates(query = {}) {
  const channel = normalizeText(query.channel).toUpperCase();
  const values = [];
  const where = [];
  if (channel) {
    values.push(channel);
    where.push(`channel = $${values.length}`);
  }
  const result = await pool.query(
    `SELECT template_code, channel, subject, content, enabled, updated_by, updated_at
     FROM notification_templates
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY template_code, channel`,
    values
  );
  return { rows: result.rows.map(mapNotificationTemplate) };
}

async function saveLineNotificationTemplate(templateCode, channel, payload, currentUser, req) {
  const normalized = normalizeNotificationTemplate(templateCode, channel, payload);
  const result = await tx(async client => {
    const before = await client.query(
      `SELECT template_code, channel, subject, content, enabled, updated_by, updated_at
       FROM notification_templates
       WHERE template_code = $1 AND channel = $2`,
      [normalized.templateCode, normalized.channel]
    );
    const saved = await client.query(
      `INSERT INTO notification_templates (
         template_code, channel, subject, content, enabled, updated_by, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,now())
       ON CONFLICT (template_code, channel) DO UPDATE SET
         subject = EXCLUDED.subject,
         content = EXCLUDED.content,
         enabled = EXCLUDED.enabled,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()
       RETURNING template_code, channel, subject, content, enabled, updated_by, updated_at`,
      [
        normalized.templateCode,
        normalized.channel,
        normalized.subject,
        normalized.content,
        normalized.enabled,
        currentUser.staffId || null
      ]
    );
    await recordAuditLog({
      systemKey: 'linebot',
      entityType: 'notification_templates',
      entityId: `${normalized.templateCode}:${normalized.channel}`,
      action: before.rowCount ? 'UPDATE' : 'CREATE',
      currentUser,
      beforeData: before.rows[0] || null,
      afterData: saved.rows[0],
      metadata: { requestId: req.requestId || '' },
      ipAddress: getIpAddress(req),
      userAgent: req.get('user-agent') || ''
    }, client);
    return saved.rows[0];
  });
  return { success: true, message: '通知模板已更新', template: mapNotificationTemplate(result) };
}

async function getLineMenuItems() {
  const result = await pool.query(
    `SELECT menu_code, menu_name, menu_type, target_url, required_role,
       required_bind_status, display_order, enabled, icon, open_type, metadata, updated_at
     FROM menu_items
     ORDER BY display_order, menu_code`
  );
  return { rows: result.rows.map(mapMenuItem) };
}

async function saveLineMenuItem(menuCode, payload, currentUser, req) {
  const item = normalizeMenuItem(menuCode, payload);
  const result = await tx(async client => {
    const before = await client.query('SELECT * FROM menu_items WHERE menu_code = $1', [item.menuCode]);
    const saved = await client.query(
      `INSERT INTO menu_items (
         menu_code, menu_name, menu_type, target_url, required_role, required_bind_status,
         display_order, enabled, icon, open_type, metadata, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,now())
       ON CONFLICT (menu_code) DO UPDATE SET
         menu_name = EXCLUDED.menu_name,
         menu_type = EXCLUDED.menu_type,
         target_url = EXCLUDED.target_url,
         required_role = EXCLUDED.required_role,
         required_bind_status = EXCLUDED.required_bind_status,
         display_order = EXCLUDED.display_order,
         enabled = EXCLUDED.enabled,
         icon = EXCLUDED.icon,
         open_type = EXCLUDED.open_type,
         metadata = EXCLUDED.metadata,
         updated_at = now()
       RETURNING *`,
      [
        item.menuCode,
        item.menuName,
        item.menuType,
        item.targetUrl,
        item.requiredRole || null,
        item.requiredBindStatus,
        item.displayOrder,
        item.enabled,
        item.icon,
        item.openType,
        JSON.stringify(item.metadata)
      ]
    );
    await recordAuditLog({
      systemKey: 'linebot',
      entityType: 'menu_items',
      entityId: item.menuCode,
      action: before.rowCount ? 'UPDATE' : 'CREATE',
      currentUser,
      beforeData: before.rows[0] || null,
      afterData: saved.rows[0],
      metadata: { requestId: req.requestId || '' },
      ipAddress: getIpAddress(req),
      userAgent: req.get('user-agent') || ''
    }, client);
    return saved.rows[0];
  });
  return { success: true, message: 'Line App 選單已更新', menuItem: mapMenuItem(result) };
}

async function getLineAuditLogs(query = {}) {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || PAGE_SIZE)));
  const values = [['linebot', 'line_binding', 'config']];
  const where = [`system_key = ANY($1::text[])`];
  const keyword = normalizeText(query.keyword).toLowerCase();
  if (keyword) {
    values.push(`%${keyword}%`);
    where.push(`(
      lower(entity_type) LIKE $${values.length}
      OR lower(entity_id) LIKE $${values.length}
      OR lower(action) LIKE $${values.length}
      OR lower(coalesce(staff_id, '')) LIKE $${values.length}
    )`);
  }
  values.push(pageSize);
  const limitIndex = values.length;
  values.push((page - 1) * pageSize);
  const offsetIndex = values.length;
  const result = await pool.query(
    `SELECT audit_id, staff_id, member_id, system_key, entity_type, entity_id, action,
       before_data, after_data, metadata, ip_address, user_agent, created_at,
       count(*) OVER()::int AS total_count
     FROM audit_logs
     WHERE ${where.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${limitIndex}::int OFFSET $${offsetIndex}::int`,
    values
  );
  return {
    rows: result.rows.map(row => ({
      auditId: row.audit_id,
      staffId: row.staff_id || '',
      memberId: row.member_id,
      systemKey: row.system_key,
      entityType: row.entity_type,
      entityId: row.entity_id,
      action: row.action,
      beforeData: row.before_data,
      afterData: row.after_data,
      metadata: row.metadata || {},
      ipAddress: row.ip_address || '',
      userAgent: row.user_agent || '',
      createdAt: row.created_at
    })),
    page,
    pageSize,
    total: result.rows[0]?.total_count || 0
  };
}

async function syncAllLineUserRichMenus(payload, currentUser, req) {
  const limit = Math.min(100, Math.max(1, Number(payload.limit || 50)));
  const result = await pool.query(
    `SELECT line_user_id
     FROM line_users
     WHERE is_active
     ORDER BY last_interaction_at DESC NULLS LAST, updated_at DESC
     LIMIT $1`,
    [limit]
  );
  const rows = [];
  for (const row of result.rows) {
    rows.push(await syncLineUserRichMenu(row.line_user_id, currentUser, req));
  }
  return { success: true, message: `已處理 ${rows.length} 位 LINE 使用者 Rich Menu`, rows };
}

async function syncLineUserRichMenu(lineUserId, currentUser, req) {
  const lineUser = await getLineUserRichMenuTarget(lineUserId);
  if (!lineUser) throw new Error('找不到 LINE 使用者');
  const channel = await getActiveLineBotChannelForApi();
  const metadata = await resolveLineChannelMetadata(channel);
  const client = createLineApiClient(metadata);
  const target = getRichMenuSegment(lineUser);
  const richMenuId = getRichMenuIdForSegment(metadata, target.segment);
  if (!richMenuId) {
    await upsertRichMenuAssignment(lineUserId, target.segment, '', 'SKIPPED', '尚未設定對應 Rich Menu ID');
    return { success: true, lineUserId, segment: target.segment, status: 'SKIPPED', message: '尚未設定對應 Rich Menu ID' };
  }

  let status = 'ASSIGNED';
  let errorMessage = '';
  try {
    const response = await client.linkRichMenuToUser(lineUserId, richMenuId);
    if (response && response.dryRun) status = 'DRY_RUN';
  } catch (err) {
    status = 'FAILED';
    errorMessage = err.message || String(err);
  }
  await upsertRichMenuAssignment(lineUserId, target.segment, richMenuId, status, errorMessage);
  await recordAuditLog({
    systemKey: 'linebot',
    entityType: 'line_rich_menu_assignments',
    entityId: lineUserId,
    action: 'SYNC_RICH_MENU',
    currentUser,
    afterData: { lineUserId, segment: target.segment, richMenuId, status, errorMessage },
    metadata: { requestId: req.requestId || '' },
    ipAddress: getIpAddress(req),
    userAgent: req.get('user-agent') || ''
  });
  return {
    success: status !== 'FAILED',
    lineUserId,
    memberId: lineUser.member_id,
    segment: target.segment,
    richMenuId,
    status,
    errorMessage
  };
}

async function getLineUserRichMenuTarget(lineUserId) {
  const { rows } = await pool.query(
    `SELECT lu.line_user_id, lu.member_id, pm.name AS member_name, pt.name AS title_name,
       rule.scope_type
     FROM line_users lu
     LEFT JOIN pastoral_members pm ON pm.id = lu.member_id AND pm.is_active
     LEFT JOIN pastoral_titles pt ON pt.id = pm.title_id
     LEFT JOIN line_leader_scope_rules rule ON rule.title_name = pt.name AND rule.enabled
     WHERE lu.line_user_id = $1
     LIMIT 1`,
    [lineUserId]
  );
  return rows[0] || null;
}

async function getActiveLineBotChannelForApi() {
  const result = await pool.query(
    `SELECT channel_id, channel_key, channel_name, metadata
     FROM line_bot_channels
     WHERE is_active
     ORDER BY channel_key = 'main' DESC, updated_at DESC
     LIMIT 1`
  );
  if (!result.rowCount) throw new Error('尚未設定啟用中的 LINE Channel');
  return result.rows[0];
}

function getRichMenuSegment(lineUser) {
  if (!lineUser.member_id) return { segment: 'GUEST' };
  if (lineUser.scope_type) return { segment: 'LEADER' };
  return { segment: 'MEMBER' };
}

function getRichMenuIdForSegment(metadata, segment) {
  const richMenuIds = metadata.richMenuIds || {};
  if (segment === 'GUEST') return metadata.LINE_RICH_MENU_GUEST_ID || richMenuIds.unbound || '';
  if (segment === 'LEADER') return metadata.LINE_RICH_MENU_LEADER_ID || richMenuIds.advanced || richMenuIds.bound || '';
  return metadata.LINE_RICH_MENU_MEMBER_ID || richMenuIds.bound || '';
}

async function upsertRichMenuAssignment(lineUserId, segment, richMenuId, status, errorMessage) {
  await pool.query(
    `INSERT INTO line_rich_menu_assignments (
       line_user_id, target_segment, line_rich_menu_id, status, error_message, assigned_at, updated_at
     ) VALUES ($1,$2,$3,$4,NULLIF($5, ''),CASE WHEN $4 IN ('ASSIGNED','DRY_RUN') THEN now() ELSE NULL END,now())
     ON CONFLICT (line_user_id) DO UPDATE SET
       target_segment = EXCLUDED.target_segment,
       line_rich_menu_id = EXCLUDED.line_rich_menu_id,
       status = EXCLUDED.status,
       error_message = EXCLUDED.error_message,
       assigned_at = EXCLUDED.assigned_at,
       updated_at = now()`,
    [lineUserId, segment, richMenuId || null, status, errorMessage || '']
  );
}

function normalizeLineBotLink(payload) {
  const title = normalizeText(payload.title);
  const url = normalizeText(payload.url);
  if (!title) throw new Error('請填寫 LINE 連結名稱');
  if (!/^https?:\/\//i.test(url)) throw new Error('LINE 連結網址需以 http:// 或 https:// 開頭');
  return {
    title,
    url,
    linkType: ['form', 'event', 'qt', 'donation', 'custom'].includes(payload.linkType) ? payload.linkType : 'form',
    visibility: ['public', 'members', 'staff'].includes(payload.visibility) ? payload.visibility : 'public',
    isActive: payload.isActive !== false,
    sortOrder: Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : 100,
    note: normalizeText(payload.note)
  };
}

function normalizeLineBotChannel(payload) {
  const channelKey = normalizeKey(payload.channelKey || payload.channel_key || 'main');
  const channelName = normalizeText(payload.channelName || payload.channel_name);
  if (!channelKey) throw new Error('請填寫 Channel Key');
  if (!channelName) throw new Error('請填寫 Channel 名稱');
  const liffIds = payload.liffIds && typeof payload.liffIds === 'object' ? payload.liffIds : {};
  const richMenuIds = payload.richMenuIds && typeof payload.richMenuIds === 'object' ? payload.richMenuIds : {};
  const notifyTokens = payload.notifyTokens && typeof payload.notifyTokens === 'object' ? payload.notifyTokens : {};
  const hasLineApiPayload = payload.lineApi && typeof payload.lineApi === 'object';
  const hasLiffSecurityPayload = payload.liffSecurity && typeof payload.liffSecurity === 'object';
  const metadata = {
    channelAccessToken: normalizeText(payload.channelAccessToken),
    channelSecret: normalizeText(payload.channelSecret),
    loginClientId: normalizeText(payload.loginClientId),
    loginClientSecret: normalizeText(payload.loginClientSecret),
    loginRedirectUri: normalizeText(payload.loginRedirectUri),
    liffIds: {
      portal: normalizeText(liffIds.portal),
      rollcall: normalizeText(liffIds.rollcall),
      spiritualLife: normalizeText(liffIds.spiritualLife),
      selfCheckIn: normalizeText(liffIds.selfCheckIn),
      qtOrder: normalizeText(liffIds.qtOrder)
    },
    richMenuIds: {
      unbound: normalizeText(richMenuIds.unbound),
      bound: normalizeText(richMenuIds.bound),
      advanced: normalizeText(richMenuIds.advanced)
    },
    notifyTokens: {
      administrative: normalizeText(notifyTokens.administrative),
      checkInOut: normalizeText(notifyTokens.checkInOut)
    }
  };
  if (hasLineApiPayload) metadata.lineApi = normalizeLineApiConfig(payload.lineApi);
  if (hasLiffSecurityPayload) metadata.liffSecurity = normalizeLiffSecurityConfig(payload.liffSecurity);
  return {
    channelKey,
    channelName,
    channelType: ['official', 'staff', 'test'].includes(payload.channelType) ? payload.channelType : 'official',
    webhookUrl: normalizeText(payload.webhookUrl),
    liffBaseUrl: normalizeText(payload.liffBaseUrl),
    isActive: payload.isActive !== false,
    metadata
  };
}

function mergeLineBotSecretMetadata(existing, incoming) {
  const merged = {
    ...existing,
    ...incoming,
    liffIds: { ...(incoming.liffIds || {}) },
    richMenuIds: { ...(incoming.richMenuIds || {}) },
    notifyTokens: { ...(existing.notifyTokens || {}), ...(incoming.notifyTokens || {}) },
    lineApi: incoming.lineApi ? { ...(existing.lineApi || {}), ...(incoming.lineApi || {}) } : existing.lineApi,
    liffSecurity: incoming.liffSecurity ? { ...(existing.liffSecurity || {}), ...(incoming.liffSecurity || {}) } : existing.liffSecurity
  };
  [
    'channelAccessToken',
    'channelSecret',
    'loginClientId',
    'loginClientSecret'
  ].forEach(key => {
    if (!incoming[key]) merged[key] = existing[key] || '';
  });
  ['administrative', 'checkInOut'].forEach(key => {
    if (!incoming.notifyTokens?.[key]) merged.notifyTokens[key] = existing.notifyTokens?.[key] || '';
  });
  return merged;
}

function normalizeLineBotRichMenu(payload) {
  const menuName = normalizeText(payload.menuName);
  if (!menuName) throw new Error('請填寫 Rich Menu 名稱');
  const audienceType = ['unbound', 'bound', 'advanced', 'staff', 'custom'].includes(payload.audienceType) ? payload.audienceType : 'bound';
  const actionType = ['open_liff', 'reply_message', 'external_url'].includes(payload.actionType) ? payload.actionType : 'open_liff';
  return {
    menuName,
    lineRichMenuId: normalizeText(payload.lineRichMenuId),
    audienceRule: {
      type: audienceType,
      note: normalizeText(payload.audienceNote),
      actionType,
      promptTitle: normalizeText(payload.promptTitle),
      prompts: {
        unbound: normalizeText(payload.unboundPrompt),
        bound: normalizeText(payload.boundPrompt)
      },
      targetUrl: normalizeText(payload.targetUrl)
    },
    status: ['draft', 'active', 'disabled'].includes(payload.status) ? payload.status : 'draft',
    sortOrder: Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : 100
  };
}

function mapLineBotLink(row) {
  return {
    linkId: row.link_id,
    title: row.title,
    url: row.url,
    linkType: row.link_type,
    visibility: row.visibility,
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order || 0),
    note: row.note || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapLineBotChannel(row) {
  const metadata = row.metadata || {};
  return {
    channelId: row.channel_id,
    channelKey: row.channel_key,
    channelName: row.channel_name,
    channelType: row.channel_type,
    webhookUrl: row.webhook_url || '',
    liffBaseUrl: row.liff_base_url || '',
    isActive: Boolean(row.is_active),
    loginRedirectUri: metadata.loginRedirectUri || '',
    liffIds: metadata.liffIds || {},
    richMenuIds: metadata.richMenuIds || {},
    hasChannelAccessToken: Boolean(metadata.channelAccessToken),
    hasChannelSecret: Boolean(metadata.channelSecret),
    hasLoginClientId: Boolean(metadata.loginClientId),
    hasLoginClientSecret: Boolean(metadata.loginClientSecret),
    hasAdministrativeNotifyToken: Boolean(metadata.notifyTokens?.administrative),
    hasCheckInOutNotifyToken: Boolean(metadata.notifyTokens?.checkInOut),
    lineApi: normalizeLineApiConfig(metadata.lineApi || {}),
    lineApiReadiness: getLineApiReadiness(metadata),
    liffSecurity: normalizeLiffSecurityConfig(metadata.liffSecurity || {}),
    liffSecurityReadiness: getLiffSecurityReadiness(metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapLineBindingRequest(row) {
  return {
    requestId: row.id,
    lineUserId: row.line_user_id || '',
    displayName: row.display_name || '',
    pictureUrl: row.picture_url || '',
    name: row.name || '',
    zone: row.zone || '',
    mobile: row.mobile || '',
    email: row.email || '',
    status: row.status,
    adminNote: row.admin_note || '',
    processedAt: row.processed_at,
    processedBy: row.processed_by || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapNotificationTemplate(row) {
  return {
    templateCode: row.template_code,
    channel: row.channel,
    subject: row.subject || '',
    content: row.content || '',
    enabled: row.enabled !== false,
    updatedBy: row.updated_by || '',
    updatedAt: row.updated_at
  };
}

function mapMenuItem(row) {
  return {
    menuCode: row.menu_code,
    menuName: row.menu_name,
    menuType: row.menu_type,
    targetUrl: row.target_url || '',
    requiredRole: row.required_role || '',
    requiredBindStatus: row.required_bind_status,
    displayOrder: Number(row.display_order || 0),
    enabled: row.enabled !== false,
    icon: row.icon || '',
    openType: row.open_type,
    metadata: row.metadata || {},
    updatedAt: row.updated_at
  };
}

function normalizeNotificationTemplate(templateCode, channel, payload) {
  const normalizedCode = normalizeText(templateCode).toUpperCase().replace(/[^A-Z0-9_]/g, '');
  const normalizedChannel = normalizeText(channel).toUpperCase();
  if (!normalizedCode) throw new Error('請指定通知模板代碼');
  if (!['EMAIL', 'LINE_PUSH', 'LIFF_NOTICE'].includes(normalizedChannel)) throw new Error('通知通道不支援');
  const content = String(payload.content || '');
  if (!content.trim()) throw new Error('請填寫通知內容');
  return {
    templateCode: normalizedCode,
    channel: normalizedChannel,
    subject: normalizeText(payload.subject),
    content,
    enabled: payload.enabled !== false
  };
}

function normalizeMenuItem(menuCode, payload) {
  const code = normalizeText(menuCode || payload.menuCode).toUpperCase().replace(/[^A-Z0-9_]/g, '');
  if (!code) throw new Error('請指定選單代碼');
  const menuName = normalizeText(payload.menuName);
  if (!menuName) throw new Error('請填寫選單名稱');
  const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
  return {
    menuCode: code,
    menuName,
    menuType: ['MEMBER', 'LEADER', 'EXTERNAL', 'ADMIN'].includes(payload.menuType) ? payload.menuType : 'MEMBER',
    targetUrl: normalizeText(payload.targetUrl),
    requiredRole: normalizeText(payload.requiredRole),
    requiredBindStatus: ['ANY', 'BOUND', 'UNBOUND'].includes(payload.requiredBindStatus) ? payload.requiredBindStatus : 'BOUND',
    displayOrder: Number.isFinite(Number(payload.displayOrder)) ? Number(payload.displayOrder) : 100,
    enabled: payload.enabled !== false,
    icon: normalizeText(payload.icon),
    openType: ['LIFF_ROUTE', 'EXTERNAL_URL', 'INTERNAL_MODULE'].includes(payload.openType) ? payload.openType : 'LIFF_ROUTE',
    metadata
  };
}

function normalizeBindingRequestStatus(value, allowEmpty = false) {
  const status = normalizeText(value).toUpperCase();
  if (!status && allowEmpty) return '';
  return ['PENDING', 'APPROVED', 'REJECTED'].includes(status) ? status : 'PENDING';
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function normalizeText(value) {
  return String(value || '').trim();
}

module.exports = { registerLineBotRoutes };
