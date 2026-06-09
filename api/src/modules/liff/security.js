const DEFAULT_SESSION_DAYS = 7;
const MAX_SESSION_DAYS = 30;
const ORIGIN_MODES = new Set(['monitor', 'enforce']);
const SESSION_CLIENT_BINDING_MODES = new Set(['monitor', 'enforce']);

function normalizeLiffSecurityConfig(value = {}) {
  const sessionDays = Number(value.sessionDays);
  const allowedOrigins = Array.isArray(value.allowedOrigins)
    ? value.allowedOrigins.map(normalizeOrigin).filter(Boolean)
    : String(value.allowedOrigins || '')
        .split(/\r?\n|,/)
        .map(normalizeOrigin)
        .filter(Boolean);

  return {
    sessionDays: Number.isFinite(sessionDays)
      ? Math.min(MAX_SESSION_DAYS, Math.max(1, Math.trunc(sessionDays)))
      : DEFAULT_SESSION_DAYS,
    requireHttps: value.requireHttps === true,
    originMode: ORIGIN_MODES.has(value.originMode) ? value.originMode : 'monitor',
    sessionClientBinding: SESSION_CLIENT_BINDING_MODES.has(value.sessionClientBinding)
      ? value.sessionClientBinding
      : 'monitor',
    allowedOrigins: [...new Set(allowedOrigins)]
  };
}

function getLiffSecurityReadiness(metadata = {}) {
  const config = normalizeLiffSecurityConfig(metadata.liffSecurity || {});
  const warnings = [];

  if (!config.requireHttps) warnings.push('LIFF 入口尚未設定強制 HTTPS。');
  if (config.originMode === 'monitor') warnings.push('Origin 檢查目前為監控模式，不會阻擋可疑來源。');
  if (config.sessionClientBinding === 'monitor') warnings.push('Session 裝置/IP 檢查目前為監控模式，不會阻擋裝置變更。');
  if (!config.allowedOrigins.length) warnings.push('尚未設定允許來源清單，監控時會以同源請求為主。');

  return {
    ...config,
    hardened: config.requireHttps
      && config.originMode === 'enforce'
      && config.sessionClientBinding === 'enforce'
      && config.allowedOrigins.length > 0,
    warnings
  };
}

function assertLiffRequestAllowed(req, security) {
  const issues = getLiffRequestIssues(req, security);
  const blocking = issues.filter(issue => issue.blocking);
  if (blocking.length) {
    const error = new Error(blocking[0].message);
    error.status = 403;
    throw error;
  }
  return issues;
}

function assertLiffSessionAllowed(req, sessionMetadata = {}, security) {
  const current = getLiffRequestFingerprint(req);
  const original = sessionMetadata.fingerprint || {};
  const issues = [];

  if (security.sessionClientBinding === 'enforce') {
    if (original.userAgentHash && original.userAgentHash !== current.userAgentHash) {
      issues.push({ code: 'user_agent_changed', message: 'LIFF Session 裝置資訊已變更，請重新登入。', blocking: true });
    }
    if (original.ipPrefix && current.ipPrefix && original.ipPrefix !== current.ipPrefix) {
      issues.push({ code: 'ip_changed', message: 'LIFF Session 網路位置已變更，請重新登入。', blocking: true });
    }
  }

  const blocking = issues.filter(issue => issue.blocking);
  if (blocking.length) {
    const error = new Error(blocking[0].message);
    error.status = 401;
    throw error;
  }
  return issues;
}

function getLiffRequestIssues(req, security) {
  const issues = [];
  const origin = normalizeOrigin(req.get('origin') || '');
  const hostOrigin = getRequestOrigin(req);

  if (security.requireHttps && !isHttpsRequest(req)) {
    issues.push({ code: 'https_required', message: 'LIFF 入口需要使用 HTTPS。', blocking: true });
  }

  if (origin) {
    const allowed = security.allowedOrigins.length
      ? security.allowedOrigins.includes(origin)
      : origin === hostOrigin;
    if (!allowed) {
      issues.push({
        code: 'origin_not_allowed',
        message: 'LIFF 請求來源不在允許清單中。',
        blocking: security.originMode === 'enforce'
      });
    }
  }

  return issues;
}

function getLiffRequestFingerprint(req) {
  const userAgent = req.get('user-agent') || '';
  return {
    userAgentHash: require('crypto').createHash('sha256').update(userAgent).digest('hex'),
    ipPrefix: getIpPrefix(getIpAddress(req))
  };
}

function isHttpsRequest(req) {
  return req.secure || String(req.get('x-forwarded-proto') || '').split(',')[0].trim() === 'https';
}

function getRequestOrigin(req) {
  const protocol = isHttpsRequest(req) ? 'https' : 'http';
  return normalizeOrigin(`${protocol}://${req.get('host') || ''}`);
}

function normalizeOrigin(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    return `${url.protocol}//${url.host}`;
  } catch (err) {
    return '';
  }
}

function getIpAddress(req) {
  const forwarded = req.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || '';
}

function getIpPrefix(ip) {
  const value = String(ip || '').replace(/^::ffff:/, '');
  if (!value) return '';
  if (value.includes(':')) return value.split(':').slice(0, 4).join(':');
  const parts = value.split('.');
  return parts.length === 4 ? parts.slice(0, 3).join('.') : value;
}

module.exports = {
  assertLiffRequestAllowed,
  assertLiffSessionAllowed,
  getLiffRequestFingerprint,
  getLiffSecurityReadiness,
  normalizeLiffSecurityConfig
};
