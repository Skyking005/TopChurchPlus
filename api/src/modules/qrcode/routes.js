const { pool } = require('../../db');
const { recordDomainEvent } = require('../../shared/cross-system');
const { assertFeatureEditable, assertFeatureReadable } = require('../../shared/permissions');
const { parseUser } = require('../../shared/users');

function registerQrcodeRoutes(app) {
  app.get('/qrcode/options', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'qrcode');
      res.json(await getOptions());
    } catch (err) {
      next(err);
    }
  });

  app.get('/qrcode/events', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'qrcode');
      res.json(await getEvents(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.get('/qrcode/events/active', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'qrcode');
      res.json(await getEvents({ status: 'open', activeOnly: '1' }));
    } catch (err) {
      next(err);
    }
  });

  app.get('/qrcode/events/:eventId', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'qrcode');
      res.json(await getEventDetail(req.params.eventId));
    } catch (err) {
      next(err);
    }
  });

  app.post('/qrcode/events', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'qrcode');
      res.json(await saveEvent(null, req.body.event || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.put('/qrcode/events/:eventId', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'qrcode');
      res.json(await saveEvent(req.params.eventId, req.body.event || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.post('/qrcode/events/:eventId/checkins', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'qrcode');
      res.json(await checkInMember(req.params.eventId, req.body.qrPayload, currentUser));
    } catch (err) {
      next(err);
    }
  });
}

async function getOptions() {
  const { rows } = await pool.query(
    `SELECT id, name, church_type, sort_order
     FROM churches
     WHERE is_active
     ORDER BY sort_order, id`
  );
  return {
    churches: rows.map(row => ({
      churchId: row.id,
      churchName: row.name,
      churchType: row.church_type,
      sortOrder: row.sort_order
    }))
  };
}

async function getEvents(query = {}) {
  const status = String(query.status || '').trim();
  const keyword = String(query.keyword || '').trim().toLowerCase();
  const activeOnly = String(query.activeOnly || '') === '1';
  const values = [];
  const where = [];

  if (status) {
    values.push(status);
    where.push(`e.status = $${values.length}`);
  }
  if (keyword) {
    values.push(`%${keyword}%`);
    where.push(`(lower(e.event_name) LIKE $${values.length} OR lower(e.event_code) LIKE $${values.length})`);
  }
  if (activeOnly) {
    where.push(`(e.checkin_starts_at IS NULL OR e.checkin_starts_at <= now())`);
    where.push(`(e.checkin_ends_at IS NULL OR e.checkin_ends_at >= now())`);
  }

  const { rows } = await pool.query(
    `SELECT e.*, c.name AS church_name, count(ci.checkin_id)::int AS checkin_count
     FROM qrcode_events e
     LEFT JOIN churches c ON c.id = e.church_id
     LEFT JOIN qrcode_checkins ci ON ci.event_id = e.event_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     GROUP BY e.event_id, c.name
     ORDER BY e.status = 'open' DESC, e.event_date DESC NULLS LAST, e.created_at DESC
     LIMIT 200`,
    values
  );
  return rows.map(toEvent);
}

async function getEventDetail(eventId) {
  const eventResult = await pool.query(
    `SELECT e.*, c.name AS church_name
     FROM qrcode_events e
     LEFT JOIN churches c ON c.id = e.church_id
     WHERE e.event_id = $1`,
    [eventId]
  );
  const event = eventResult.rows[0];
  if (!event) throw new Error('找不到 QRCode 報到活動');

  const checkinsResult = await pool.query(
    `SELECT ci.*, pm.name AS member_name, pm.line_user_id, ch.name AS church_name,
            mc.name AS category_name, pc.mobile_phone
     FROM qrcode_checkins ci
     JOIN pastoral_members pm ON pm.id = ci.member_id
     LEFT JOIN churches ch ON ch.id = pm.church_id
     LEFT JOIN membership_categories mc ON mc.code = pm.membership_category_code
     LEFT JOIN pastoral_member_contacts pc ON pc.member_id = pm.id
     WHERE ci.event_id = $1
     ORDER BY ci.checked_at DESC`,
    [eventId]
  );

  return {
    event: toEvent(event),
    checkins: checkinsResult.rows.map(toCheckin),
    stats: { checkinCount: checkinsResult.rowCount }
  };
}

