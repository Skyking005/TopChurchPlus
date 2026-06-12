const { pool, tx } = require('../db');
const { recordAuditLog } = require('./audit');
const { Repository } = require('./repository');

const SECRET_MASK = '********';

const systemConfigRepository = new Repository('system_config', {
  primaryKey: 'config_key',
  allowedColumns: [
    'config_key',
    'config_value',
    'description',
    'is_secret',
    'enabled',
    'updated_by',
    'updated_at'
  ]
});

async function getConfigValues(keys, options = {}, client = pool) {
  const normalizedKeys = (Array.isArray(keys) ? keys : [keys]).map(normalizeConfigKey).filter(Boolean);
  if (!normalizedKeys.length) return {};

  let rows = [];
  try {
    const result = await client.query(
      `SELECT config_key, config_value, is_secret, enabled
       FROM system_config
       WHERE config_key = ANY($1::text[])
         AND enabled`,
      [normalizedKeys]
    );
    rows = result.rows;
  } catch (err) {
    if (err.code === '42P01') return {};
    throw err;
  }

  return rows.reduce((acc, row) => {
    acc[row.config_key] = options.revealSecrets ? row.config_value : maskSecret(row.config_value, row.is_secret);
    return acc;
  }, {});
}

async function getConfigValue(key, options = {}, client = pool) {
  const values = await getConfigValues([key], options, client);
  return values[normalizeConfigKey(key)] || '';
}

async function listConfig(options = {}, client = pool) {
  const { rows } = await client.query(
    `SELECT config_key, config_value, description, is_secret, enabled, updated_by, updated_at
     FROM system_config
     ORDER BY config_key`
  );
  return rows.map(row => mapConfig(row, options));
}

async function saveConfig(entry, currentUser = {}) {
  const config = normalizeConfigEntry(entry);
  return tx(async client => {
    const before = await systemConfigRepository.findById(config.config_key, client);
    const saved = before
      ? await systemConfigRepository.update(config.config_key, {
        config_value: config.config_value,
        description: config.description,
        is_secret: config.is_secret,
        enabled: config.enabled,
        updated_by: currentUser.staffId || null,
        updated_at: new Date()
      }, client)
      : await systemConfigRepository.insert({
        ...config,
        updated_by: currentUser.staffId || null
      }, client);

    await recordAuditLog({
      systemKey: 'config',
      entityType: 'system_config',
      entityId: config.config_key,
      action: before ? 'UPDATE' : 'CREATE',
      currentUser,
      beforeData: before ? mapConfig(before) : null,
      afterData: mapConfig(saved)
    }, client);

    return mapConfig(saved);
  });
}

function normalizeConfigEntry(entry) {
  const configKey = normalizeConfigKey(entry.configKey || entry.config_key);
  if (!configKey) throw new Error('Config key is required.');
  return {
    config_key: configKey,
    config_value: String(entry.configValue ?? entry.config_value ?? ''),
    description: normalizeText(entry.description),
    is_secret: entry.isSecret === true || entry.is_secret === true,
    enabled: entry.enabled !== false
  };
}

function mapConfig(row, options = {}) {
  return {
    configKey: row.config_key,
    configValue: options.revealSecrets ? row.config_value : maskSecret(row.config_value, row.is_secret),
    description: row.description || '',
    isSecret: Boolean(row.is_secret),
    enabled: row.enabled !== false,
    updatedBy: row.updated_by || '',
    updatedAt: row.updated_at || null
  };
}

function maskSecret(value, isSecret) {
  if (!isSecret) return value || '';
  return value ? SECRET_MASK : '';
}

function normalizeConfigKey(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
}

function normalizeText(value) {
  return String(value || '').trim();
}

module.exports = {
  getConfigValue,
  getConfigValues,
  listConfig,
  saveConfig
};
