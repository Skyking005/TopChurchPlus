const { pool } = require('../db');

function getStaffId(user) {
  return user && user.staffId ? String(user.staffId) : null;
}

function normalizeJson(value) {
  return value && typeof value === 'object' ? value : {};
}

async function createEntityLink(link, client = pool) {
  const metadata = normalizeJson(link.metadata);
  const result = await client.query(
    `INSERT INTO entity_links (
       source_system, source_type, source_id,
       target_system, target_type, target_id,
       link_type, metadata, created_by_staff_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
     ON CONFLICT (source_system, source_type, source_id, target_system, target_type, target_id, link_type)
     DO UPDATE SET
       metadata = entity_links.metadata || EXCLUDED.metadata
     RETURNING *`,
    [
      normalizeRequired(link.sourceSystem, 'sourceSystem'),
      normalizeRequired(link.sourceType, 'sourceType'),
      normalizeRequired(link.sourceId, 'sourceId'),
      normalizeRequired(link.targetSystem, 'targetSystem'),
      normalizeRequired(link.targetType, 'targetType'),
      normalizeRequired(link.targetId, 'targetId'),
      normalizeRequired(link.linkType, 'linkType'),
      JSON.stringify(metadata),
      getStaffId(link.currentUser)
    ]
  );
  return result.rows[0];
}

async function recordDomainEvent(event, client = pool) {
  const payload = normalizeJson(event.payload);
  const result = await client.query(
    `INSERT INTO domain_events (
       event_type, system_key, entity_type, entity_id, payload, created_by_staff_id
     ) VALUES ($1,$2,$3,$4,$5::jsonb,$6)
     RETURNING *`,
    [
      normalizeRequired(event.eventType, 'eventType'),
      normalizeRequired(event.systemKey, 'systemKey'),
      normalizeRequired(event.entityType, 'entityType'),
      normalizeRequired(event.entityId, 'entityId'),
      JSON.stringify(payload),
      getStaffId(event.currentUser)
    ]
  );
  return result.rows[0];
}

async function getEntityLinks(entity, client = pool) {
  const system = normalizeRequired(entity.system, 'system');
  const type = normalizeRequired(entity.type, 'type');
  const id = normalizeRequired(entity.id, 'id');
  const { rows } = await client.query(
    `SELECT *
     FROM entity_links
     WHERE (source_system = $1 AND source_type = $2 AND source_id = $3)
        OR (target_system = $1 AND target_type = $2 AND target_id = $3)
     ORDER BY created_at DESC, entity_link_id DESC`,
    [system, type, id]
  );
  return rows.map(toEntityLink);
}

function toEntityLink(row) {
  return {
    entityLinkId: row.entity_link_id,
    sourceSystem: row.source_system,
    sourceType: row.source_type,
    sourceId: row.source_id,
    targetSystem: row.target_system,
    targetType: row.target_type,
    targetId: row.target_id,
    linkType: row.link_type,
    metadata: row.metadata || {},
    createdByStaffId: row.created_by_staff_id,
    createdAt: row.created_at
  };
}

function normalizeRequired(value, fieldName) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`跨系統關聯缺少 ${fieldName}`);
  return text;
}

module.exports = {
  createEntityLink,
  getEntityLinks,
  recordDomainEvent
};