async function saveEvent(eventId, event, currentUser) {
  const normalized = normalizeEvent(event);
  const id = eventId || event.eventId || null;
  const result = await pool.query(
    `INSERT INTO qrcode_events (
       event_id, event_code, event_name, church_id, event_date,
       checkin_starts_at, checkin_ends_at, status, note, created_by_staff_id, updated_at
     ) VALUES (
       COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, now()
     )
     ON CONFLICT (event_id) DO UPDATE SET
       event_code = EXCLUDED.event_code,
       event_name = EXCLUDED.event_name,
       church_id = EXCLUDED.church_id,
       event_date = EXCLUDED.event_date,
       checkin_starts_at = EXCLUDED.checkin_starts_at,
       checkin_ends_at = EXCLUDED.checkin_ends_at,
       status = EXCLUDED.status,
       note = EXCLUDED.note,
       updated_at = now()
     RETURNING *`,
    [
      id,
      normalized.eventCode,
      normalized.eventName,
      normalized.churchId,
      normalized.eventDate,
      normalized.checkinStartsAt,
      normalized.checkinEndsAt,
      normalized.status,
      normalized.note,
      currentUser.staffId ? String(currentUser.staffId) : null
    ]
  );

  const saved = result.rows[0];
  await recordDomainEvent({
    eventType: id ? 'qrcode.event_updated' : 'qrcode.event_created',
    systemKey: 'qrcode',
    entityType: 'qrcode_event',
    entityId: saved.event_id,
    currentUser: toDomainEventUser(currentUser)
  });
  return { success: true, message: 'QRCode 報到活動已儲存', event: toEvent(saved) };
}

async function checkInMember(eventId, qrPayload, currentUser) {
  const event = await getOpenEvent(eventId);
  const member = await resolveMemberFromQrPayload(qrPayload);
  const result = await pool.query(
    `INSERT INTO qrcode_checkins (
       event_id, member_id, qr_payload, checked_in_by_staff_id, checked_in_by_name
     ) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (event_id, member_id) DO NOTHING
     RETURNING *`,
    [
      event.event_id,
      member.id,
      String(qrPayload || ''),
      currentUser.staffId ? String(currentUser.staffId) : null,
      currentUser.name || null
    ]
  );

  if (!result.rowCount) {
    const existing = await pool.query(
      `SELECT ci.*, pm.name AS member_name, ch.name AS church_name, mc.name AS category_name, pc.mobile_phone
       FROM qrcode_checkins ci
       JOIN pastoral_members pm ON pm.id = ci.member_id
       LEFT JOIN churches ch ON ch.id = pm.church_id
       LEFT JOIN membership_categories mc ON mc.code = pm.membership_category_code
       LEFT JOIN pastoral_member_contacts pc ON pc.member_id = pm.id
       WHERE ci.event_id = $1 AND ci.member_id = $2`,
      [event.event_id, member.id]
    );
    return {
      success: true,
      duplicate: true,
      message: `${member.name} 已完成報到`,
      checkin: toCheckin(existing.rows[0])
    };
  }

  await recordDomainEvent({
    eventType: 'qrcode.member_checked_in',
    systemKey: 'qrcode',
    entityType: 'qrcode_event',
    entityId: event.event_id,
    currentUser: toDomainEventUser(currentUser),
    payload: { memberId: member.id }
  });

  return {
    success: true,
    duplicate: false,
    message: `${member.name} 報到完成`,
    checkin: toCheckin({
      ...result.rows[0],
      member_name: member.name,
      church_name: member.church_name,
      category_name: member.category_name,
      mobile_phone: member.mobile_phone
    })
  };
}

