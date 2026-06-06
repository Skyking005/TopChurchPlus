const crypto = require('crypto');

const { pool, tx } = require('../../db');
const { assertFeatureEditable, assertFeatureReadable } = require('../../shared/permissions');
const { parseUser } = require('../../shared/users');

const SHORT_CODE_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;
const SHORT_LINK_STATUSES = new Set(['active', 'disabled', 'expired']);

function registerShortLinkRoutes(app) {
  app.get('/short-links', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'system');
      res.json(await getShortLinks(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.post('/short-links', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'system');
      res.json(await saveShortLink(null, req.body.link || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.put('/short-links/:linkId', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'system');
      res.json(await saveShortLink(req.params.linkId, req.body.link || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.post('/short-links/ensure', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      const link = req.body.link || {};
      await assertFeatureEditable(currentUser, link.sourceSystem === 'forms' ? 'forms' : 'system');
      res.json(await ensureShortLink(link, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.get('/short-links/:shortCode/resolve', async (req, res, next) => {
    try {
      res.json(await resolveShortLink(req.params.shortCode, req));
    } catch (err) {
      next(err);
    }
  });
}

async function getShortLinks(query) {
  const keyword = normalizeText(query.keyword);
  const status = normalizeText(query.status);
  const sourceSystem = normalizeText(query.sourceSystem);
  const where = [];
  const values = [];

  if (keyword) {
    values.push(`%${keyword.toLowerCase()}%`);
    where.push(`(
      lower(short_code) LIKE $${values.length}
      OR lower(title) LIKE $${values.length}
      OR lower(target_url) LIKE $${values.length}
    )`);
  }
  if (status) {
    values.push(status);
    where.push(`status = $${values.length}`);
  }
  if (sourceSystem) {
    values.push(sourceSystem);
    where.push(`source_system = $${values.length}`);
  }

  const { rows } = await pool.query(
    `SELECT sl.*, a.name AS created_by_name, a.position AS created_by_position
     FROM short_links sl
     LEFT JOIN accounts a ON a.staff_id = sl.created_by_staff_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY sl.updated_at DESC, sl.created_at DESC
     LIMIT 200`,
    values
  );
  return { rows: rows.map(toShortLink) };
}

async function saveShortLink(linkId, payload, currentUser) {
  const normalized = await normalizeShortLinkPayload(payload, { allowGeneratedCode: !linkId });

  const result = await pool.query(
    `INSERT INTO short_links (
       link_id, short_code, target_url, title, description, source_system, source_type,
       source_id, status, expires_at, created_by_staff_id, updated_by_staff_id, metadata, updated_at
     ) VALUES (COALESCE($1::uuid, gen_random_uuid()), $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12::jsonb,now())
     ON CONFLICT (link_id) DO UPDATE SET
       short_code = EXCLUDED.short_code,
       target_url = EXCLUDED.target_url,
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       source_system = EXCLUDED.source_system,
       source_type = EXCLUDED.source_type,
       source_id = EXCLUDED.source_id,
       status = EXCLUDED.status,
       expires_at = EXCLUDED.expires_at,
       updated_by_staff_id = EXCLUDED.updated_by_staff_id,
       metadata = EXCLUDED.metadata,
       updated_at = now()
     RETURNING *`,
    [
      linkId || null,
      normalized.shortCode,
      normalized.targetUrl,
      normalized.title,
      normalized.description,
      normalized.sourceSystem,
      normalized.sourceType,
      normalized.sourceId,
      normalized.status,
      normalized.expiresAt,
      currentUser.staffId ? String(currentUser.staffId) : null,
      JSON.stringify(normalized.metadata)
    ]
  );

  return {
    success: true,
    message: linkId ? '短連結已更新' : '短連結已建立',
    link: toShortLink(result.rows[0])
  };
}

async function ensureShortLink(payload, currentUser) {
  const sourceSystem = normalizeText(payload.sourceSystem) || 'manual';
  const sourceType = normalizeText(payload.sourceType);
  const sourceId = normalizeText(payload.sourceId);
  const targetUrl = normalizeUrl(payload.targetUrl);
  if (!sourceType || !sourceId) {
    return saveShortLink(null, Object.assign({}, payload, { targetUrl }), currentUser);
  }

  const existing = await pool.query(
    `SELECT *
     FROM short_links
     WHERE source_system = $1
       AND source_type = $2
       AND source_id = $3
       AND status <> 'expired'
     ORDER BY created_at DESC
     LIMIT 1`,
    [sourceSystem, sourceType, sourceId]
  );

  if (existing.rows[0]) {
    const result = await saveShortLink(existing.rows[0].link_id, Object.assign({}, payload, {
      shortCode: existing.rows[0].short_code,
      targetUrl,
      sourceSystem,
      sourceType,
      sourceId,
      status: payload.status || 'active'
    }), currentUser);
    result.message = '短連結已更新';
    return result;
  }

  return saveShortLink(null, Object.assign({}, payload, {
    targetUrl,
    sourceSystem,
    sourceType,
    sourceId,
    status: payload.status || 'active'
  }), currentUser);
}

async function resolveShortLink(shortCode, req) {
  const code = normalizeShortCode(shortCode);
  const result = await tx(async client => {
    const { rows } = await client.query('SELECT * FROM short_links WHERE short_code = $1', [code]);
    const link = rows[0];
    if (!link) throw new Error('找不到短連結');
    if (link.status !== 'active') throw new Error('此短連結已停用');
    if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
      await client.query('UPDATE short_links SET status = $1, updated_at = now() WHERE link_id = $2', ['expired', link.link_id]);
      throw new Error('此短連結已過期');
    }

    await client.query(
      `INSERT INTO short_link_clicks (link_id, ip_address, user_agent, referer)
       VALUES ($1, NULLIF($2, '')::inet, $3, $4)`,
      [link.link_id, normalizeIp(req.ip), String(req.get('user-agent') || '').slice(0, 500), String(req.get('referer') || '').slice(0, 500)]
    );
    await client.query('UPDATE short_links SET click_count = click_count + 1, updated_at = now() WHERE link_id = $1', [link.link_id]);
    return link;
  });

  return {
    success: true,
    shortCode: result.short_code,
    targetUrl: result.target_url
  };
}

async function normalizeShortLinkPayload(payload, options = {}) {
  const targetUrl = normalizeUrl(payload.targetUrl || payload.target_url);
  const shortCode = payload.shortCode || payload.short_code
    ? normalizeShortCode(payload.shortCode || payload.short_code)
    : await generateUniqueShortCode();
  if (!options.allowGeneratedCode && !shortCode) throw new Error('短碼不可空白');
  const status = normalizeText(payload.status) || 'active';
  if (!SHORT_LINK_STATUSES.has(status)) throw new Error('未知的短連結狀態');
  return {
    shortCode,
    targetUrl,
    title: normalizeText(payload.title) || '',
    description: normalizeText(payload.description) || '',
    sourceSystem: normalizeText(payload.sourceSystem || payload.source_system) || 'manual',
    sourceType: normalizeText(payload.sourceType || payload.source_type) || '',
    sourceId: normalizeText(payload.sourceId || payload.source_id) || '',
    status,
    expiresAt: normalizeDate(payload.expiresAt || payload.expires_at),
    metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}
  };
}

function normalizeShortCode(value) {
  const code = String(value || '').trim();
  if (!SHORT_CODE_PATTERN.test(code)) throw new Error('短碼只能使用 3-32 個英數字、底線或連字號');
  return code;
}

function normalizeUrl(value) {
  const url = String(value || '').trim();
  if (!url) throw new Error('目的網址不可空白');
  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    throw new Error('目的網址格式錯誤');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('目的網址僅支援 http 或 https');
  return parsed.toString();
}

function normalizeDate(value) {
  const text = normalizeText(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error('到期時間格式錯誤');
  return date.toISOString();
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeIp(value) {
  const ip = String(value || '').replace(/^::ffff:/, '').trim();
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip) ? ip : '';
}

async function generateUniqueShortCode() {
  for (let i = 0; i < 8; i += 1) {
    const code = crypto.randomBytes(5).toString('base64url').replace(/[-_]/g, '').slice(0, 7);
    const { rows } = await pool.query('SELECT 1 FROM short_links WHERE short_code = $1', [code]);
    if (!rows[0]) return code;
  }
  throw new Error('短碼產生失敗，請稍後再試');
}

function toShortLink(row) {
  return {
    linkId: row.link_id,
    shortCode: row.short_code,
    targetUrl: row.target_url,
    title: row.title || '',
    description: row.description || '',
    sourceSystem: row.source_system || '',
    sourceType: row.source_type || '',
    sourceId: row.source_id || '',
    status: row.status || 'active',
    clickCount: Number(row.click_count || 0),
    expiresAt: row.expires_at,
    createdBy: [row.created_by_name, row.created_by_position].filter(Boolean).join(' '),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: row.metadata || {}
  };
}

module.exports = { registerShortLinkRoutes };
