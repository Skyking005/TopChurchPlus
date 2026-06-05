const { pool } = require('../db');

function normalizeFileInput(value, options = {}) {
  if (!value || typeof value !== 'object') return null;
  const fileName = String(value.fileName || options.defaultName || 'file').trim() || options.defaultName || 'file';
  const mimeType = String(value.mimeType || '').trim();
  const data = String(value.data || '').trim();
  if (!data) return null;
  if (options.allowedMimeTypes && !options.allowedMimeTypes.has(mimeType)) {
    throw new Error(options.invalidMimeMessage || 'Unsupported file type');
  }
  const base64 = data.includes(',') ? data.split(',').pop() : data;
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) return null;
  if (options.maxBytes && buffer.length > options.maxBytes) {
    throw new Error(options.maxBytesMessage || 'File is too large');
  }
  return {
    fileName,
    mimeType,
    fileSize: buffer.length,
    buffer
  };
}

async function saveFileWithLink(client = pool, payload = {}) {
  const file = payload.file;
  if (!file) return null;
  const entityType = normalizeRequired(payload.entityType, 'entityType');
  const entityId = normalizeRequired(payload.entityId, 'entityId');
  const fileType = normalizeRequired(payload.fileType, 'fileType');
  const storedName = payload.storedName || `${entityId}_${Date.now()}_${file.fileName}`;
  const storagePath = normalizeRequired(payload.storagePath, 'storagePath');
  const currentUser = payload.currentUser || {};

  const { rows } = await client.query(
    `INSERT INTO files (
       original_name, stored_name, mime_type, file_size, storage_provider, storage_path,
       uploaded_by_staff_id, uploaded_by_member_id, file_data
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING file_id`,
    [
      file.fileName,
      storedName,
      file.mimeType,
      file.fileSize,
      payload.storageProvider || 'postgres',
      storagePath,
      currentUser && currentUser.staffId ? String(currentUser.staffId) : null,
      payload.uploadedByMemberId || null,
      file.buffer || null
    ]
  );
  const fileId = rows[0].file_id;
  await client.query(
    `INSERT INTO file_links (file_id, entity_type, entity_id, file_type, sort_order)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (file_id, entity_type, entity_id, file_type) DO NOTHING`,
    [fileId, entityType, entityId, fileType, Number(payload.sortOrder || 0)]
  );
  return fileId;
}

function toDataUrl(row) {
  return row && row.file_data
    ? `data:${row.mime_type || 'application/octet-stream'};base64,${row.file_data.toString('base64')}`
    : '';
}

function normalizeRequired(value, fieldName) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`Missing required file field: ${fieldName}`);
  return text;
}

module.exports = {
  normalizeFileInput,
  saveFileWithLink,
  toDataUrl
};
