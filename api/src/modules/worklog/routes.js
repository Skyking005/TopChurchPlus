const { pool } = require('../../db');
const { parseUser } = require('../../shared/users');

function registerWorkLogRoutes(app) {
  app.get('/work-logs', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      assertLoggedIn(currentUser);
      res.json(await getWorkLogs(currentUser, req.query));
    } catch (err) {
      next(err);
    }
  });

  app.post('/work-logs', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      assertLoggedIn(currentUser);
      res.json(await saveWorkLog(currentUser, req.body.workLog || {}));
    } catch (err) {
      next(err);
    }
  });

  app.delete('/work-logs/:workLogId', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      assertLoggedIn(currentUser);
      const result = await pool.query(
        `DELETE FROM work_logs
         WHERE work_log_id = $1
           AND staff_id = $2`,
        [req.params.workLogId, String(currentUser.staffId)]
      );
      if (!result.rowCount) throw new Error('找不到此工作日誌');
      res.json({ success: true, message: '工作日誌已刪除' });
    } catch (err) {
      next(err);
    }
  });
}

async function getWorkLogs(currentUser, query = {}) {
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
  const { rows } = await pool.query(
    `SELECT *
     FROM work_logs
     WHERE staff_id = $1
     ORDER BY log_date DESC, created_at DESC
     LIMIT $2`,
    [String(currentUser.staffId), limit]
  );
  return rows.map(toWorkLog);
}

async function saveWorkLog(currentUser, payload) {
  const logDate = normalizeDate(payload.logDate || payload.log_date);
  const workItem = String(payload.workItem || payload.work_item || '').trim();
  if (!workItem) throw new Error('請填寫工作項目');

  const { rows } = await pool.query(
    `INSERT INTO work_logs (staff_id, log_date, work_item, updated_at)
     VALUES ($1,$2,$3,now())
     RETURNING *`,
    [String(currentUser.staffId), logDate, workItem]
  );
  return { success: true, message: '工作日誌已新增', workLog: toWorkLog(rows[0]) };
}

function assertLoggedIn(currentUser) {
  if (!currentUser || !currentUser.staffId || !currentUser.name) {
    throw new Error('缺少登入者資訊');
  }
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('請選擇日期');
  return text;
}

function toWorkLog(row) {
  return {
    workLogId: row.work_log_id,
    staffId: row.staff_id,
    logDate: row.log_date,
    workItem: row.work_item,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

module.exports = { registerWorkLogRoutes };
