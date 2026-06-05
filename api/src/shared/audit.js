const { pool } = require('../db');

function getStaffId(user) {
  return user && user.staffId ? String(user.staffId) : null;
}

function normalizeJson(value) {
  return value && typeof value === 'object' ? value : null;
}

async function recordAuditLog(entry, client = pool) {
  if (!entry) return null;
  const systemKey = normalizeRequired(entry.systemKey, 'systemKey');
  const entityType = normalizeRequired(entry.entityType, 'entityType');
  const entityId = normalizeRequired(entry.entityId, 'entityId');
  const action = normalizeRequired(entry.action, 'action');
  const currentUser = entry.currentUser || {};

  const { rows } = await client.query(
    `INSERT INTO audit_logs (
       staff_id, member_id, system_key, entity_type, entity_id, action,
       before_data, after_data, metadata, ip_address, user_agent
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11)
     RETURNING audit_id`,
    [
      getStaffId(currentUser),
      entry.memberId || null,
      systemKey,
      entityType,
      entityId,
      action,
      stringifyJson(entry.beforeData),
      stringifyJson(entry.afterData),
      JSON.stringify(normalizeJson(entry.metadata) || {}),
      entry.ipAddress || null,
      entry.userAgent || null
    ]
  );
  return rows[0].audit_id;
}

function stringifyJson(value) {
  const normalized = normalizeJson(value);
  return normalized ? JSON.stringify(normalized) : null;
}

function normalizeRequired(value, fieldName) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`Missing required audit field: ${fieldName}`);
  return text;
}

module.exports = {
  recordAuditLog
};
