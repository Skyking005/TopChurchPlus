const { pool, tx } = require('../db');
const { recordAuditLog } = require('./audit');

const SECRET_MASK = '********';
const VALUE_TYPES = new Set(['string', 'number', 'boolean', 'json']);

const FLAT_KEY_MAP = {
  LINE_CHANNEL_SECRET: ['line', 'channel_secret'],
  LINE_CHANNEL_ACCESS_TOKEN: ['line', 'channel_access_token'],
  LINE_LIFF_ID: ['line', 'liff_id'],
  LINE_RICH_MENU_GUEST_ID: ['line', 'rich_menu_guest_id'],
  LINE_RICH_MENU_MEMBER_ID: ['line', 'rich_menu_member_id'],
  LINE_RICH_MENU_LEADER_ID: ['line', 'rich_menu_leader_id'],
  LINE_LOGIN_URL: ['line', 'login_url'],
  NOTIFY_EMAIL_SENDER: ['notification', 'sender_email'],
  QT_OPEN_PICKUP_MONTH: ['qt', 'open_pickup_month']
};

async function get(namespace, key, options = {}, client = pool) {
  const row = await findConfigKey(namespace, key, client);
  if (!row || row.is_enabled === false) return options.defaultValue ?? '';
  if (row.is_secret && !options.revealSecrets) return maskSecret(row.config_value, true);
  return options.raw ? row.config_value : parseValue(row.config_value, row.value_type);
}

async function getSecret(namespace, key, options = {}, client = pool) {
  return get(namespace, key, { ...options, revealSecrets: true }, client);
}

async function set(namespace, key, value, options = {}, currentUser = {}) {
  const entry = normalizeEntry({ namespace, configKey: key, configValue: value, ...options });
  return saveConfigKey(entry, currentUser);
}

async function getMappedFlatValue(flatKey, options = {}, client = pool) {
  const mapped = mapFlatKey(flatKey);
  if (!mapped) return null;
  try {
    const row = await findConfigKey(mapped.namespace, mapped.configKey, client);
    if (!row || row.is_enabled === false) return null;
    return row.is_secret && !options.revealSecrets
      ? maskSecret(row.config_value, true)
      : row.config_value;
  } catch (err) {
    if (err.code === '42P01') return null;
    throw err;
  }
}

async function saveMappedFlatValue(flatKey, legacyEntry, currentUser = {}) {
  const mapped = mapFlatKey(flatKey);
  if (!mapped) return null;
  try {
    return saveConfigKey({
      namespace: mapped.namespace,
      configKey: mapped.configKey,
      configValue: String(legacyEntry.configValue ?? legacyEntry.config_value ?? ''),
      valueType: 'string',
      isSecret: legacyEntry.isSecret === true || legacyEntry.is_secret === true,
      isEnabled: legacyEntry.enabled !== false && legacyEntry.isEnabled !== false,
      description: legacyEntry.description || ''
    }, currentUser);
  } catch (err) {
    if (err.code === '42P01') return null;
    throw err;
  }
}

async function listConfigKeys(filters = {}, options = {}, client = pool) {
  const values = [];
  const where = [];
  const namespace = normalizeOptionalIdentifier(filters.namespace);
  const keyword = String(filters.keyword || '').trim().toLowerCase();

  if (namespace) {
    values.push(namespace);
    where.push(`namespace = $${values.length}`);
  }
  if (keyword) {
    values.push(`%${keyword}%`);
    where.push(`(
      lower(namespace) LIKE $${values.length}
      OR lower(config_key) LIKE $${values.length}
      OR lower(coalesce(description, '')) LIKE $${values.length}
    )`);
  }

  const sql = `
    SELECT id, namespace, config_key, config_value, value_type, is_secret, is_enabled,
           description, created_at, updated_at, updated_by
    FROM system_config_keys
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY namespace, config_key`;
  const { rows } = await client.query(sql, values);
  return rows.map(row => mapConfigKey(row, options));
}

async function saveConfigKey(entry, currentUser = {}) {
  const config = normalizeEntry(entry);
  return tx(async client => {
    const before = await findConfigKey(config.namespace, config.configKey, client, true);
    const finalValue = config.keepExistingSecret && before?.is_secret
      ? before.config_value
      : config.configValue;

    const result = await client.query(
      `INSERT INTO system_config_keys (
         namespace, config_key, config_value, value_type, is_secret, is_enabled,
         description, updated_by, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
       ON CONFLICT (namespace, config_key) DO UPDATE SET
         config_value = EXCLUDED.config_value,
         value_type = EXCLUDED.value_type,
         is_secret = EXCLUDED.is_secret,
         is_enabled = EXCLUDED.is_enabled,
         description = EXCLUDED.description,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()
       RETURNING id, namespace, config_key, config_value, value_type, is_secret, is_enabled,
                 description, created_at, updated_at, updated_by`,
      [
        config.namespace,
        config.configKey,
        finalValue,
        config.valueType,
        config.isSecret,
        config.isEnabled,
        config.description,
        currentUser.staffId || null
      ]
    );
    const saved = result.rows[0];

    await recordAuditLog({
      systemKey: 'system',
      entityType: 'system_config_keys',
      entityId: `${config.namespace}.${config.configKey}`,
      action: before ? 'UPDATE' : 'CREATE',
      currentUser,
      beforeData: before ? mapConfigKey(before, { revealSecrets: false }) : null,
      afterData: mapConfigKey(saved, { revealSecrets: false }),
      metadata: {
        namespace: config.namespace,
        configKey: config.configKey,
        secretChanged: Boolean(config.isSecret && !config.keepExistingSecret)
      }
    }, client);

    return mapConfigKey(saved, { revealSecrets: false });
  });
}

