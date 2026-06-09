const fs = require('fs/promises');
const path = require('path');

const { pool } = require('../../db');
const { recordAuditLog } = require('../../shared/audit');
const { assertSuperAdmin, parseUser } = require('../../shared/users');

const FEATURE_KEY = 'dev_management';
const ISSUE_TYPES = new Set(['feature', 'issue', 'maintain']);
const ISSUE_STATUSES = new Set(['提案', '取消', '完成']);
const ISSUE_PRIORITIES = new Set(['低', '中', '高']);

const REVIEW_DOCUMENTS = [
  { key: 'NEW_THREAD_GUIDE', title: 'NEW_THREAD_GUIDE /new 對話指南', path: 'docs/NEW_THREAD_GUIDE.md', group: '交接' },
  { key: 'HANDOFF', title: 'HANDOFF 交接文件', path: 'docs/HANDOFF.md', group: '交接' },
  { key: 'DOCUMENTATION_MAINTENANCE', title: 'DOCUMENTATION_MAINTENANCE 文件維護矩陣', path: 'docs/DOCUMENTATION_MAINTENANCE.md', group: '流程' },
  { key: 'SYSTEM_ARCHITECTURE', title: 'SYSTEM_ARCHITECTURE 系統架構', path: 'docs/SYSTEM_ARCHITECTURE.md', group: '架構' },
  { key: 'DATABASE_SCHEMA', title: 'DATABASE_SCHEMA 資料庫結構', path: 'docs/DATABASE_SCHEMA.md', group: '資料庫' },
  { key: 'API_CATALOG', title: 'API_CATALOG API 目錄', path: 'docs/API_CATALOG.md', group: 'API' },
  { key: 'MODULES', title: 'MODULES 模組清單', path: 'docs/MODULES.md', group: '模組' },
  { key: 'WORKFLOW', title: 'WORKFLOW 工作流程', path: 'docs/WORKFLOW.md', group: '流程' },
  { key: 'TEST_MATRIX', title: 'TEST_MATRIX 測試矩陣', path: 'docs/TEST_MATRIX.md', group: '測試' },
  { key: 'AGENTS', title: 'AGENTS 專案規則', path: 'AGENTS.md', group: '規則' },
  { key: 'SKILL', title: 'TopChurchPlus Skill 摘要', path: 'docs/TOPCHURCHPLUS_SKILL.md', group: '規則' }
];

