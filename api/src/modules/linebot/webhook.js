const crypto = require('crypto');
const { pool } = require('../../db');
const { normalizeLineApiConfig } = require('./line-api-client');

function registerLineBotWebhookRoutes(app) {
  app.post('/linebot/webhook', async (req, res, next) => {
    try {
      const channel = await getWebhookChannel(req);
      const metadata = channel.metadata || {};
      const lineApi = normalizeLineApiConfig(metadata.lineApi || {});
      const signatureResult = verifyLineSignature({
        rawBody: req.rawBody,
        signature: req.get('x-line-signature'),
        channelSecret: metadata.channelSecret,
        mode: lineApi.webhookSignatureMode
      });

      if (!signatureResult.ok) {
        if (signatureResult.enforced) {
          return res.status(401).json({ error: signatureResult.reason });
        }
        console.warn(`LINE webhook signature warning: ${signatureResult.reason}`);
      }

      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const events = Array.isArray(body.events) ? body.events : [];
      for (const event of events) {
        await recordLineEvent(event);
      }

      res.json({ success: true, received: events.length });
    } catch (err) {
      next(err);
    }
  });
}

async function getWebhookChannel(req) {
  const channelKey = normalizeKey(req.query.channelKey || req.query.channel_key || 'main');
  const result = await pool.query(
    `SELECT channel_id, channel_key, metadata
     FROM line_bot_channels
     WHERE channel_key = $1 AND is_active
     LIMIT 1`,
    [channelKey]
  );
  if (result.rowCount) return result.rows[0];

  const fallback = await pool.query(
    `SELECT channel_id, channel_key, metadata
     FROM line_bot_channels
     WHERE is_active
     ORDER BY channel_key = 'main' DESC, updated_at DESC
     LIMIT 1`
  );
  if (!fallback.rowCount) {
    const error = new Error('No active LINE channel is configured.');
    error.status = 503;
    throw error;
  }
  return fallback.rows[0];
}

function verifyLineSignature({ rawBody, signature, channelSecret, mode }) {
  const enforced = mode === 'enforce';
  if (mode === 'off') return { ok: true, enforced: false };
  if (!channelSecret) return { ok: !enforced, enforced, reason: 'missing_channel_secret' };
  if (!signature) return { ok: !enforced, enforced, reason: 'missing_line_signature' };
  if (!rawBody) return { ok: !enforced, enforced, reason: 'missing_raw_body' };

  const expected = crypto
    .createHmac('sha256', channelSecret)
    .update(rawBody)
    .digest('base64');
  const ok = timingSafeEqual(signature, expected);
  return { ok: ok || !enforced, enforced, reason: ok ? undefined : 'invalid_line_signature' };
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

async function recordLineEvent(event) {
  const lineEventId = normalizeText(event.webhookEventId || event.replyToken);
  const lineUserId = normalizeText(event.source?.userId);
  const eventType = normalizeText(event.type) || 'unknown';
  const messageType = normalizeText(event.message?.type);
  const payload = JSON.stringify(event || {});

  await pool.query(
    `INSERT INTO line_bot_webhook_events (
       line_event_id, line_user_id, event_type, message_type, payload, handled_status
     ) VALUES ($1, $2, $3, $4, $5::jsonb, 'received')
     ON CONFLICT (line_event_id) DO UPDATE SET
       line_user_id = EXCLUDED.line_user_id,
       event_type = EXCLUDED.event_type,
       message_type = EXCLUDED.message_type,
       payload = EXCLUDED.payload`,
    [lineEventId || null, lineUserId || null, eventType, messageType || null, payload]
  );

  if (lineUserId) {
    await pool.query(
      `INSERT INTO line_users (line_user_id, last_interaction_at, metadata, updated_at)
       VALUES ($1, now(), $2::jsonb, now())
       ON CONFLICT (line_user_id) DO UPDATE SET
         last_interaction_at = now(),
         updated_at = now()`,
      [lineUserId, JSON.stringify({ source: 'linebot.webhook' })]
    );
  }
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function normalizeText(value) {
  return String(value || '').trim();
}

module.exports = { registerLineBotWebhookRoutes };
