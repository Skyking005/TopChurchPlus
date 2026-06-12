const crypto = require('crypto');
const { pool } = require('../../db');
const { createLineApiClient, normalizeLineApiConfig } = require('./line-api-client');
const { resolveLineChannel } = require('./config');

function registerLineBotWebhookRoutes(app) {
  app.post('/linebot/webhook', async (req, res, next) => {
    try {
      const channel = await resolveLineChannel(await getWebhookChannel(req));
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
        const eventRow = await recordLineEvent(event);
        await handleLineEvent(channel, event, eventRow);
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
    `SELECT channel_id, channel_key, webhook_url, liff_base_url, metadata
     FROM line_bot_channels
     WHERE channel_key = $1 AND is_active
     LIMIT 1`,
    [channelKey]
  );
  if (result.rowCount) return result.rows[0];

  const fallback = await pool.query(
    `SELECT channel_id, channel_key, webhook_url, liff_base_url, metadata
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

  const eventResult = await pool.query(
    `INSERT INTO line_bot_webhook_events (
       line_event_id, line_user_id, event_type, message_type, payload, handled_status
     ) VALUES ($1, $2, $3, $4, $5::jsonb, 'received')
     ON CONFLICT (line_event_id) DO UPDATE SET
       line_user_id = EXCLUDED.line_user_id,
       event_type = EXCLUDED.event_type,
       message_type = EXCLUDED.message_type,
       payload = EXCLUDED.payload
     RETURNING event_id`,
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
  return {
    eventId: eventResult.rows[0]?.event_id || null,
    lineEventId,
    lineUserId,
    eventType,
    messageType
  };
}

async function handleLineEvent(channel, event, eventRow) {
  try {
    if (!eventRow.lineUserId) {
      await updateEventStatus(eventRow.eventId, 'ignored');
      return;
    }

    const client = createLineApiClient(channel.metadata || {});
    await syncLineUserProfile(client, eventRow.lineUserId);

    const messages = await buildReplyMessages(channel, event, eventRow.lineUserId);
    if (!messages.length || !event.replyToken) {
      await updateEventStatus(eventRow.eventId, 'handled');
      return;
    }
    if (!client.readiness.canCallLineApi && !(client.readiness.enabled && client.readiness.mode === 'dry_run')) {
      await updateEventStatus(eventRow.eventId, 'skipped', client.readiness.warnings.join('；'));
      return;
    }

    const result = await client.replyMessage(event.replyToken, messages);
    const status = result && result.dryRun ? 'dry_run' : 'handled';
    await updateEventStatus(eventRow.eventId, status);
  } catch (err) {
    await updateEventStatus(eventRow.eventId, 'failed', err.message || String(err));
  }
}

async function syncLineUserProfile(client, lineUserId) {
  if (!client.readiness.canCallLineApi) return;
  const profile = await client.getUserProfile(lineUserId);
  await pool.query(
    `UPDATE line_users
     SET display_name = COALESCE($2, display_name),
         picture_url = COALESCE($3, picture_url),
         status_message = COALESCE($4, status_message),
         last_interaction_at = now(),
         updated_at = now()
     WHERE line_user_id = $1`,
    [
      lineUserId,
      normalizeText(profile.displayName) || null,
      normalizeText(profile.pictureUrl) || null,
      normalizeText(profile.statusMessage) || null
    ]
  );
}

async function buildReplyMessages(channel, event, lineUserId) {
  const eventType = normalizeText(event.type);
  const messageType = normalizeText(event.message?.type);
  const text = normalizeText(event.message?.text);
  const shouldReply = eventType === 'follow'
    || (eventType === 'message' && messageType === 'text' && isLineBotCommand(text));
  if (!shouldReply) return [];

  const member = await getBoundMember(lineUserId);
  const portalUrl = buildLiffPortalUrl(channel);
  const title = member
    ? `${member.name}，您好！`
    : '歡迎使用 TopChurchPlus Line App';
  const body = member
    ? '您已完成會友綁定，可由下方入口查看可使用的會友服務。'
    : '請先開啟 Line App 入口完成會友綁定，系統會以 LINE 身份連結到您的牧養會友資料。';
  const suffix = portalUrl ? `\n\n入口：${portalUrl}` : '\n\n目前尚未設定 LIFF 入口，請洽系統管理員。';

  return [{
    type: 'text',
    text: `${title}\n${body}${suffix}`
  }];
}

function isLineBotCommand(text) {
  const value = normalizeText(text).toLowerCase();
  if (!value) return false;
  return [
    '綁定',
    '會友',
    '會員',
    'line app',
    'liff',
    '測試',
    'test',
    'help',
    'menu',
    '入口',
    '服務'
  ].some(keyword => value.includes(keyword));
}

async function getBoundMember(lineUserId) {
  const { rows } = await pool.query(
    `SELECT pm.id, pm.name, ch.name AS church_name
     FROM line_users lu
     JOIN pastoral_members pm ON pm.id = lu.member_id AND pm.is_active
     LEFT JOIN churches ch ON ch.id = pm.church_id
     WHERE lu.line_user_id = $1
     LIMIT 1`,
    [lineUserId]
  );
  return rows[0] || null;
}

function buildLiffPortalUrl(channel) {
  const metadata = channel.metadata || {};
  const configuredBase = normalizeText(channel.liff_base_url);
  const portalLiffId = normalizeText(metadata.liffIds?.portal);
  if (configuredBase) return appendQuery(configuredBase, 'channelKey', channel.channel_key);
  if (portalLiffId) return `https://liff.line.me/${encodeURIComponent(portalLiffId)}`;

  const webhookUrl = normalizeText(channel.webhook_url);
  const match = webhookUrl.match(/^(https?:\/\/[^/]+)/i);
  if (match) return `${match[1]}/liff?channelKey=${encodeURIComponent(channel.channel_key)}`;
  return '';
}

function appendQuery(url, key, value) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

async function updateEventStatus(eventId, status, errorMessage = '') {
  if (!eventId) return;
  await pool.query(
    `UPDATE line_bot_webhook_events
     SET handled_status = $2,
         error_message = NULLIF($3, ''),
         handled_at = now()
     WHERE event_id = $1`,
    [eventId, status, normalizeText(errorMessage)]
  );
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function normalizeText(value) {
  return String(value || '').trim();
}

module.exports = { registerLineBotWebhookRoutes };
