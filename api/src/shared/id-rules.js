const { pool } = require('../db');

const DEFAULT_ID_RULES = {
  project: { prefix: 'PJ', includeYearMonth: true, sequenceDigits: 2 },
  course: { prefix: 'CL', includeYearMonth: true, sequenceDigits: 4 },
  member: { prefix: 'TOP', includeYearMonth: true, sequenceDigits: 5 },
  meeting: { prefix: 'M', includeYearMonth: true, sequenceDigits: 4 }
};

function getRuleDefaults(entityKey) {
  return DEFAULT_ID_RULES[entityKey] || { prefix: '', includeYearMonth: true, sequenceDigits: 4 };
}

async function getIdRules(clientOrPool = pool) {
  const db = clientOrPool || pool;
  const { rows } = await db.query(
    `SELECT entity_key, entity_label, prefix, include_year_month, sequence_digits, is_active
     FROM id_rules
     ORDER BY sort_order, entity_key`
  );
  return rows.map(toIdRule);
}

async function getIdRule(entityKey, clientOrPool = pool) {
  const db = clientOrPool || pool;
  const defaults = getRuleDefaults(entityKey);
  const { rows } = await db.query(
    `SELECT entity_key, entity_label, prefix, include_year_month, sequence_digits, is_active
     FROM id_rules
     WHERE entity_key = $1`,
    [entityKey]
  );
  if (!rows[0]) {
    return {
      entityKey,
      entityLabel: entityKey,
      ...defaults,
      isActive: true
    };
  }
  return toIdRule(rows[0]);
}

async function saveIdRule(payload, clientOrPool = pool) {
  const db = clientOrPool || pool;
  const entityKey = normalizeEntityKey(payload.entityKey || payload.entity_key);
  const entityLabel = normalizeText(payload.entityLabel || payload.entity_label) || entityKey;
  const prefix = normalizePrefix(payload.prefix);
  const includeYearMonth = Boolean(payload.includeYearMonth ?? payload.include_year_month);
  const sequenceDigits = normalizeSequenceDigits(payload.sequenceDigits ?? payload.sequence_digits);
  const isActive = payload.isActive === undefined && payload.is_active === undefined
    ? true
    : Boolean(payload.isActive ?? payload.is_active);

  const { rows } = await db.query(
    `INSERT INTO id_rules (
       entity_key, entity_label, prefix, include_year_month, sequence_digits, is_active, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,now())
     ON CONFLICT (entity_key) DO UPDATE SET
       entity_label = EXCLUDED.entity_label,
       prefix = EXCLUDED.prefix,
       include_year_month = EXCLUDED.include_year_month,
       sequence_digits = EXCLUDED.sequence_digits,
       is_active = EXCLUDED.is_active,
       updated_at = now()
     RETURNING entity_key, entity_label, prefix, include_year_month, sequence_digits, is_active`,
    [entityKey, entityLabel, prefix, includeYearMonth, sequenceDigits, isActive]
  );
  return toIdRule(rows[0]);
}

async function generateId(entityKey, options) {
  const db = options?.client || pool;
  const rule = await getIdRule(entityKey, db);
  if (!rule.isActive) throw new Error(`ID rule is disabled: ${entityKey}`);

  const stem = buildIdStem(rule, options?.now || new Date());
  const sequenceDigits = rule.sequenceDigits;
  const maxValue = Math.pow(10, sequenceDigits) - 1;
  const table = assertSqlIdentifier(options.table);
  const column = assertSqlIdentifier(options.column);
  const { rows } = await db.query(
    `SELECT ${column}::text AS id_value
     FROM ${table}
     WHERE ${column}::text LIKE $1
     ORDER BY ${column}::text DESC
     LIMIT 1`,
    [`${stem}%`]
  );
  const last = rows[0]?.id_value || '';
  const lastSeq = last.startsWith(stem) ? Number(last.slice(stem.length)) : 0;
  const nextSeq = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
  if (nextSeq > maxValue) throw new Error(`ID sequence overflow for ${entityKey}`);
  return `${stem}${String(nextSeq).padStart(sequenceDigits, '0')}`;
}

function buildIdStem(rule, now) {
  const datePart = rule.includeYearMonth
    ? `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
    : '';
  return `${rule.prefix || ''}${datePart}`;
}

function toIdRule(row) {
  return {
    entityKey: row.entity_key,
    entityLabel: row.entity_label,
    prefix: row.prefix || '',
    includeYearMonth: Boolean(row.include_year_month),
    sequenceDigits: Number(row.sequence_digits || 4),
    isActive: row.is_active !== false
  };
}

function normalizeEntityKey(value) {
  const text = normalizeText(value);
  if (!/^[a-z][a-z0-9_]{1,40}$/.test(text)) throw new Error('Invalid entity key');
  return text;
}

function normalizePrefix(value) {
  const text = normalizeText(value).toUpperCase();
  if (!/^[A-Z0-9]{0,12}$/.test(text)) throw new Error('Invalid ID prefix');
  return text;
}

function normalizeSequenceDigits(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 12) throw new Error('Invalid sequence digits');
  return number;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function assertSqlIdentifier(value) {
  const text = String(value || '').trim();
  if (!/^[a-z_][a-z0-9_]*$/i.test(text)) throw new Error('Invalid SQL identifier');
  return text;
}

module.exports = {
  getIdRule,
  getIdRules,
  saveIdRule,
  generateId
};
