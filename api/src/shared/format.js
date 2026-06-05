function splitCsv(value) {
  if (Array.isArray(value)) return value;
  return String(value || '').split(',').map(v => v.trim()).filter(Boolean);
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toISOString();
}

function normalizeValue(value) {
  const text = String(value || '').trim();
  if (!text) throw new Error('參數內容不可空白');
  return text;
}

module.exports = {
  formatDate,
  formatDateTime,
  normalizeValue,
  splitCsv
};