function findConfigKey(namespace, key, client = pool) {
  const ns = normalizeIdentifier(namespace, 'namespace');
  const configKey = normalizeIdentifier(key, 'configKey');
  return client.query(
    `SELECT id, namespace, config_key, config_value, value_type, is_secret, is_enabled,
            description, created_at, updated_at, updated_by
     FROM system_config_keys
     WHERE namespace = $1 AND config_key = $2
     LIMIT 1`,
    [ns, configKey]
  ).then(result => result.rows[0] || null);
}

function mapConfigKey(row, options = {}) {
  const isSecret = Boolean(row.is_secret);
  return {
    id: row.id || '',
    namespace: row.namespace,
    configKey: row.config_key,
    configValue: isSecret && !options.revealSecrets ? maskSecret(row.config_value, true) : row.config_value,
    parsedValue: isSecret && !options.revealSecrets ? maskSecret(row.config_value, true) : parseValue(row.config_value, row.value_type),
    valueType: row.value_type || 'string',
    isSecret,
    isEnabled: row.is_enabled !== false,
    description: row.description || '',
    updatedBy: row.updated_by || '',
    updatedAt: row.updated_at || null,
    createdAt: row.created_at || null
  };
}

function normalizeEntry(entry = {}) {
  const namespace = normalizeIdentifier(entry.namespace, 'namespace');
  const configKey = normalizeIdentifier(entry.configKey || entry.config_key, 'configKey');
  const valueType = normalizeValueType(entry.valueType || entry.value_type || 'string');
  const isSecret = entry.isSecret === true || entry.is_secret === true;
  const keepExistingSecret = Boolean(isSecret && entry.keepExistingSecret);
  const configValue = keepExistingSecret
    ? ''
    : normalizeValueForStorage(entry.configValue ?? entry.config_value ?? '', valueType);
  return {
    namespace,
    configKey,
    configValue,
    valueType,
    isSecret,
    keepExistingSecret,
    isEnabled: entry.isEnabled !== false && entry.is_enabled !== false,
    description: String(entry.description || '').trim()
  };
}

function normalizeValueForStorage(value, valueType) {
  if (valueType === 'number') {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error('Config value must be a valid number.');
    return String(number);
  }
  if (valueType === 'boolean') {
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    const text = String(value || '').trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(text)) return 'true';
    if (['false', '0', 'no', 'off', ''].includes(text)) return 'false';
    throw new Error('Config value must be a valid boolean.');
  }
  if (valueType === 'json') {
    if (typeof value === 'object' && value !== null) return JSON.stringify(value);
    const text = String(value || '').trim() || '{}';
    JSON.parse(text);
    return text;
  }
  return String(value ?? '');
}

function parseValue(value, valueType) {
  if (valueType === 'number') return Number(value || 0);
  if (valueType === 'boolean') return String(value || '').trim().toLowerCase() === 'true';
  if (valueType === 'json') {
    try {
      return JSON.parse(String(value || '').trim() || '{}');
    } catch (err) {
      return {};
    }
  }
  return value || '';
}

function normalizeValueType(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!VALUE_TYPES.has(text)) throw new Error('Unsupported config value type.');
  return text;
}

function normalizeIdentifier(value, label) {
  const text = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
  if (!/^[a-z][a-z0-9_]*$/.test(text)) throw new Error(`${label} must use lowercase letters, numbers, or underscore.`);
  return text;
}

function normalizeOptionalIdentifier(value) {
  const text = String(value || '').trim();
  return text ? normalizeIdentifier(text, 'namespace') : '';
}

function mapFlatKey(flatKey) {
  const normalized = String(flatKey || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
  const mapped = FLAT_KEY_MAP[normalized];
  if (!mapped) return null;
  return { namespace: mapped[0], configKey: mapped[1] };
}

function maskSecret(value, isSecret) {
  if (!isSecret) return value || '';
  return value ? SECRET_MASK : '';
}

module.exports = {
  ConfigService: { get, getSecret, set, listConfigKeys, saveConfigKey },
  get,
  getSecret,
  set,
  listConfigKeys,
  saveConfigKey,
  getMappedFlatValue,
  saveMappedFlatValue,
  mapFlatKey,
  maskSecret,
  SECRET_MASK
};
