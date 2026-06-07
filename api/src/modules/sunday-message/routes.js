const { pool, tx } = require('../../db');
const { recordAuditLog } = require('../../shared/audit');
const { assertDesktop, hasRole, normalizeRoles, parseUser } = require('../../shared/users');

function registerSundayMessageRoutes(app) {
  app.get('/sunday-messages/options', async (req, res, next) => {
    try {
      await assertSundayMessageReadable(parseUser(req));
      res.json(await getSundayMessageOptions());
    } catch (err) {
      next(err);
    }
  });

  app.get('/sunday-messages', async (req, res, next) => {
    try {
      await assertSundayMessageReadable(parseUser(req));
      res.json(await getSundayMessages(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.get('/sunday-messages/:messageId', async (req, res, next) => {
    try {
      await assertSundayMessageReadable(parseUser(req));
      res.json(await getSundayMessageDetail(req.params.messageId));
    } catch (err) {
      next(err);
    }
  });

  app.post('/sunday-messages', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertSundayMessageEditable(currentUser);
      res.json(await saveSundayMessage(null, req.body.message || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.put('/sunday-messages/:messageId', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertSundayMessageEditable(currentUser);
      res.json(await saveSundayMessage(req.params.messageId, req.body.message || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.put('/sunday-messages/:messageId/shares', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertSundayMessageEditable(currentUser);
      res.json(await saveSundayMessageShares(req.params.messageId, req.body.shares || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.delete('/sunday-messages/:messageId', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertSundayMessageEditable(currentUser);
      res.json(await archiveSundayMessage(req.params.messageId, currentUser));
    } catch (err) {
      next(err);
    }
  });
}

async function assertSundayMessageReadable(currentUser) {
  if (!currentUser || !currentUser.name) throw new Error('缺少登入者資訊');
  if (canAccessSundayMessage(currentUser)) return true;
  throw new Error('沒有主日信息管理系統的讀取權限');
}

async function assertSundayMessageEditable(currentUser) {
  assertDesktop(currentUser);
  if (canAccessSundayMessage(currentUser)) return true;
  throw new Error('沒有主日信息管理系統的操作權限');
}

function canAccessSundayMessage(currentUser) {
  if (hasRole(currentUser, '超級管理者')) return true;
  const departments = normalizeDepartments(currentUser.departments || currentUser.department);
  if (departments.includes('秘書部')) return true;
  const roles = normalizeRoles(currentUser.roles, currentUser.role);
  const position = String(currentUser.position || '').trim();
  return position.includes('主任牧師') || roles.includes('主任牧師');
}

async function getSundayMessageOptions() {
  const [churches, externalPlaces] = await Promise.all([
    pool.query(
      `SELECT id, name, church_type
       FROM churches
       WHERE is_active
         AND church_type = '本會'
       ORDER BY sort_order, id`
    ),
    pool.query(
      `SELECT DISTINCT external_place
       FROM sunday_message_shares
       WHERE share_type = 'external'
         AND nullif(trim(coalesce(external_place, '')), '') IS NOT NULL
       ORDER BY external_place`
    )
  ]);

  return {
    churches: churches.rows.map(row => ({
      churchId: row.id,
      churchName: row.name,
      churchType: row.church_type
    })),
    externalPlaces: externalPlaces.rows.map(row => row.external_place)
  };
}

async function getSundayMessages(query = {}) {
  const keyword = String(query.keyword || '').trim();
  const status = String(query.status || '').trim() || 'active';
  const values = [status];
  const where = ['m.status = $1'];

  if (keyword) {
    values.push(`%${keyword}%`);
    where.push(`(
      m.speaker_name ILIKE $${values.length}
      OR m.message_title ILIKE $${values.length}
      OR coalesce(m.scripture, '') ILIKE $${values.length}
      OR coalesce(m.note, '') ILIKE $${values.length}
    )`);
  }

  const { rows } = await pool.query(
    `WITH church_total AS (
       SELECT count(*)::int AS count
       FROM churches
       WHERE is_active AND church_type = '本會'
     )
     SELECT
       m.*,
       coalesce(count(DISTINCT sms.share_id) FILTER (WHERE sms.share_type = 'church' AND sms.shared_date IS NOT NULL), 0)::int AS shared_church_count,
       greatest((SELECT count FROM church_total) - coalesce(count(DISTINCT sms.church_id) FILTER (WHERE sms.share_type = 'church' AND sms.shared_date IS NOT NULL), 0), 0)::int AS pending_church_count,
       coalesce(count(DISTINCT sms.share_id) FILTER (WHERE sms.share_type = 'external'), 0)::int AS external_share_count,
       max(sms.shared_date) AS latest_shared_date
     FROM sunday_messages m
     LEFT JOIN sunday_message_shares sms ON sms.message_id = m.message_id
     WHERE ${where.join(' AND ')}
     GROUP BY m.message_id
     ORDER BY coalesce(m.message_date, m.updated_at::date) DESC, m.updated_at DESC`,
    values
  );

  return { rows: rows.map(toSundayMessageListItem) };
}

async function getSundayMessageDetail(messageId) {
  const { rows } = await pool.query('SELECT * FROM sunday_messages WHERE message_id = $1', [messageId]);
  const message = rows[0];
  if (!message) throw new Error('找不到主日信息資料');

  const [churchShares, externalShares] = await Promise.all([
    pool.query(
      `SELECT
         c.id AS church_id,
         c.name AS church_name,
         c.church_type,
         sms.share_id,
         sms.shared_date,
         sms.note
       FROM churches c
       LEFT JOIN sunday_message_shares sms
         ON sms.church_id = c.id
        AND sms.message_id = $1
        AND sms.share_type = 'church'
       WHERE c.is_active
         AND c.church_type = '本會'
       ORDER BY c.sort_order, c.id`,
      [messageId]
    ),
    pool.query(
      `SELECT share_id, external_place, shared_date, note
       FROM sunday_message_shares
       WHERE message_id = $1
         AND share_type = 'external'
       ORDER BY shared_date NULLS LAST, external_place`,
      [messageId]
    )
  ]);

  return {
    message: toSundayMessage(message),
    churchShares: churchShares.rows.map(toChurchShare),
    externalShares: externalShares.rows.map(toExternalShare)
  };
}

async function saveSundayMessage(messageId, message, currentUser) {
  const normalized = normalizeSundayMessage(message);
  const staffId = currentUser.staffId ? String(currentUser.staffId) : null;

  const result = await tx(async client => {
    let rows;
    if (messageId) {
      ({ rows } = await client.query(
        `UPDATE sunday_messages
         SET speaker_name = $1,
             message_title = $2,
             message_date = $3,
             scripture = $4,
             note = $5,
             updated_by_staff_id = $6,
             updated_at = now()
         WHERE message_id = $7
           AND status <> 'archived'
         RETURNING *`,
        [
          normalized.speakerName,
          normalized.messageTitle,
          normalized.messageDate,
          normalized.scripture,
          normalized.note,
          staffId,
          messageId
        ]
      ));
      if (!rows[0]) throw new Error('找不到可更新的主日信息資料');
    } else {
      ({ rows } = await client.query(
        `INSERT INTO sunday_messages (
           speaker_name, message_title, message_date, scripture, note,
           created_by_staff_id, updated_by_staff_id, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$6,now())
         RETURNING *`,
        [
          normalized.speakerName,
          normalized.messageTitle,
          normalized.messageDate,
          normalized.scripture,
          normalized.note,
          staffId
        ]
      ));
    }

    await recordAuditLog({
      systemKey: 'sunday_message',
      entityType: 'sunday_message',
      entityId: rows[0].message_id,
      action: messageId ? 'update' : 'create',
      currentUser,
      afterData: toSundayMessage(rows[0])
    }, client);

    return rows[0];
  });

  return {
    success: true,
    message: messageId ? '主日信息已更新' : '主日信息已建立',
    messageId: result.message_id
  };
}

async function saveSundayMessageShares(messageId, shares, currentUser) {
  await ensureMessageExists(messageId);
  const churchShares = Array.isArray(shares.churchShares) ? shares.churchShares : [];
  const externalShares = Array.isArray(shares.externalShares) ? shares.externalShares : [];

  await tx(async client => {
    await client.query(
      `DELETE FROM sunday_message_shares
       WHERE message_id = $1
         AND share_type IN ('church', 'external')`,
      [messageId]
    );

    for (const share of churchShares) {
      const churchId = Number(share.churchId);
      const sharedDate = normalizeDate(share.sharedDate);
      const note = normalizeOptionalText(share.note);
      if (!Number.isInteger(churchId)) continue;
      if (!sharedDate && !note) continue;
      await client.query(
        `INSERT INTO sunday_message_shares (message_id, share_type, church_id, shared_date, note)
         VALUES ($1, 'church', $2, $3, $4)`,
        [messageId, churchId, sharedDate, note]
      );
    }

    for (const share of externalShares) {
      const externalPlace = normalizeOptionalText(share.externalPlace);
      if (!externalPlace) continue;
      await client.query(
        `INSERT INTO sunday_message_shares (message_id, share_type, external_place, shared_date, note)
         VALUES ($1, 'external', $2, $3, $4)`,
        [messageId, externalPlace, normalizeDate(share.sharedDate), normalizeOptionalText(share.note)]
      );
    }

    await client.query('UPDATE sunday_messages SET updated_at = now() WHERE message_id = $1', [messageId]);
    await recordAuditLog({
      systemKey: 'sunday_message',
      entityType: 'sunday_message',
      entityId: messageId,
      action: 'update_shares',
      currentUser,
      afterData: { churchShares, externalShares }
    }, client);
  });

  return { success: true, message: '分享狀況已儲存' };
}

async function archiveSundayMessage(messageId, currentUser) {
  const { rows } = await pool.query(
    `UPDATE sunday_messages
     SET status = 'archived', updated_by_staff_id = $2, updated_at = now()
     WHERE message_id = $1
       AND status <> 'archived'
     RETURNING message_id`,
    [messageId, currentUser.staffId ? String(currentUser.staffId) : null]
  );
  if (!rows[0]) throw new Error('找不到可封存的主日信息資料');

  await recordAuditLog({
    systemKey: 'sunday_message',
    entityType: 'sunday_message',
    entityId: messageId,
    action: 'archive',
    currentUser
  });

  return { success: true, message: '主日信息已封存' };
}

async function ensureMessageExists(messageId) {
  const { rows } = await pool.query(
    "SELECT message_id FROM sunday_messages WHERE message_id = $1 AND status <> 'archived'",
    [messageId]
  );
  if (!rows[0]) throw new Error('找不到主日信息資料');
}

function normalizeSundayMessage(message) {
  return {
    speakerName: normalizeRequiredText(message.speakerName || message.speaker_name, '請填寫牧者姓名'),
    messageTitle: normalizeRequiredText(message.messageTitle || message.message_title, '請填寫信息主題'),
    messageDate: normalizeDate(message.messageDate || message.message_date),
    scripture: normalizeOptionalText(message.scripture),
    note: normalizeOptionalText(message.note)
  };
}

function normalizeRequiredText(value, message) {
  const text = normalizeOptionalText(value);
  if (!text) throw new Error(message);
  return text;
}

function normalizeOptionalText(value) {
  return String(value || '').trim();
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('日期格式需為 YYYY-MM-DD');
  return text;
}

function normalizeDepartments(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(/[、,，]/);
  return [...new Set(values.map(item => String(item || '').trim()).filter(Boolean))];
}

function toSundayMessageListItem(row) {
  return {
    messageId: row.message_id,
    speakerName: row.speaker_name,
    messageTitle: row.message_title,
    messageDate: row.message_date,
    scripture: row.scripture || '',
    note: row.note || '',
    status: row.status,
    sharedChurchCount: Number(row.shared_church_count || 0),
    pendingChurchCount: Number(row.pending_church_count || 0),
    externalShareCount: Number(row.external_share_count || 0),
    latestSharedDate: row.latest_shared_date
  };
}

function toSundayMessage(row) {
  return {
    messageId: row.message_id,
    speakerName: row.speaker_name,
    messageTitle: row.message_title,
    messageDate: row.message_date,
    scripture: row.scripture || '',
    note: row.note || '',
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toChurchShare(row) {
  return {
    shareId: row.share_id || '',
    churchId: row.church_id,
    churchName: row.church_name,
    churchType: row.church_type,
    sharedDate: row.shared_date || '',
    note: row.note || '',
    status: row.shared_date ? '已分享' : '未分享'
  };
}

function toExternalShare(row) {
  return {
    shareId: row.share_id,
    externalPlace: row.external_place,
    sharedDate: row.shared_date || '',
    note: row.note || ''
  };
}

module.exports = { registerSundayMessageRoutes };
