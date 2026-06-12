const crypto = require('crypto');
const path = require('path');
const express = require('express');
const { pool } = require('../../db');
const { recordAuditLog } = require('../../shared/audit');
const { recordNotificationLog, renderNotification } = require('../../shared/notifications');
const { getConfigValues } = require('../../shared/config');
const {
  assertLiffRequestAllowed,
  assertLiffSessionAllowed,
  getLiffRequestFingerprint,
  getLiffSecurityReadiness,
  normalizeLiffSecurityConfig
} = require('./security');
const { resolveLineChannel } = require('../linebot/config');

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

  app.get('/liff/member-center', async (req, res, next) => {
    try {
      const session = await requireLiffSession(req);
      res.json(await getLiffMemberCenter(session));
    } catch (err) {
      next(err);
    }
  });

  app.get('/liff/leader-center', async (req, res, next) => {
    try {
      const session = await requireLiffSession(req);
      res.json(await getLiffLeaderCenter(session));
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
  return resolveLineChannel(rows[0]);
}

async function getLiffConfig(channel) {
  const metadata = channel.metadata || {};
  const security = getLiffSecurityReadiness(metadata);
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
    security: {
      sessionDays: security.sessionDays,
      requireHttps: security.requireHttps,
      originMode: security.originMode,
      sessionClientBinding: security.sessionClientBinding,
      hardened: security.hardened
    },
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
  const security = normalizeLiffSecurityConfig(metadata.liffSecurity || {});
  assertLiffRequestAllowed(req, security);
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
  const expiresAt = new Date(Date.now() + security.sessionDays * 24 * 60 * 60 * 1000);

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
        userAgent: req.get('user-agent') || '',
        fingerprint: getLiffRequestFingerprint(req),
        securityMode: {
          originMode: security.originMode,
          sessionClientBinding: security.sessionClientBinding,
          requireHttps: security.requireHttps
        }
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
  if (data.aud && String(data.aud) !== String(clientId)) {
    throw unauthorized('LINE Token 的 Client ID 不符合目前 Channel 設定');
  }
  if (data.exp && Number(data.exp) * 1000 <= Date.now()) {
    throw unauthorized('LINE Token 已過期，請重新開啟 Line App');
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
     RETURNING session_id, line_user_id, channel_key, expires_at, metadata`,
    [hashToken(token)]
  );
  if (!rows[0]) throw unauthorized('LIFF Session 已失效，請重新開啟 Line App');

  const channel = await getActiveChannel(rows[0].channel_key);
  const security = normalizeLiffSecurityConfig(channel.metadata?.liffSecurity || {});
  assertLiffRequestAllowed(req, security);
  assertLiffSessionAllowed(req, rows[0].metadata || {}, security);
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
  const mobilePhone = normalizeDigits(payload.mobilePhone || payload.phone);
  const mobilePhoneVariants = getPhoneVariants(mobilePhone);
  const churchId = Number(payload.churchId || 0);

  if (!name) throw validationError('請填寫姓名');
  if (mobilePhone.length < 8) throw validationError('請填寫完整手機號碼');

  const values = [name.toLowerCase()];
  const where = ['lower(pm.name) = $1', 'pm.is_active'];
  values.push(mobilePhoneVariants);
  where.push(`regexp_replace(coalesce(pc.mobile_phone, ''), '\\D', '', 'g') = ANY($${values.length}::text[])`);
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

  if (candidates.rows.length === 0) {
    const request = await createLineBindingRequest(session, payload, {
      name,
      mobilePhone,
      reason: 'member_not_found'
    });
    return {
      success: true,
      status: 'pending_review',
      message: '找不到符合條件的會友資料，已建立綁定申請，請等候同工審核。',
      request
    };
  }
  if (candidates.rows.length > 1) {
    const request = await createLineBindingRequest(session, payload, {
      name,
      mobilePhone,
      reason: 'duplicate_member_candidates'
    });
    return {
      success: true,
      status: 'pending_review',
      message: '找到多筆相同資料，已建立綁定申請，請等候同工協助確認。',
      request
    };
  }

  const member = candidates.rows[0];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pastoralBind = await client.query(
      `UPDATE pastoral_members
       SET line_user_id = $1,
           updated_at = now()
       WHERE id = $2
         AND (coalesce(line_user_id, '') = '' OR line_user_id = $1)
       RETURNING id`,
      [session.line_user_id, member.id]
    );
    if (!pastoralBind.rowCount) {
      const request = await createLineBindingRequest(session, payload, {
        name,
        mobilePhone,
        reason: 'member_bound_to_other_line',
        client
      });
      await client.query('COMMIT');
      return {
        success: true,
        status: 'pending_review',
        message: '此會友資料已綁定其他 LINE 帳號，已建立綁定申請，請等候同工協助確認。',
        request
      };
    }
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
    await client.query(
      `INSERT INTO identity_providers (
         pastoral_member_id, provider_type, provider_user_id, display_name,
         picture_url, email, status, linked_at, last_login_at, updated_at
       )
       SELECT $1, 'LINE', lu.line_user_id, lu.display_name, lu.picture_url,
         lu.metadata->>'email', 'ACTIVE', now(), now(), now()
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
      [member.id, session.line_user_id]
    );
    await recordAuditLog({
      systemKey: 'line_binding',
      entityType: 'pastoral_members',
      entityId: String(member.id),
      action: 'BIND',
      memberId: member.id,
      afterData: {
        lineUserId: session.line_user_id,
        memberAccountId: account.rows[0].member_account_id
      },
      metadata: {
        source: 'liff.bind-member',
        requestId: req.requestId || ''
      },
      ipAddress: getIpAddress(req),
      userAgent: req.get('user-agent') || ''
    }, client);
    await recordLineBindingNotification(client, 'LINE_BIND_SUCCESS', {
      name: member.name,
      email: normalizeText(payload.email),
      bindDatetime: new Date().toISOString(),
      status: 'SENT'
    });
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

async function createLineBindingRequest(session, payload, options) {
  const client = options.client || pool;
  const email = normalizeText(payload.email);
  const result = await client.query(
    `INSERT INTO line_binding_requests (
       line_user_id, display_name, name, zone, mobile, email, status, admin_note, updated_at
     )
     SELECT lu.line_user_id, lu.display_name, $2, $3, $4, $5, 'PENDING', $6, now()
     FROM line_users lu
     WHERE lu.line_user_id = $1
     RETURNING id, status, created_at`,
    [
      session.line_user_id,
      options.name,
      normalizeText(payload.zone),
      options.mobilePhone,
      email,
      `auto:${options.reason}`
    ]
  );
  await recordLineBindingNotification(client, 'LINE_BIND_REQUEST_RECEIVED', {
    name: options.name,
    email,
    bindDatetime: new Date().toISOString(),
    status: email ? 'PENDING' : 'SKIPPED'
  });
  return {
    requestId: result.rows[0]?.id || '',
    status: result.rows[0]?.status || 'PENDING',
    createdAt: result.rows[0]?.created_at || null
  };
}

async function recordLineBindingNotification(client, templateCode, payload) {
  if (!payload.email) return null;
  const rendered = await renderNotification(templateCode, 'EMAIL', {
    Name: payload.name,
    BindDatetime: payload.bindDatetime,
    OfficialWebsiteUrl: ''
  }, client);
  return recordNotificationLog({
    templateCode,
    channel: 'EMAIL',
    recipient: payload.email,
    subject: rendered.subject,
    contentSnapshot: rendered.content,
    status: payload.status || 'PENDING'
  }, client);
}

async function getPortalLinks(session) {
  const me = await getLiffMe(session);
  const visibility = me.member ? ['public', 'members'] : ['public'];
  const [links, menuItems] = await Promise.all([
    pool.query(
    `SELECT title, url, link_type, visibility, sort_order, note
     FROM line_bot_links
     WHERE is_active
       AND visibility = ANY($1::text[])
     ORDER BY sort_order, updated_at DESC`,
      [visibility]
    ),
    getMenuItemsForMember(me, ['MEMBER', 'LEADER', 'EXTERNAL'])
  ]);
  const modules = await pool.query(
    `SELECT module_key, module_name, description, sort_order
     FROM line_bot_module_settings
     WHERE is_enabled
     ORDER BY sort_order, module_key`
  );
  return {
    member: me.member,
    menuItems,
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

async function getLiffMemberCenter(session) {
  const me = await getLiffMe(session);
  if (!me.member) throw unauthorized('尚未綁定會友資料，無法進入會員中心');
  const menuItems = await getMenuItemsForMember(me, ['MEMBER', 'EXTERNAL']);
  return {
    member: me.member,
    lineUser: me.lineUser,
    menuItems
  };
}

async function getLiffLeaderCenter(session) {
  const me = await getLiffMe(session);
  if (!me.member) throw unauthorized('尚未綁定會友資料，無法進入領袖中心');
  const scope = await getLeaderScopeForMember(me.member.memberId);
  if (!scope.isLeader) throw unauthorized('目前帳號沒有領袖中心權限');
  const [attendance, courses, menuItems] = await Promise.all([
    pool.query(
      `SELECT month, total_meetings, attended_count, absent_count, attendance_rate, updated_at
       FROM attendance_summary
       WHERE scope_type = $1
         AND scope_id = $2
       ORDER BY month DESC
       LIMIT 12`,
      [scope.scopeType, scope.scopeId]
    ),
    pool.query(
      `SELECT course_stage, completed_count, required_count, completion_rate, pending_list, updated_at
       FROM course_summary
       WHERE scope_type = $1
         AND scope_id = $2
       ORDER BY course_stage NULLS LAST
       LIMIT 50`,
      [scope.scopeType, scope.scopeId]
    ),
    getMenuItemsForMember(me, ['LEADER', 'EXTERNAL'])
  ]);

  return {
    member: me.member,
    scope,
    menuItems,
    attendanceSummary: attendance.rows.map(row => ({
      month: row.month,
      totalMeetings: Number(row.total_meetings || 0),
      attendedCount: Number(row.attended_count || 0),
      absentCount: Number(row.absent_count || 0),
      attendanceRate: Number(row.attendance_rate || 0),
      updatedAt: row.updated_at
    })),
    courseSummary: courses.rows.map(row => ({
      courseStage: row.course_stage || '',
      completedCount: Number(row.completed_count || 0),
      requiredCount: Number(row.required_count || 0),
      completionRate: Number(row.completion_rate || 0),
      pendingList: Array.isArray(row.pending_list) ? row.pending_list : [],
      updatedAt: row.updated_at
    }))
  };
}

async function getMenuItemsForMember(me, menuTypes) {
  const bindStatus = me.member ? 'BOUND' : 'UNBOUND';
  const leaderScope = me.member ? await getLeaderScopeForMember(me.member.memberId) : { isLeader: false };
  const result = await pool.query(
    `SELECT menu_code, menu_name, menu_type, target_url, required_role,
       required_bind_status, display_order, icon, open_type, metadata
     FROM menu_items
     WHERE enabled
       AND menu_type = ANY($1::text[])
       AND required_bind_status IN ('ANY', $2)
     ORDER BY display_order, menu_code`,
    [menuTypes, bindStatus]
  );
  const configKeys = [...new Set(result.rows.map(row => row.metadata?.configKey).filter(Boolean))];
  const configValues = configKeys.length ? await getConfigValues(configKeys, { revealSecrets: true }) : {};
  return result.rows
    .filter(row => row.menu_type !== 'LEADER' || leaderScope.isLeader)
    .map(row => mapMenuItem(row, configValues));
}

async function getLeaderScopeForMember(memberId) {
  const result = await pool.query(
    `SELECT pm.id AS member_id, pt.name AS title_name,
       pgl.group_id AS leader_group_id,
       pg.name AS leader_group_name,
       pg.path AS leader_group_path,
       pga.group_id AS member_group_id,
       mga.name AS member_group_name,
       mga.path AS member_group_path,
       rule.scope_type
     FROM pastoral_members pm
     LEFT JOIN pastoral_titles pt ON pt.id = pm.title_id
     LEFT JOIN line_leader_scope_rules rule ON rule.title_name = pt.name AND rule.enabled
     LEFT JOIN pastoral_group_leaders pgl ON pgl.member_id = pm.id AND pgl.is_current
     LEFT JOIN pastoral_groups pg ON pg.id = pgl.group_id
     LEFT JOIN pastoral_member_group_assignments pga ON pga.member_id = pm.id AND pga.is_current
     LEFT JOIN pastoral_groups mga ON mga.id = pga.group_id
     WHERE pm.id = $1
       AND pm.is_active
     LIMIT 1`,
    [memberId]
  );
  const row = result.rows[0];
  if (!row || !row.scope_type) {
    return { isLeader: false, scopeType: 'SELF', scopeId: String(memberId), titleName: row?.title_name || '' };
  }
  const scopeType = row.scope_type;
  const groupId = row.leader_group_id || row.member_group_id || memberId;
  const scopeId = scopeType === 'GLOBAL'
    ? 'GLOBAL'
    : scopeType === 'SELF'
      ? String(memberId)
      : String(groupId);
  return {
    isLeader: true,
    memberId,
    titleName: row.title_name || '',
    scopeType,
    scopeId,
    groupId: groupId === memberId ? null : groupId,
    groupName: row.leader_group_name || row.member_group_name || '',
    groupPath: row.leader_group_path || row.member_group_path || ''
  };
}

function mapMenuItem(row, configValues = {}) {
  const metadata = row.metadata || {};
  const configTarget = metadata.configKey ? configValues[metadata.configKey] : '';
  return {
    menuCode: row.menu_code,
    menuName: row.menu_name,
    menuType: row.menu_type,
    targetUrl: configTarget || row.target_url || '',
    requiredRole: row.required_role || '',
    requiredBindStatus: row.required_bind_status,
    displayOrder: Number(row.display_order || 0),
    icon: row.icon || '',
    openType: row.open_type,
    metadata
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

function getPhoneVariants(value) {
  const phone = normalizeDigits(value);
  const variants = new Set([phone]);
  if (phone.startsWith('09') && phone.length === 10) {
    variants.add(phone.slice(1));
    variants.add(`886${phone.slice(1)}`);
  } else if (phone.startsWith('9') && phone.length === 9) {
    variants.add(`0${phone}`);
    variants.add(`886${phone}`);
  } else if (phone.startsWith('8869') && phone.length === 12) {
    variants.add(`0${phone.slice(3)}`);
    variants.add(phone.slice(3));
  }
  return [...variants].filter(Boolean);
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
