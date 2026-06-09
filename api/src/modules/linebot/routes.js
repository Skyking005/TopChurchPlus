const { pool } = require('../../db');
const { assertFeatureEditable, assertFeatureReadable } = require('../../shared/permissions');
const { parseUser } = require('../../shared/users');
const { getLineApiReadiness, normalizeLineApiConfig } = require('./line-api-client');

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
}

async function getLineBotDashboard() {
  const [summary, churchStats, modules, links, events] = await Promise.all([
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
    getLineBotEvents({ page: 1, pageSize: 5 })
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
    recentEvents: events.rows
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
  return {
    channelId: row.channel_id,
    channelKey: row.channel_key,
    channelName: row.channel_name,
    readiness: getLineApiReadiness(row.metadata || {})
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
    lineApi: incoming.lineApi ? { ...(existing.lineApi || {}), ...(incoming.lineApi || {}) } : existing.lineApi
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
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function normalizeText(value) {
  return String(value || '').trim();
}

module.exports = { registerLineBotRoutes };
