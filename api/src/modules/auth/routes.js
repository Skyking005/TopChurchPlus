const crypto = require('crypto');
const net = require('net');

const { pool, tx } = require('../../db');
const { FEATURE_ACCESS_RANK } = require('../core/catalog');

function registerAuthRoutes(app) {
  app.post('/login', async (req, res, next) => {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const deviceType = req.body.deviceType === 'mobile' ? 'mobile' : 'desktop';
      const context = buildLoginContext(req);
      if (!email) throw new Error('請輸入電子信箱');

      const { rows } = await pool.query('SELECT * FROM accounts WHERE lower(email) = $1', [email]);
      const user = rows[0];
      if (!user) {
        await recordLoginEvent({ email, eventType: 'failed', context, metadata: { reason: 'unknown_email' } });
        throw new Error('此電子信箱沒有系統使用權限');
      }

      const trust = await getTrustedLoginDevice(user.staff_id, context);
      if (!trust.isTrusted) {
        const challenge = await createLoginVerificationChallenge(user, email, deviceType, context, trust.reason);
        await recordLoginEvent({
          staffId: user.staff_id,
          email,
          eventType: 'challenge_required',
          context,
          metadata: { reason: trust.reason }
        });
        return res.json({
          requiresVerification: true,
          verificationId: challenge.verificationId,
          verificationCode: challenge.verificationCode,
          email,
          expiresAt: challenge.expiresAt,
          reason: trust.reason,
          message: '偵測到陌生登入，已寄送驗證碼。'
        });
      }

      await rememberTrustedLoginDevice(user.staff_id, deviceType, context);
      await recordLoginEvent({ staffId: user.staff_id, email, eventType: 'success', context });
      res.json(await buildLoginUser(user, email, deviceType));
    } catch (err) {
      next(err);
    }
  });

  app.post('/login/verify', async (req, res, next) => {
    try {
      const verificationId = String(req.body.verificationId || '').trim();
      const code = String(req.body.code || '').trim();
      const deviceType = req.body.deviceType === 'mobile' ? 'mobile' : 'desktop';
      const context = buildLoginContext(req);
      if (!verificationId || !code) throw new Error('請輸入驗證碼');

      const { rows } = await pool.query(
        `SELECT c.*, a.email AS account_email, a.name, a.position, a.role, a.staff_id
         FROM login_verification_challenges c
         JOIN accounts a ON a.staff_id = c.staff_id
         WHERE c.id = $1`,
        [verificationId]
      );
      const challenge = rows[0];
      if (!challenge) throw new Error('驗證流程不存在或已失效');
      if (challenge.verified_at) throw new Error('此驗證碼已使用，請重新登入');
      if (new Date(challenge.expires_at).getTime() < Date.now()) throw new Error('驗證碼已過期，請重新登入');
      if (challenge.attempts >= 5) throw new Error('驗證碼錯誤次數過多，請重新登入');

      const email = String(challenge.account_email || challenge.email || '').toLowerCase();
      const isValid = challenge.code_hash === hashLoginCode(verificationId, code);
      if (!isValid) {
        await pool.query(
          'UPDATE login_verification_challenges SET attempts = attempts + 1 WHERE id = $1',
          [verificationId]
        );
        await recordLoginEvent({
          staffId: challenge.staff_id,
          email,
          eventType: 'challenge_failed',
          context,
          metadata: { verificationId }
        });
        throw new Error('驗證碼錯誤');
      }

      await tx(async client => {
        await client.query(
          'UPDATE login_verification_challenges SET verified_at = now() WHERE id = $1',
          [verificationId]
        );
        await rememberTrustedLoginDevice(challenge.staff_id, deviceType, context, client);
      });

      await recordLoginEvent({
        staffId: challenge.staff_id,
        email,
        eventType: 'challenge_success',
        context,
        metadata: { verificationId }
      });

      res.json(await buildLoginUser(challenge, email, deviceType));
    } catch (err) {
      next(err);
    }
  });

  app.post('/counter/pin-login', async (req, res, next) => {
    try {
      const pinCode = String(req.body.pinCode || '').trim().toUpperCase();
      const context = buildLoginContext(req);
      if (!/^[A-Z0-9]{6}$/.test(pinCode)) throw new Error('PIN Code 格式錯誤');

      const week = getTaipeiSundayWeekRange();
      const { rows } = await pool.query(
        `SELECT *
         FROM counter_pin_codes
         WHERE pin_code = $1
           AND is_active
           AND valid_from <= now()
           AND valid_until > now()
         LIMIT 1`,
        [pinCode]
      );
      const pin = rows[0];
      if (!pin) {
        await recordLoginEvent({
          email: 'counter-pin',
          eventType: 'failed',
          context,
          metadata: { loginMode: 'counter_pin', reason: 'invalid_pin', weekStart: week.validFrom.toISOString() }
        });
        throw new Error('PIN Code 錯誤或已過期');
      }

      await pool.query(
        `UPDATE counter_pin_codes
         SET last_used_at = now(), usage_count = usage_count + 1, updated_at = now()
         WHERE pin_id = $1`,
        [pin.pin_id]
      );
      await recordLoginEvent({
        email: 'counter-pin',
        eventType: 'success',
        context,
        metadata: { loginMode: 'counter_pin', pinId: pin.pin_id, weekStart: pin.valid_from }
      });

      res.json({
        staffId: null,
        email: '',
        name: '志工櫃台',
        position: '',
        role: '義工',
        roles: ['義工'],
        featurePermissions: { counter: 'edit', qrcode: 'edit', qt: 'edit' },
        featureUsage: {},
        deviceType: 'desktop',
        workspaceMode: 'counter',
        pinValidUntil: pin.valid_until
      });
    } catch (err) {
      next(err);
    }
  });
}

