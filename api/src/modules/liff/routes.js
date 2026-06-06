const crypto = require('crypto');
const path = require('path');
const express = require('express');
const { pool } = require('../../db');

const SESSION_DAYS = 7;
const DEFAULT_CHANNEL_KEY = 'main';

function registerLiffRoutes(app) {
  const publicDir = path.join(__dirname, '../../../public/liff');

  app.use('/liff/assets', express.static(publicDir, {
    etag: true,
    maxAge: '10m'
  }));

  app.get('/liff', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  app.get('/liff/config', async (req, res, next) => {
    try {
      const channel = await getActiveChannel(req.query.channelKey);
      res.json(await getLiffConfig(channel));
    } catch (err) {
      next(err);
    }
  });

  app.post('/liff/session', async (req, res, next) => {
    try {
      const result = await createLiffSession(req.body || {}, req);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.get('/liff/me', async (req, res, next) => {
    try {
      const session = await requireLiffSession(req);
      res.json(await getLiffMe(session));
    } catch (err) {
      next(err);
    }
  });

  app.post('/liff/bind-member', async (req, res, next) => {
    try {
      const session = await requireLiffSession(req);
      res.json(await bindLiffMember(session, req.body || {}, req));
    } catch (err) {
      next(err);
    }
  });

  app.get('/liff/portal-links', async (req, res, next) => {
    try {
      const session = await requireLiffSession(req);
      res.json(await getPortalLinks(session));
    } catch (err) {
      next(err);
    }
  });
}

async function getActiveChannel(channelKey) {
  const normalizedKey = normalizeKey(channelKey || DEFAULT_CHANNEL_KEY);
  const { rows } = await pool.query(
    `SELECT channel_key, channel_name, liff_base_url, metadata
     FROM line_bot_channels
     WHERE channel_key = $1
       AND is_active
     LIMIT 1`,
    [normalizedKey]
  );
  if (!rows[0]) throw notFound('找不到啟用中的 LINE Channel 設定');
  return rows[0];
}

async function getLiffConfig(channel) {
  const metadata = channel.metadata || {};
  const modules = await pool.query(
    `SELECT module_key, module_name, description, is_enabled, sort_order
     FROM line_bot_module_settings
     WHERE is_enabled
     ORDER BY sort_order, module_key`
  );

  return {
    channelKey: channel.channel_key,
    channelName: channel.channel_name,
    liffBaseUrl: channel.liff_base_url || '',
    liffId: metadata.liffIds?.portal || '',
    fallbackLiffIds: metadata.liffIds || {},
    modules: modules.rows.map(row => ({
      key: row.module_key,
      name: row.module_name,
      description: row.description || '',
      sortOrder: Number(row.sort_order || 0)
    }))
  };
}

async function createLiffSession(payload, req) {
  const channel = await getActiveChannel(payload.channelKey);
  const metadata = channel.metadata || {};
  const clientId = normalizeText(metadata.loginClientId);
  if (!clientId) throw configurationError('尚未設定 LINE Login Client ID，無法驗證 LIFF 身分');

  const idToken = normalizeText(payload.idToken);
  if (!idToken) throw unauthorized('缺少 LINE ID Token');

  const verified = await verifyLineIdToken(idToken, clientId);
  const lineUserId = normalizeText(verified.sub);
  if (!lineUserId) throw unauthorized('LINE ID Token 未包含使用者識別碼');

  await pool.query(
    `INSERT INTO line_users (
       line_user_id, display_name, picture_url, is_active, last_interaction_at, metadata, updated_at
     ) VALUES ($1,$2,$3,true,now(),$4::jsonb,now())
     ON CONFLICT (line_user_id) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       picture_url = EXCLUDED.picture_url,
       is_active = true,
       last_interaction_at = now(),
       metadata = line_users.metadata || EXCLUDED.metadata,
       updated_at = now()`,
    [
      lineUserId,
      normalizeText(verified.name),
      normalizeText(verified.picture),
      JSON.stringify({
        source: 'liff',
        channelKey: channel.channel_key,
        email: normalizeText(verified.email)
      })
    ]
  );

  const sessionToken = crypto.randomBytes(32).toString('base64url');
  const sessionHash = hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO line_liff_sessions (
       session_token_hash, line_user_id, channel_key, expires_at, metadata
     ) VALUES ($1,$2,$3,$4,$5::jsonb)`,
    [
      sessionHash,
      lineUserId,
      channel.channel_key,
      expiresAt,
      JSON.stringify({
        ipAddress: getIpAddress(req),
        userAgent: req.get('user-agent') || ''
      })
    ]
  );

  const me = await getLiffMe({ line_user_id: lineUserId, channel_key: channel.channel_key });
  return {
    success: true,
    sessionToken,
    expiresAt: expiresAt.toISOString(),
    lineUser: me.lineUser,
    member: me.member
  };
}

async function verifyLineIdToken(idToken, clientId) {
  const body = new URLSearchParams();
  body.set('id_token', idToken);
  body.set('client_id', clientId);

  const response = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (err) {
    throw unauthorized('LINE Token 驗證回應格式錯誤');
  }
  if (!response.ok) {
    throw unauthorized(data.error_description || data.error || 'LINE Token 驗證失敗');
  }
  return data;
}

async function requireLiffSession(req) {
  const token = getBearerToken(req) || normalizeText(req.get('x-liff-session-token'));
  if (!token) throw unauthorized('缺少 LIFF Session Token');

  const { rows } = await pool.query(
    `UPDATE line_liff_sessions
     SET last_seen_at = now()
     WHERE session_token_hash = $1
       AND is_active
       AND expires_at > now()
     RETURNING session_id, line_user_id, channel_key, expires_at`,
    [hashToken(token)]
  );
  if (!rows[0]) throw unauthorized('LIFF Session 已失效，請重新開啟 LINE 入口');
  return rows[0];
}

async function getLiffMe(session) {
  const { rows } = await pool.query(
    `SELECT
       lu.line_user_id,
       lu.display_name,
       lu.picture_url,
       lu.bound_at,
       lu.last_interaction_at,
       pm.id AS member_id,
       pm.name AS member_name,
       pm.church_id,
       ch.name AS church_name,
       pc.mobile_phone
     FROM line_users lu
     LEFT JOIN pastoral_members pm ON pm.id = lu.member_id AND pm.is_active
     LEFT JOIN churches ch ON ch.id = pm.church_id
     LEFT JOIN pastoral_member_contacts pc ON pc.member_id = pm.id
     WHERE lu.line_user_id = $1`,
    [session.line_user_id]
  );
  const row = rows[0];
  if (!row) throw unauthorized('找不到 LINE 使用者資料');

  return {
    lineUser: {
      lineUserId: row.line_user_id,
      displayName: row.display_name || '',
      pictureUrl: row.picture_url || '',
      boundAt: row.bound_at,
      lastInteractionAt: row.last_interaction_at
    },
    member: row.member_id ? {
      memberId: row.member_id,
      name: row.member_name,
      churchId: row.church_id,
      churchName: row.church_name || '',
      mobilePhone: row.mobile_phone || ''
    } : null
  };
}

async function bindLiffMember(session, payload, req) {
  const current = await getLiffMe(session);
  if (current.member) {
    return { success: true, message: '此 LINE 帳號已完成會友綁定', member: current.member };
  }

  const name = normalizeText(payload.name);
  const birthday = normalizeDate(payload.birthday);
  const mobileLast3 = normalizeDigits(payload.mobileLast3).slice(-3);
  const churchId = Number(payload.churchId || 0);

  if (!name) throw validationError('請填寫姓名');
  if (!birthday && mobileLast3.length !== 3) throw validationError('請填寫生日或手機末三碼');

  const values = [name.toLowerCase()];
  const where = ['lower(pm.name) = $1', 'pm.is_active'];
  if (birthday) {
    values.push(birthday);
    where.push(`pm.birthday = $${values.length}::date`);
  }
  if (mobileLast3.length === 3) {
    values.push(`%${mobileLast3}`);
    where.push(`regexp_replace(coalesce(pc.mobile_phone, ''), '\\D', '', 'g') LIKE $${values.length}`);
  }
  if (Number.isFinite(churchId) && churchId > 0) {
    values.push(churchId);
    where.push(`pm.church_id = $${values.length}`);
  }

  const candidates = await pool.query(
    `SELECT pm.id, pm.name, pm.church_id, ch.name AS church_name, pc.mobile_phone
     FROM pastoral_members pm
     LEFT JOIN churches ch ON ch.id = pm.church_id
     LEFT JOIN pastoral_member_contacts pc ON pc.member_id = pm.id
     WHERE ${where.join(' AND ')}
     ORDER BY pm.id
     LIMIT 3`,
    values
  );

  if (candidates.rows.length === 0) throw notFound('找不到符合條件的會友資料，請洽櫃台或牧養同工協助');
  if (candidates.rows.length > 1) throw validationError('找到多筆相同資料，請增加生日、手機末三碼或會堂條件');

  const member = candidates.rows[0];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
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
      [member.id, `line:${session.line_user_id}`, member.name]
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
        member.id,
        account.rows[0].member_account_id,
        JSON.stringify({
          lastBindIp: getIpAddress(req),
          lastBindUserAgent: req.get('user-agent') || ''
        }),
        session.line_user_id
      ]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return {
    success: true,
    message: '會友綁定完成',
    member: {
      memberId: member.id,
      name: member.name,
      churchId: member.church_id,
      churchName: member.church_name || '',
      mobilePhone: member.mobile_phone || ''
    }
  };
}

async function getPortalLinks(session) {
  const me = await getLiffMe(session);
  const visibility = me.member ? ['public', 'members'] : ['public'];
  const links = await pool.query(
    `SELECT title, url, link_type, visibility, sort_order, note
     FROM line_bot_links
     WHERE is_active
       AND visibility = ANY($1::text[])
     ORDER BY sort_order, updated_at DESC`,
    [visibility]
  );
  const modules = await pool.query(
    `SELECT module_key, module_name, description, sort_order
     FROM line_bot_module_settings
     WHERE is_enabled
     ORDER BY sort_order, module_key`
  );
  return {
    member: me.member,
    links: links.rows.map(row => ({
      title: row.title,
      url: row.url,
      type: row.link_type,
      visibility: row.visibility,
      note: row.note || '',
      sortOrder: Number(row.sort_order || 0)
    })),
    modules: modules.rows.map(row => ({
      key: row.module_key,
      name: row.module_name,
      description: row.description || '',
      sortOrder: Number(row.sort_order || 0)
    }))
  };
}

function getBearerToken(req) {
  const header = normalizeText(req.get('authorization'));
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function getIpAddress(req) {
  return normalizeText(req.get('x-forwarded-for')).split(',')[0] || req.ip || '';
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9_-]/g, '') || DEFAULT_CHANNEL_KEY;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeDigits(value) {
  return normalizeText(value).replace(/\D/g, '');
}

function normalizeDate(value) {
  const text = normalizeText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function unauthorized(message) {
  return httpError(401, message);
}

function notFound(message) {
  return httpError(404, message);
}

function validationError(message) {
  return httpError(400, message);
}

function configurationError(message) {
  return httpError(503, message);
}

module.exports = { registerLiffRoutes };
