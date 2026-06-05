const { pool } = require('../db');
const { PARAM_CATEGORIES } = require('../modules/core/catalog');

async function getParams() {
  const params = {};
  Object.keys(PARAM_CATEGORIES).forEach(key => { params[key] = []; });
  const { rows } = await pool.query('SELECT category, value FROM params ORDER BY category, sort_order, value');
  rows.forEach(row => {
    if (!params[row.category]) params[row.category] = [];
    params[row.category].push(row.value);
  });
  params.chargeOptions = params.chargeOptions.length ? params.chargeOptions : ['是', '否'];
  params.departments = params.departments.length ? params.departments : getDefaultDepartments();
  return params;
}

async function getParamValues(type) {
  const category = normalizeParamType(type);
  const { rows } = await pool.query(
    'SELECT value FROM params WHERE category = $1 ORDER BY sort_order, value',
    [category]
  );
  return rows.map(row => row.value);
}

function normalizeParamType(type) {
  if (!PARAM_CATEGORIES[type]) throw new Error('未知的參數類型');
  return type;
}

function normalizeRequiredValue(value, message) {
  const text = String(value || '').trim();
  if (!text) throw new Error(message || '欄位不可空白');
  return text;
}

function getDefaultDepartments() {
  return ['秘書部', '牧養部', '教育部', '行政部', '財務部', '資訊部', '技術部', '媒體部'];
}

module.exports = {
  getDefaultDepartments,
  getParams,
  getParamValues,
  normalizeParamType,
  normalizeRequiredValue
};