async function buildLoginUser(user, email, deviceType) {
  const roles = await getAccountRoles(user.staff_id, user.role);
  const featurePermissions = await getEffectiveFeaturePermissions({ roles, role: user.role });
  const featureUsage = await getFeatureUsageSummary(user.staff_id);

  return {
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
  };
}

async function getAccountRoles(staffId, fallbackRole) {
  const { rows } = await pool.query(
    'SELECT role FROM account_roles WHERE staff_id = $1 ORDER BY role',
    [staffId]
  );
  return normalizeRoles(rows.map(row => row.role), fallbackRole);
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

function buildLoginContext(req) {
  const body = req.body || {};
  const deviceId = String(body.deviceId || '').trim();
  const clientIp = normalizeIp(body.clientIp);
  return {
    deviceId,
    deviceIdHash: deviceId ? hashSecurityValue(deviceId) : null,
    deviceLabel: String(body.deviceLabel || '').trim().slice(0, 120),
    deviceType: body.deviceType === 'mobile' ? 'mobile' : 'desktop',
    userAgent: String(body.userAgent || req.get('user-agent') || '').trim().slice(0, 500),
    clientIp,
    clientIpHash: clientIp ? hashSecurityValue(clientIp) : null,
    apiIp: normalizeIp(getRequestIp(req))
  };
}

async function getTrustedLoginDevice(staffId, context) {
  if (!context.deviceIdHash) return { isTrusted: false, reason: 'missing_device_id' };

  const { rows } = await pool.query(
    `SELECT *
     FROM trusted_login_devices
     WHERE staff_id = $1
       AND device_id_hash = $2
       AND is_active
     LIMIT 1`,
    [String(staffId), context.deviceIdHash]
  );
  const device = rows[0];
  if (!device) return { isTrusted: false, reason: 'new_device' };
  if (context.clientIpHash && device.last_client_ip_hash && device.last_client_ip_hash !== context.clientIpHash) {
    return { isTrusted: false, reason: 'new_ip' };
  }
  return { isTrusted: true, reason: 'trusted' };
}

async function createLoginVerificationChallenge(user, email, deviceType, context, reason) {
  const verificationCode = String(crypto.randomInt(100000, 1000000));
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await pool.query(
    `INSERT INTO login_verification_challenges (
       id, staff_id, email, code_hash, device_id_hash, device_label, device_type,
       user_agent, client_ip, client_ip_hash, api_ip, reason, expires_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      id,
      String(user.staff_id),
      email,
      hashLoginCode(id, verificationCode),
      context.deviceIdHash,
      context.deviceLabel || null,
      deviceType,
      context.userAgent || null,
      context.clientIp,
      context.clientIpHash,
      context.apiIp,
      reason,
      expiresAt
    ]
  );
  return { verificationId: id, verificationCode, expiresAt };
}

async function rememberTrustedLoginDevice(staffId, deviceType, context, client = pool) {
  if (!context.deviceIdHash) return;
  await client.query(
    `INSERT INTO trusted_login_devices (
       staff_id, device_id_hash, device_label, device_type, user_agent,
       last_client_ip, last_client_ip_hash, last_api_ip, last_seen_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now(),now())
     ON CONFLICT (staff_id, device_id_hash) DO UPDATE SET
       device_label = EXCLUDED.device_label,
       device_type = EXCLUDED.device_type,
       user_agent = EXCLUDED.user_agent,
       last_client_ip = COALESCE(EXCLUDED.last_client_ip, trusted_login_devices.last_client_ip),
       last_client_ip_hash = COALESCE(EXCLUDED.last_client_ip_hash, trusted_login_devices.last_client_ip_hash),
       last_api_ip = EXCLUDED.last_api_ip,
       last_seen_at = now(),
       updated_at = now(),
       is_active = true,
       revoked_at = NULL`,
    [
      String(staffId),
      context.deviceIdHash,
      context.deviceLabel || null,
      deviceType,
      context.userAgent || null,
      context.clientIp,
      context.clientIpHash,
      context.apiIp
    ]
  );
}

async function recordLoginEvent({ staffId = null, email, eventType, context, metadata = {} }) {
  await pool.query(
    `INSERT INTO login_events (
       staff_id, email, event_type, device_id_hash, device_label, device_type,
       user_agent, client_ip, api_ip, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
    [
      staffId ? String(staffId) : null,
      String(email || '').toLowerCase(),
      eventType,
      context.deviceIdHash,
      context.deviceLabel || null,
      context.deviceType || null,
      context.userAgent || null,
      context.clientIp,
      context.apiIp,
      JSON.stringify(metadata && typeof metadata === 'object' ? metadata : {})
    ]
  );
}

function normalizeRoles(roles, fallbackRole) {
  const values = Array.isArray(roles) ? roles : [];
  const normalized = values
    .concat(fallbackRole || [])
    .map(role => String(role || '').trim())
    .filter(Boolean);
  return [...new Set(normalized)];
}

function hashLoginCode(verificationId, code) {
  return hashSecurityValue(`${verificationId}:${String(code || '').trim()}`);
}

function hashSecurityValue(value) {
  const secret = process.env.API_KEY || 'topchurch-local-secret';
  return crypto.createHmac('sha256', secret).update(String(value)).digest('hex');
}

function getRequestIp(req) {
  const forwarded = String(req.get('x-forwarded-for') || '').split(',')[0].trim();
  return forwarded || req.get('x-real-ip') || req.ip || req.socket?.remoteAddress || '';
}

function normalizeIp(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const cleaned = text.replace(/^::ffff:/, '');
  if (cleaned === '::1') return '127.0.0.1';
  return net.isIP(cleaned) ? cleaned : null;
}

function getTaipeiSundayWeekRange(now = new Date()) {
  const taipeiNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const y = taipeiNow.getUTCFullYear();
  const m = taipeiNow.getUTCMonth();
  const d = taipeiNow.getUTCDate();
  const start = new Date(Date.UTC(y, m, d));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return {
    validFrom: new Date(start.getTime() - 8 * 60 * 60 * 1000),
    validUntil: new Date(end.getTime() - 8 * 60 * 60 * 1000)
  };
}

module.exports = { registerAuthRoutes };
