const { pool } = require('../db');

async function getNotificationTemplate(templateCode, channel, client = pool) {
  const { rows } = await client.query(
    `SELECT template_code, channel, subject, content, enabled
     FROM notification_templates
     WHERE template_code = $1
       AND channel = $2
       AND enabled
     LIMIT 1`,
    [normalizeTemplateCode(templateCode), normalizeChannel(channel)]
  );
  return rows[0] || null;
}

async function renderNotification(templateCode, channel, variables = {}, client = pool) {
  const template = await getNotificationTemplate(templateCode, channel, client);
  if (!template) throw new Error('找不到啟用中的通知模板');
  return {
    templateCode: template.template_code,
    channel: template.channel,
    subject: renderText(template.subject || '', variables),
    content: renderText(template.content, variables)
  };
}

async function recordNotificationLog(entry, client = pool) {
  const normalized = normalizeNotificationLog(entry);
  const { rows } = await client.query(
    `INSERT INTO notification_logs (
       template_code, channel, recipient, subject, content_snapshot,
       status, error_message, sent_at, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
     RETURNING id`,
    [
      normalized.templateCode,
      normalized.channel,
      normalized.recipient,
      normalized.subject,
      normalized.contentSnapshot,
      normalized.status,
      normalized.errorMessage,
      normalized.sentAt,
      JSON.stringify(normalized.metadata)
    ]
  );
  return rows[0].id;
}

function renderText(text, variables) {
  return String(text || '').replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = variables && Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : '';
    return value == null ? '' : String(value);
  });
}

function normalizeNotificationLog(entry) {
  const templateCode = normalizeTemplateCode(entry.templateCode || entry.template_code);
  const channel = normalizeChannel(entry.channel);
  const recipient = normalizeText(entry.recipient);
  if (!templateCode) throw new Error('templateCode is required.');
  if (!channel) throw new Error('channel is required.');
  if (!recipient) throw new Error('recipient is required.');
  return {
    templateCode,
    channel,
    recipient,
    subject: normalizeText(entry.subject),
    contentSnapshot: String(entry.contentSnapshot || entry.content_snapshot || ''),
    status: normalizeStatus(entry.status),
    errorMessage: normalizeText(entry.errorMessage || entry.error_message),
    sentAt: entry.sentAt || entry.sent_at || null,
    metadata: entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {}
  };
}

function normalizeTemplateCode(value) {
  return normalizeText(value).toUpperCase().replace(/[^A-Z0-9_]/g, '');
}

function normalizeChannel(value) {
  const channel = normalizeText(value).toUpperCase();
  return ['EMAIL', 'LINE_PUSH', 'LIFF_NOTICE'].includes(channel) ? channel : '';
}

function normalizeStatus(value) {
  const status = normalizeText(value).toUpperCase();
  return ['PENDING', 'SENT', 'FAILED', 'SKIPPED'].includes(status) ? status : 'PENDING';
}

function normalizeText(value) {
  return String(value || '').trim();
}

module.exports = {
  getNotificationTemplate,
  recordNotificationLog,
  renderNotification,
  renderText
};