async function getOpenEvent(eventId) {
  const { rows } = await pool.query(
    `SELECT *
     FROM qrcode_events
     WHERE event_id = $1
       AND status = 'open'
       AND (checkin_starts_at IS NULL OR checkin_starts_at <= now())
       AND (checkin_ends_at IS NULL OR checkin_ends_at >= now())`,
    [eventId]
  );
  if (!rows[0]) throw new Error('此 QRCode 報到活動未開放或已結束');
  return rows[0];
}

async function resolveMemberFromQrPayload(qrPayload) {
  const parsed = parseQrPayload(qrPayload);
  const values = [];
  const where = [];
  if (parsed.memberId) {
    values.push(parsed.memberId);
    where.push(`pm.id = $${values.length}`);
  }
  if (parsed.lineUserId) {
    values.push(parsed.lineUserId);
    where.push(`pm.line_user_id = $${values.length}`);
  }
  if (!where.length) throw new Error('QRCode 內容無法辨識會友資料');

  const { rows } = await pool.query(
    `SELECT pm.id, pm.name, pm.line_user_id, ch.name AS church_name,
            mc.name AS category_name, pc.mobile_phone
     FROM pastoral_members pm
     LEFT JOIN churches ch ON ch.id = pm.church_id
     LEFT JOIN membership_categories mc ON mc.code = pm.membership_category_code
     LEFT JOIN pastoral_member_contacts pc ON pc.member_id = pm.id
     WHERE pm.is_active
       AND (${where.join(' OR ')})
     LIMIT 1`,
    values
  );
  if (!rows[0]) throw new Error('找不到此 QRCode 對應的會友資料');
  return rows[0];
}

function parseQrPayload(qrPayload) {
  const text = String(qrPayload || '').trim();
  if (!text) return {};
  if (/^\d+$/.test(text)) return { memberId: Number(text) };
  const memberMatch = text.match(/^topchurchplus:member:(\d+)$/i);
  if (memberMatch) return { memberId: Number(memberMatch[1]) };

  try {
    const data = JSON.parse(text);
    return {
      memberId: data.memberId || data.member_id || data.id || null,
      lineUserId: data.lineUserId || data.line_user_id || data.lineId || null
    };
  } catch (err) {
    return { lineUserId: text };
  }
}

function normalizeEvent(event) {
  const eventName = String(event.eventName || event.event_name || '').trim();
  if (!eventName) throw new Error('請填寫活動名稱');
  return {
    eventCode: String(event.eventCode || event.event_code || '').trim() || createEventCode(),
    eventName,
    churchId: event.churchId || event.church_id || null,
    eventDate: event.eventDate || event.event_date || null,
    checkinStartsAt: event.checkinStartsAt || event.checkin_starts_at || null,
    checkinEndsAt: event.checkinEndsAt || event.checkin_ends_at || null,
    status: ['open', 'closed', 'draft'].includes(event.status) ? event.status : 'open',
    note: String(event.note || '').trim()
  };
}

function createEventCode() {
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `QR${stamp}${suffix}`;
}

function toDomainEventUser(currentUser) {
  const staffId = String(currentUser && currentUser.staffId ? currentUser.staffId : '').trim();
  return {
    ...currentUser,
    staffId: /^\d+$/.test(staffId) ? staffId : null
  };
}

function toEvent(row) {
  return {
    eventId: row.event_id,
    eventCode: row.event_code,
    eventName: row.event_name,
    churchId: row.church_id,
    churchName: row.church_name,
    eventDate: row.event_date,
    checkinStartsAt: row.checkin_starts_at,
    checkinEndsAt: row.checkin_ends_at,
    status: row.status,
    note: row.note,
    checkinCount: Number(row.checkin_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toCheckin(row) {
  return {
    checkinId: row.checkin_id,
    eventId: row.event_id,
    memberId: row.member_id,
    memberName: row.member_name,
    churchName: row.church_name,
    categoryName: row.category_name,
    mobilePhone: row.mobile_phone,
    checkedAt: row.checked_at,
    checkedInByName: row.checked_in_by_name,
    note: row.note
  };
}

module.exports = { registerQrcodeRoutes };
