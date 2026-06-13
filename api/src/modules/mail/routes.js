const { pool, tx } = require('../../db');
const { hasAnyRole, parseUser } = require('../../shared/users');
const { recordAuditLog } = require('../../shared/audit');

const PRIORITY_RANK = {
  HIGH: 1,
  NORMAL: 2,
  LOW: 3
};

function registerMailRoutes(app) {
  app.post('/mail/queue', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      res.json(await enqueueMail(req.body.mail || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.post('/mail/queue/bulk', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      const mails = Array.isArray(req.body.mails) ? req.body.mails : [];
      const results = [];
      for (const mail of mails) {
        results.push(await enqueueMail(mail, currentUser));
      }
      res.json({
        success: true,
        queuedCount: results.filter(row => row.status === 'queued').length,
        duplicateCount: results.filter(row => row.status === 'duplicate').length,
        results
      });
    } catch (err) {
      next(err);
    }
  });

  app.get('/mail/queue/pending', async (req, res, next) => {
    try {
      parseUser(req);
      res.json(await getPendingMails(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.get('/mail/queue', async (req, res, next) => {
    try {
      assertMailAdmin(parseUser(req));
      res.json(await listMailQueue(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.get('/mail/queue/dashboard', async (req, res, next) => {
    try {
      assertMailAdmin(parseUser(req));
      res.json(await getMailQueueDashboard());
    } catch (err) {
      next(err);
    }
  });

  app.get('/mail/queue/quota', async (req, res, next) => {
    try {
      assertMailAdmin(parseUser(req));
      res.json(await getMailQuotaStatus());
    } catch (err) {
      next(err);
    }
  });

  app.get('/mail/queue/health', async (req, res, next) => {
    try {
      assertMailAdmin(parseUser(req));
      res.json(await getMailQueueHealth());
    } catch (err) {
      next(err);
    }
  });

  app.get('/mail/queue/stats', async (req, res, next) => {
    try {
      assertMailAdmin(parseUser(req));
      res.json(await getMailQueueStats());
    } catch (err) {
      next(err);
    }
  });

  app.get('/mail/queue/:id', async (req, res, next) => {
    try {
      assertMailAdmin(parseUser(req));
      res.json(await getMailQueueItem(req.params.id));
    } catch (err) {
      next(err);
    }
  });

  app.post('/mail/queue/:id/retry', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      assertMailAdmin(currentUser);
      res.json(await retryMailQueueItem(req.params.id, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.post('/mail/queue/:id/cancel', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      assertMailAdmin(currentUser);
      res.json(await cancelMailQueueItem(req.params.id, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.post('/mail/queue/:id/resend', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      assertMailAdmin(currentUser);
      res.json(await resendMailQueueItem(req.params.id, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.patch('/mail/queue/:id/sent', async (req, res, next) => {
    try {
      res.json(await markMail(req.params.id, 'SENT', req.body || {}));
    } catch (err) {
      next(err);
    }
  });

  app.patch('/mail/queue/:id/failed', async (req, res, next) => {
    try {
      res.json(await markMail(req.params.id, 'FAILED', req.body || {}));
    } catch (err) {
      next(err);
    }
  });

  app.patch('/mail/queue/:id/skipped', async (req, res, next) => {
    try {
      res.json(await markMail(req.params.id, 'SKIPPED', req.body || {}));
    } catch (err) {
      next(err);
    }
  });

  app.post('/mail/quota-snapshots', async (req, res, next) => {
    try {
      res.json(await createMailQuotaSnapshot(req.body.snapshot || req.body || {}));
    } catch (err) {
      next(err);
    }
  });
}

async function enqueueMail(payload, currentUser = {}) {
  const mail = normalizeMail(payload);
  try {
    const { rows } = await pool.query(
      `INSERT INTO mail_queue (
         module_key, business_id, event_type, dedupe_key,
         recipient_email, subject, body, html_body, priority,
         scheduled_at, created_by_staff_id, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
       RETURNING id, status`,
      [
        mail.moduleKey,
        mail.businessId,
        mail.eventType,
        mail.dedupeKey,
        mail.recipientEmail,
        mail.subject,
        mail.body,
        mail.htmlBody,
        mail.priority,
        mail.scheduledAt,
        currentUser.staffId ? String(currentUser.staffId) : null,
        JSON.stringify(mail.metadata)
      ]
    );
    return { success: true, status: 'queued', id: rows[0].id };
  } catch (err) {
    if (err && err.code === '23505' && mail.dedupeKey) {
      const { rows } = await pool.query(
        `SELECT id, status
         FROM mail_queue
         WHERE dedupe_key = $1
           AND status IN ('PENDING', 'SENT')
         ORDER BY created_at DESC
         LIMIT 1`,
        [mail.dedupeKey]
      );
      return {
        success: true,
        status: 'duplicate',
        id: rows[0] ? rows[0].id : null,
        message: 'Mail already queued or sent for this dedupe key.'
      };
    }
    throw err;
  }
}

async function getPendingMails(query = {}) {
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 20);
  const priority = normalizeOptionalPriority(query.priority);
  const values = [limit];
  const where = [
    "status = 'PENDING'",
    'scheduled_at <= now()',
    'retry_count < 3'
  ];
  if (priority) {
    values.push(priority);
    where.push(`priority = $${values.length}`);
  }

  const { rows } = await pool.query(
    `SELECT id, module_key, business_id, event_type, recipient_email, subject,
       body, html_body, priority, retry_count, scheduled_at, metadata
     FROM mail_queue
     WHERE ${where.join(' AND ')}
     ORDER BY
       CASE priority WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END,
       scheduled_at,
       created_at
     LIMIT $1::int`,
    values
  );
  return { rows: rows.map(toMailItem) };
}

async function listMailQueue(query = {}) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 50), 1), 100);
  const offset = (page - 1) * pageSize;
  const values = [];
  const where = [];
  const status = normalizeOptionalQueueStatus(query.status);
  const priority = normalizeOptionalPriority(query.priority);
  const moduleKey = normalizeText(query.moduleKey || query.module_key).toLowerCase();
  const recipientEmail = normalizeText(query.recipientEmail || query.recipient_email).toLowerCase();

  if (status) {
    values.push(status);
    where.push(`status = $${values.length}`);
  }
  if (priority) {
    values.push(priority);
    where.push(`priority = $${values.length}`);
  }
  if (moduleKey) {
    values.push(moduleKey);
    where.push(`module_key = $${values.length}`);
  }
  if (recipientEmail) {
    values.push(`%${recipientEmail}%`);
    where.push(`recipient_email ILIKE $${values.length}`);
  }
  if (query.startDate || query.start_date) {
    values.push(normalizeDateOnly(query.startDate || query.start_date));
    where.push(`created_at >= $${values.length}::date`);
  }
  if (query.endDate || query.end_date) {
    values.push(normalizeDateOnly(query.endDate || query.end_date));
    where.push(`created_at < ($${values.length}::date + interval '1 day')`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT id, module_key, business_id, event_type, recipient_email, subject, body, html_body,
       priority, status, retry_count, error_message, scheduled_at, sent_at, created_at, updated_at, metadata
     FROM mail_queue
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${values.length + 1}::int OFFSET $${values.length + 2}::int`,
    values.concat([pageSize, offset])
  );
  const count = await pool.query(
    `SELECT count(*)::int AS total FROM mail_queue ${whereSql}`,
    values
  );
  return { rows: rows.map(toMailQueueListItem), page, pageSize, total: Number(count.rows[0].total || 0) };
}

async function getMailQueueItem(id) {
  const { rows } = await pool.query(
    `SELECT id, module_key, business_id, event_type, dedupe_key, recipient_email, subject,
       body, html_body, priority, status, retry_count, error_message, scheduled_at, sent_at,
       created_by_staff_id, created_at, updated_at, metadata
     FROM mail_queue
     WHERE id = $1`,
    [id]
  );
  if (!rows.length) throw new Error('Mail queue item not found.');
  return { mail: toMailQueueListItem(rows[0], { includeBody: true, includeDedupeKey: true }) };
}

async function markMail(id, status, payload = {}) {
  const normalizedStatus = normalizeStatus(status);
  const errorMessage = String(payload.errorMessage || payload.error_message || '').trim();
  const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
  const retryIncrement = normalizedStatus === 'FAILED' ? 1 : 0;
  const { rows } = await pool.query(
    `UPDATE mail_queue
     SET status = $2,
         error_message = $3,
         retry_count = retry_count + $4,
         sent_at = CASE WHEN $2 = 'SENT' THEN now() ELSE sent_at END,
         metadata = metadata || $5::jsonb,
         updated_at = now()
     WHERE id = $1
     RETURNING id, status, retry_count, sent_at`,
    [id, normalizedStatus, errorMessage || null, retryIncrement, JSON.stringify(metadata)]
  );
  if (!rows.length) throw new Error('Mail queue item not found.');
  return { success: true, mail: rows[0] };
}

async function retryMailQueueItem(id, currentUser = {}) {
  return tx(async client => {
    const before = await getMailQueueRowForUpdate(client, id);
    if (before.status !== 'FAILED') throw new Error('Only FAILED mail can be retried.');
    if (Number(before.retry_count || 0) >= 3) throw new Error('Mail retry limit reached.');
    const { rows } = await client.query(
      `UPDATE mail_queue
       SET status = 'PENDING',
           error_message = null,
           scheduled_at = now(),
           updated_at = now(),
           metadata = metadata || $2::jsonb
       WHERE id = $1
       RETURNING *`,
      [id, JSON.stringify({ retryRequestedAt: new Date().toISOString() })]
    );
    await recordMailQueueAudit(client, 'RETRY', id, currentUser, before, rows[0]);
    return { success: true, mail: toMailQueueListItem(rows[0]) };
  });
}

async function cancelMailQueueItem(id, currentUser = {}) {
  return tx(async client => {
    const before = await getMailQueueRowForUpdate(client, id);
    if (before.status !== 'PENDING') throw new Error('Only PENDING mail can be cancelled.');
    const { rows } = await client.query(
      `UPDATE mail_queue
       SET status = 'SKIPPED',
           error_message = 'Cancelled by administrator',
           updated_at = now(),
           metadata = metadata || $2::jsonb
       WHERE id = $1
       RETURNING *`,
      [id, JSON.stringify({ cancelledAt: new Date().toISOString(), cancelledBy: currentUser.staffId || '' })]
    );
    await recordMailQueueAudit(client, 'CANCEL', id, currentUser, before, rows[0]);
    return { success: true, mail: toMailQueueListItem(rows[0]) };
  });
}

async function resendMailQueueItem(id, currentUser = {}) {
  return tx(async client => {
    const before = await getMailQueueRowForUpdate(client, id);
    if (before.status !== 'SENT') throw new Error('Only SENT mail can be resent.');
    const { rows } = await client.query(
      `INSERT INTO mail_queue (
         module_key, business_id, event_type, dedupe_key, recipient_email, subject, body,
         html_body, priority, scheduled_at, created_by_staff_id, metadata
       )
       SELECT module_key, business_id, event_type,
              coalesce(dedupe_key, id::text) || ':resend:' || gen_random_uuid()::text,
              recipient_email, subject, body, html_body, priority, now(), $2,
              metadata || $3::jsonb
       FROM mail_queue
       WHERE id = $1
       RETURNING *`,
      [id, currentUser.staffId ? String(currentUser.staffId) : null, JSON.stringify({ resendOf: id })]
    );
    await recordMailQueueAudit(client, 'RESEND', rows[0].id, currentUser, before, rows[0]);
    return { success: true, mail: toMailQueueListItem(rows[0]), originalId: id };
  });
}

async function getMailQueueRowForUpdate(client, id) {
  const { rows } = await client.query('SELECT * FROM mail_queue WHERE id = $1 FOR UPDATE', [id]);
  if (!rows.length) throw new Error('Mail queue item not found.');
  return rows[0];
}

async function recordMailQueueAudit(client, action, id, currentUser, before, after) {
  await recordAuditLog({
    systemKey: 'mail',
    entityType: 'mail_queue',
    entityId: id,
    action,
    currentUser,
    beforeData: summarizeMailQueueForAudit(before),
    afterData: summarizeMailQueueForAudit(after)
  }, client);
}

async function getMailQueueStats() {
  const { rows } = await pool.query(
    `SELECT
       count(*) FILTER (WHERE status = 'PENDING')::int AS pending_count,
       count(*) FILTER (WHERE status = 'FAILED')::int AS failed_count,
       count(*) FILTER (WHERE status = 'SENT' AND sent_at::date = current_date)::int AS sent_today_count,
       max(error_message) FILTER (WHERE status = 'FAILED') AS last_error
     FROM mail_queue`
  );
  return rows[0] || {};
}

async function getMailQueueDashboard() {
  const stats = await getMailQueueStats();
  const { rows } = await pool.query(
    `SELECT
       count(*) FILTER (WHERE status = 'PENDING' AND priority = 'HIGH')::int AS high_priority_pending_count,
       min(created_at) FILTER (WHERE status = 'PENDING') AS oldest_pending_created_at,
       max(updated_at) FILTER (WHERE status IN ('SENT', 'FAILED', 'SKIPPED')) AS last_processed_at
     FROM mail_queue`
  );
  const quota = await getMailQuotaStatus();
  return {
    remainingQuota: quota.remainingQuota,
    pendingCount: Number(stats.pending_count || 0),
    failedCount: Number(stats.failed_count || 0),
    sentTodayCount: Number(stats.sent_today_count || 0),
    highPriorityPendingCount: Number(rows[0].high_priority_pending_count || 0),
    oldestPendingCreatedAt: rows[0].oldest_pending_created_at || null,
    lastProcessedAt: rows[0].last_processed_at || null,
    triggerStatus: 'UNKNOWN',
    lastQuotaSnapshotAt: quota.checkedAt || null
  };
}

async function getMailQuotaStatus() {
  const { rows } = await pool.query(
    `SELECT remaining_quota, pending_count, failed_count, sent_today_count, checked_at
     FROM mail_quota_snapshots
     ORDER BY checked_at DESC
     LIMIT 1`
  );
  const row = rows[0] || {};
  return {
    remainingQuota: row.remaining_quota === undefined ? null : Number(row.remaining_quota || 0),
    pendingCount: Number(row.pending_count || 0),
    failedCount: Number(row.failed_count || 0),
    sentTodayCount: Number(row.sent_today_count || 0),
    checkedAt: row.checked_at || null
  };
}

async function getMailQueueHealth() {
  const dashboard = await getMailQueueDashboard();
  const staleQuota = !dashboard.lastQuotaSnapshotAt
    || (Date.now() - new Date(dashboard.lastQuotaSnapshotAt).getTime()) > 60 * 60 * 1000;
  return {
    ok: dashboard.failedCount < 50 && !staleQuota,
    staleQuotaSnapshot: staleQuota,
    dashboard
  };
}

async function createMailQuotaSnapshot(payload = {}) {
  const remainingQuota = normalizeNonNegativeInteger(payload.remainingQuota ?? payload.remaining_quota, 'remainingQuota');
  const stats = await getMailQueueStats();
  const pendingCount = normalizeOptionalNonNegativeInteger(payload.pendingCount ?? payload.pending_count, stats.pending_count || 0);
  const failedCount = normalizeOptionalNonNegativeInteger(payload.failedCount ?? payload.failed_count, stats.failed_count || 0);
  const sentTodayCount = normalizeOptionalNonNegativeInteger(payload.sentTodayCount ?? payload.sent_today_count, stats.sent_today_count || 0);
  const { rows } = await pool.query(
    `INSERT INTO mail_quota_snapshots (
       remaining_quota, pending_count, failed_count, sent_today_count, checked_at
     ) VALUES ($1,$2,$3,$4,now())
     RETURNING id, remaining_quota, pending_count, failed_count, sent_today_count, checked_at`,
    [remainingQuota, pendingCount, failedCount, sentTodayCount]
  );
  return { success: true, snapshot: rows[0] };
}

function normalizeMail(payload = {}) {
  const moduleKey = normalizeText(payload.moduleKey || payload.module_key).toLowerCase();
  const recipientEmail = normalizeEmail(payload.recipientEmail || payload.recipient_email || payload.to);
  const subject = normalizeText(payload.subject);
  const body = String(payload.body || '');
  if (!moduleKey) throw new Error('moduleKey is required.');
  if (!recipientEmail) throw new Error('recipientEmail is required.');
  if (!subject) throw new Error('subject is required.');
  if (!body) throw new Error('body is required.');
  return {
    moduleKey,
    businessId: normalizeText(payload.businessId || payload.business_id),
    eventType: normalizeText(payload.eventType || payload.event_type),
    dedupeKey: normalizeText(payload.dedupeKey || payload.dedupe_key),
    recipientEmail,
    subject,
    body,
    htmlBody: payload.htmlBody || payload.html_body || null,
    priority: normalizePriority(payload.priority),
    scheduledAt: payload.scheduledAt || payload.scheduled_at || new Date().toISOString(),
    metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}
  };
}

function normalizePriority(value) {
  const priority = normalizeText(value).toUpperCase();
  return PRIORITY_RANK[priority] ? priority : 'NORMAL';
}

function normalizeOptionalPriority(value) {
  const priority = normalizeText(value).toUpperCase();
  return PRIORITY_RANK[priority] ? priority : '';
}

function normalizeStatus(value) {
  const status = normalizeText(value).toUpperCase();
  if (!['SENT', 'FAILED', 'SKIPPED'].includes(status)) throw new Error('Invalid mail queue status.');
  return status;
}

function normalizeOptionalQueueStatus(value) {
  const status = normalizeText(value).toUpperCase();
  return ['PENDING', 'SENT', 'FAILED', 'SKIPPED'].includes(status) ? status : '';
}

function normalizeEmail(value) {
  const email = normalizeText(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function normalizeText(value) {
  return String(value || '').trim();
}

function assertMailAdmin(currentUser) {
  const isMailAdmin = Boolean(currentUser && (currentUser.isAdmin || currentUser.isSuperAdmin))
    || hasAnyRole(currentUser, ['管理員', '超級管理者']);
  if (!isMailAdmin) {
    throw new Error('Only administrators can manage mail queue.');
  }
}

function normalizeDateOnly(value) {
  const text = normalizeText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('Date filter must use YYYY-MM-DD.');
  return text;
}

function normalizeNonNegativeInteger(value, fieldName) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${fieldName} must be a non-negative integer.`);
  return number;
}

function normalizeOptionalNonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : Number(fallback || 0);
}

function toMailItem(row) {
  return {
    id: row.id,
    moduleKey: row.module_key,
    businessId: row.business_id || '',
    eventType: row.event_type || '',
    recipientEmail: row.recipient_email,
    subject: row.subject,
    body: row.body,
    htmlBody: row.html_body || '',
    priority: row.priority,
    retryCount: Number(row.retry_count || 0),
    scheduledAt: row.scheduled_at,
    metadata: row.metadata || {}
  };
}

function toMailQueueListItem(row, options = {}) {
  const item = {
    id: row.id,
    moduleKey: row.module_key,
    businessId: row.business_id || '',
    eventType: row.event_type || '',
    recipientEmail: row.recipient_email,
    subject: row.subject,
    priority: row.priority,
    status: row.status,
    retryCount: Number(row.retry_count || 0),
    scheduledAt: row.scheduled_at,
    sentAt: row.sent_at || null,
    errorMessage: row.error_message || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at || null,
    metadata: row.metadata || {}
  };
  if (options.includeBody) {
    item.body = row.body || '';
    item.htmlBody = row.html_body || '';
  }
  if (options.includeDedupeKey) item.dedupeKey = row.dedupe_key || '';
  return item;
}

function summarizeMailQueueForAudit(row) {
  if (!row) return null;
  return {
    id: row.id,
    moduleKey: row.module_key,
    recipientEmail: row.recipient_email,
    priority: row.priority,
    status: row.status,
    retryCount: Number(row.retry_count || 0),
    scheduledAt: row.scheduled_at,
    sentAt: row.sent_at || null,
    errorMessage: row.error_message || ''
  };
}

module.exports = {
  registerMailRoutes
};