function registerDevManagementRoutes(app) {
  app.get('/dev-management/issues', async (req, res, next) => {
    try {
      assertSuperAdmin(parseUser(req));
      res.json(await getIssues(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.post('/dev-management/issues', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      assertSuperAdmin(currentUser);
      res.json(await saveIssue(req.body.issue || {}, currentUser, req));
    } catch (err) {
      next(err);
    }
  });

  app.put('/dev-management/issues/:issueId', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      assertSuperAdmin(currentUser);
      res.json(await saveIssue({ ...(req.body.issue || {}), issueId: req.params.issueId }, currentUser, req));
    } catch (err) {
      next(err);
    }
  });

  app.get('/dev-management/documents', async (req, res, next) => {
    try {
      assertSuperAdmin(parseUser(req));
      res.json({ rows: await getDocumentSummaries() });
    } catch (err) {
      next(err);
    }
  });

  app.get('/dev-management/documents/:documentKey', async (req, res, next) => {
    try {
      assertSuperAdmin(parseUser(req));
      res.json(await getDocumentDetail(req.params.documentKey));
    } catch (err) {
      next(err);
    }
  });

  app.get('/dev-management/releases', async (req, res, next) => {
    try {
      assertSuperAdmin(parseUser(req));
      res.json(await getReleases(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.post('/dev-management/releases', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      assertSuperAdmin(currentUser);
      res.json(await saveRelease(req.body.release || {}, currentUser, req));
    } catch (err) {
      next(err);
    }
  });
}

async function getIssues(query = {}) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const values = [];
  const where = [];

  addFilter(where, values, 'issue_type', query.type, ISSUE_TYPES);
  addFilter(where, values, 'status', query.status, ISSUE_STATUSES);
  addFilter(where, values, 'priority', query.priority, ISSUE_PRIORITIES);

  const keyword = String(query.keyword || '').trim().toLowerCase();
  if (keyword) {
    values.push(`%${keyword}%`);
    where.push(`(
      lower(description) LIKE $${values.length}
      OR lower(coalesce(created_by_name, '')) LIKE $${values.length}
      OR CAST(issue_no AS text) LIKE $${values.length}
    )`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const count = await pool.query(`SELECT COUNT(*)::int AS total FROM development_issues ${whereSql}`, values);
  values.push(pageSize, (page - 1) * pageSize);
  const { rows } = await pool.query(
    `SELECT *
     FROM development_issues
     ${whereSql}
     ORDER BY
       CASE priority WHEN '高' THEN 1 WHEN '中' THEN 2 ELSE 3 END,
       created_at DESC
     LIMIT $${values.length - 1}
     OFFSET $${values.length}`,
    values
  );

  return { rows: rows.map(toIssue), total: count.rows[0].total, page, pageSize };
}

function addFilter(where, values, column, value, allowed) {
  const text = String(value || '').trim();
  if (!text) return;
  if (!allowed.has(text)) throw new Error(`不支援的篩選條件：${text}`);
  values.push(text);
  where.push(`${column} = $${values.length}`);
}

async function saveIssue(payload, currentUser, req) {
  const issueId = String(payload.issueId || '').trim();
  const issueType = normalizeEnum(payload.issueType || payload.type, ISSUE_TYPES, '類型');
  const status = normalizeEnum(payload.status || '提案', ISSUE_STATUSES, '狀態');
  const priority = normalizeEnum(payload.priority || '中', ISSUE_PRIORITIES, '優先度');
  const description = normalizeRequired(payload.description, '描述不可空白');

  if (issueId) {
    const before = await getIssueRow(issueId);
    const { rows } = await pool.query(
      `UPDATE development_issues
       SET issue_type = $1,
           status = $2,
           priority = $3,
           description = $4,
           completed_at = CASE WHEN $2 = '完成' THEN COALESCE(completed_at, now()) ELSE NULL END,
           updated_at = now()
       WHERE issue_id = $5
       RETURNING *`,
      [issueType, status, priority, description, issueId]
    );
    if (!rows[0]) throw new Error('找不到 Issue');
    await logDevAudit(req, currentUser, 'development_issue', issueId, 'update', before, rows[0]);
    return { success: true, message: 'Issue 已更新', issue: toIssue(rows[0]) };
  }

  const { rows } = await pool.query(
    `INSERT INTO development_issues (
       issue_type, status, priority, description,
       created_by_staff_id, created_by_name, completed_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,CASE WHEN $2 = '完成' THEN now() ELSE NULL END)
     RETURNING *`,
    [
      issueType,
      status,
      priority,
      description,
      currentUser.staffId ? String(currentUser.staffId) : null,
      formatUserName(currentUser)
    ]
  );
  await logDevAudit(req, currentUser, 'development_issue', rows[0].issue_id, 'create', null, rows[0]);
  return { success: true, message: 'Issue 已建立', issue: toIssue(rows[0]) };
}

async function getIssueRow(issueId) {
  const { rows } = await pool.query('SELECT * FROM development_issues WHERE issue_id = $1', [issueId]);
  if (!rows[0]) throw new Error('找不到 Issue');
  return rows[0];
}

async function getDocumentSummaries() {
  const rows = [];
  for (const doc of REVIEW_DOCUMENTS) {
    const fullPath = resolveReviewPath(doc.path);
    try {
      const stat = await fs.stat(fullPath);
      rows.push({ ...doc, exists: true, size: stat.size, updatedAt: stat.mtime });
    } catch (err) {
      rows.push({ ...doc, exists: false, size: 0, updatedAt: null });
    }
  }
  return rows;
}

async function getDocumentDetail(documentKey) {
  const doc = REVIEW_DOCUMENTS.find(item => item.key === String(documentKey || '').trim());
  if (!doc) throw new Error('不支援的文件代碼');
  const fullPath = resolveReviewPath(doc.path);
  const content = await fs.readFile(fullPath, 'utf8');
  const stat = await fs.stat(fullPath);
  return {
    ...doc,
    exists: true,
    size: stat.size,
    updatedAt: stat.mtime,
    content,
    lineCount: content.split(/\r?\n/).length
  };
}

function resolveReviewPath(relativePath) {
  const fullPath = path.resolve(process.cwd(), relativePath);
  const root = path.resolve(process.cwd());
  if (!fullPath.startsWith(root)) throw new Error('不允許讀取此文件路徑');
  return fullPath;
}

async function getReleases(query = {}) {
  const limit = Math.min(Math.max(Number(query.limit || 30), 1), 100);
  const { rows } = await pool.query(
    `SELECT *
     FROM development_releases
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return { rows: rows.map(toRelease) };
}

async function saveRelease(payload, currentUser, req) {
  const summary = normalizeRequired(payload.summary, '版本摘要不可空白');
  const { rows } = await pool.query(
    `INSERT INTO development_releases (
       commit_hash, commit_message, apps_script_version,
       api_deployed, apps_script_deployed, summary, verification_result,
       created_by_staff_id, created_by_name
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      normalizeOptional(payload.commitHash),
      normalizeOptional(payload.commitMessage),
      normalizeOptional(payload.appsScriptVersion),
      Boolean(payload.apiDeployed),
      Boolean(payload.appsScriptDeployed),
      summary,
      normalizeOptional(payload.verificationResult),
      currentUser.staffId ? String(currentUser.staffId) : null,
      formatUserName(currentUser)
    ]
  );
  await logDevAudit(req, currentUser, 'development_release', rows[0].release_id, 'create', null, rows[0]);
  return { success: true, message: '版本歷程已新增', release: toRelease(rows[0]) };
}

async function logDevAudit(req, currentUser, entityType, entityId, action, beforeData, afterData) {
  await recordAuditLog({
    currentUser,
    systemKey: FEATURE_KEY,
    entityType,
    entityId: String(entityId),
    action,
    beforeData,
    afterData,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { source: 'dev-management' }
  });
}

function normalizeEnum(value, allowed, fieldName) {
  const text = String(value || '').trim();
  if (!allowed.has(text)) throw new Error(`${fieldName}不正確`);
  return text;
}

function normalizeRequired(value, message) {
  const text = String(value || '').trim();
  if (!text) throw new Error(message);
  return text;
}

function normalizeOptional(value) {
  const text = String(value || '').trim();
  return text || null;
}

function formatUserName(user) {
  return [user.name, user.position].filter(Boolean).join(' ') || null;
}

function toIssue(row) {
  return {
    issueId: row.issue_id,
    issueNo: row.issue_no,
    issueType: row.issue_type,
    status: row.status,
    priority: row.priority,
    description: row.description,
    createdByStaffId: row.created_by_staff_id,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at
  };
}

function toRelease(row) {
  return {
    releaseId: row.release_id,
    commitHash: row.commit_hash,
    commitMessage: row.commit_message,
    appsScriptVersion: row.apps_script_version,
    apiDeployed: row.api_deployed,
    appsScriptDeployed: row.apps_script_deployed,
    summary: row.summary,
    verificationResult: row.verification_result,
    createdByStaffId: row.created_by_staff_id,
    createdByName: row.created_by_name,
    createdAt: row.created_at
  };
}

module.exports = { registerDevManagementRoutes };
