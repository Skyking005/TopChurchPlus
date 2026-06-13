const { pool } = require('../../db');
const { parseUser } = require('../../shared/users');

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

  app.get('/mail/queue/stats', async (req, res, next) => {
    try {
      parseUser(req);
      res.json(await getMailQueueStats());
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
  const limit = Math.min(Math.max(Number(query.limit || 30), 1), 100);
  const priority = normalizeOptionalPriority(query.priority);
  const values = [limit];
  const where = [
    "status = 'PENDING'",
    'scheduled_at <= now()'
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

function normalizeEmail(value) {
  const email = normalizeText(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function normalizeText(value) {
  return String(value || '').trim();
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

module.exports = {
  registerMailRoutes
};
