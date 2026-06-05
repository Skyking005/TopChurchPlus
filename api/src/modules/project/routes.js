const { pool, tx } = require('../../db');
const { assertFeatureEditable, assertFeatureReadable } = require('../../shared/permissions');
const { getParams } = require('../../shared/params');
const { assertDesktop, hasAnyRole, parseQueryUser, parseUser } = require('../../shared/users');
const { formatDate, formatDateTime, splitCsv } = require('../../shared/format');

function registerProjectRoutes(app) {
  app.get('/projects', async (req, res, next) => {
  try {
    let currentUser = parseUser(req);
    if (!currentUser || !currentUser.name) currentUser = parseQueryUser(req);
    const keyword = String(req.query.keyword || '').trim().toLowerCase();
    const projectType = String(req.query.projectType || '').trim();
    const unit = String(req.query.unit || '').trim();
    const where = [];
    const values = [];
    const joins = [];

    if (!currentUser || !currentUser.name) {
      throw new Error('缺少登入者資訊，無法查詢專案清單');
    }

    await assertFeatureReadable(currentUser, 'project');

    if (!hasAnyRole(currentUser, ['管理員', '超級管理者'])) {
      joins.push('JOIN project_permissions pp ON pp.project_id = p.project_id');
      if (currentUser.staffId) {
        values.push(String(currentUser.staffId));
        where.push(`pp.staff_id = $${values.length}`);
      } else {
        values.push(currentUser.name);
        where.push(`pp.name = $${values.length}`);
      }
    }

    if (keyword) {
      values.push(`%${keyword}%`);
      where.push(`(lower(p.project_id) LIKE $${values.length} OR lower(p.project_name) LIKE $${values.length} OR lower(p.content) LIKE $${values.length} OR lower(p.login_user) LIKE $${values.length})`);
    }
    if (projectType) {
      values.push(projectType);
      where.push(`p.project_type = $${values.length}`);
    }
    if (unit) {
      values.push(unit);
      where.push(`$${values.length} = ANY(p.units)`);
    }

    const sql = `
      SELECT DISTINCT p.project_id, p.login_user, p.project_name, p.project_type, p.start_date, p.end_date, p.units, p.status
      FROM projects p
      ${joins.join(' ')}
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY p.project_id DESC
    `;
    const { rows } = await pool.query(sql, values);
    res.json(rows.map(toProjectListItem));
  } catch (err) {
    next(err);
  }
});

  app.get('/projects/:projectId/detail', async (req, res, next) => {
  try {
    const currentUser = parseUser(req);
    const data = await getProjectDetail(req.params.projectId, currentUser);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

  app.post('/projects/detail', async (req, res, next) => {
  try {
    const currentUser = req.body.currentUser;
    const projectId = req.body.projectId || '';
    if (!projectId) return res.json(createEmptyProject(currentUser));
    const data = await getProjectDetail(projectId, currentUser);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

  app.post('/projects', async (req, res, next) => {
  try {
    await assertFeatureEditable(req.body.currentUser, 'project');
    const result = await saveProject(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

  app.get('/projects/:projectId/meetings', async (req, res, next) => {
  try {
    const currentUser = parseUser(req);
    await assertProjectAccess(req.params.projectId, currentUser);
    res.json(await getMeetings(req.params.projectId));
  } catch (err) {
    next(err);
  }
});

  app.post('/projects/:projectId/permissions', async (req, res, next) => {
  try {
    const { currentUser, staffId, permission } = req.body;
    await assertFullControl(req.params.projectId, currentUser);
    if (!staffId || !permission) throw new Error('權限資料不完整');

    const { rows } = await pool.query('SELECT staff_id, name FROM accounts WHERE staff_id = $1', [staffId]);
    const account = rows[0];
    if (!account) throw new Error('找不到人員資料');

    await pool.query(
      `INSERT INTO project_permissions (project_id, staff_id, name, permission)
       VALUES ($1, $2, $3, $4)`,
      [req.params.projectId, staffId, account.name, permission]
    );

    res.json({ success: true, message: '已新增專案權限' });
  } catch (err) {
    next(err);
  }
});

  app.delete('/projects/:projectId/permissions/:staffId', async (req, res, next) => {
  try {
    await assertFullControl(req.params.projectId, parseUser(req));
    const result = await pool.query(
      'DELETE FROM project_permissions WHERE project_id = $1 AND staff_id = $2',
      [req.params.projectId, req.params.staffId]
    );
    if (!result.rowCount) throw new Error('找不到要刪除的權限資料');
    res.json({ success: true, message: '已刪除專案權限' });
  } catch (err) {
    next(err);
  }
});

  app.post('/meetings', async (req, res, next) => {
  try {
    const { currentUser, meeting } = req.body;
    const projectId = meeting['計畫編號'];
    await assertFullControl(projectId, currentUser);
    const meetingId = await generateMeetingId();

    await pool.query(
      `INSERT INTO meetings (meeting_id, project_id, meeting_time, topic, agenda, decision, attendees, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        meetingId,
        projectId,
        meeting['會議時間'] || null,
        meeting['會議主題'] || '',
        meeting['討論議題'] || '',
        meeting['會議決議'] || '',
        splitCsv(meeting['與會者']),
        meeting['會議狀態'] || '預約中'
      ]
    );
    res.json({ success: true, message: '已新增會議記錄' });
  } catch (err) {
    next(err);
  }
});

  app.put('/projects/:projectId/meetings/:meetingId', async (req, res, next) => {
  try {
    const { currentUser, meeting } = req.body;
    await assertFullControl(req.params.projectId, currentUser);
    const old = await pool.query('SELECT status FROM meetings WHERE meeting_id = $1', [req.params.meetingId]);
    if (!old.rows[0]) throw new Error('找不到會議資料');

    await pool.query(
      `UPDATE meetings
       SET meeting_time = $1, topic = $2, agenda = $3, decision = $4, attendees = $5, status = $6, updated_at = now()
       WHERE meeting_id = $7`,
      [
        meeting['會議時間'] || null,
        meeting['會議主題'] || '',
        meeting['討論議題'] || '',
        meeting['會議決議'] || '',
        splitCsv(meeting['與會者']),
        meeting['會議狀態'] || old.rows[0].status,
        req.params.meetingId
      ]
    );
    res.json({ success: true, message: '已更新會議記錄' });
  } catch (err) {
    next(err);
  }
});

  app.patch('/projects/:projectId/meetings/:meetingId/status', async (req, res, next) => {
  try {
    const { currentUser, status } = req.body;
    await assertFullControl(req.params.projectId, currentUser);
    const result = await pool.query(
      'UPDATE meetings SET status = $1, updated_at = now() WHERE meeting_id = $2',
      [status, req.params.meetingId]
    );
    if (!result.rowCount) throw new Error('找不到會議資料');
    res.json({ success: true, message: `會議狀態已改為「${status}」` });
  } catch (err) {
    next(err);
  }
});
}

async function getProjectDetail(projectId, currentUser) {
  await assertFeatureReadable(currentUser, 'project');
  const project = await getProject(projectId);
  if (!project) throw new Error('找不到此專案資料');
  const access = await assertProjectAccess(projectId, currentUser);
  const [people, income, budget, meetings, permissions] = await Promise.all([
    getChildRows('project_people', projectId),
    getChildRows('project_income', projectId),
    getChildRows('project_budget', projectId),
    getMeetings(projectId),
    getPermissions(projectId)
  ]);
  return {
    project: toProjectDetail(project),
    people: people.map(toPeopleRow),
    income: income.map(toIncomeRow),
    budget: budget.map(toBudgetRow),
    meetings,
    projectPermissions: permissions.map(toPermissionRow),
    projectAccess: hasAnyRole(currentUser, ['管理員', '超級管理者']) ? '完全控制' : access,
    permission: await getProjectPermission(project, currentUser, access)
  };
}

async function saveProject(payload) {
  const { currentUser, project, people = [], income = [], budget = [] } = payload;
  assertDesktop(currentUser);

  return tx(async client => {
    let projectId = project['計畫編號'];
    let isNew = false;
    let oldProject = null;

    if (!projectId) {
      projectId = await generateProjectId(client);
      project['計畫編號'] = projectId;
      isNew = true;
    } else {
      oldProject = (await client.query('SELECT * FROM projects WHERE project_id = $1', [projectId])).rows[0];
      if (!oldProject) throw new Error('找不到專案資料');
      await validateEditPermission(oldProject, project, currentUser);
    }

    const totalIncome = income.reduce((sum, r) => sum + Number(r['小計'] || 0), 0);
    const totalBudget = budget.reduce((sum, r) => sum + Number(r['小計'] || 0), 0);

    await client.query(
      `INSERT INTO projects (
        project_id, login_user, project_name, project_type, start_date, end_date, units, content,
        is_charged, total_income, total_budget, difference_method, status, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
      ON CONFLICT (project_id) DO UPDATE SET
        login_user = EXCLUDED.login_user,
        project_name = EXCLUDED.project_name,
        project_type = EXCLUDED.project_type,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        units = EXCLUDED.units,
        content = EXCLUDED.content,
        is_charged = EXCLUDED.is_charged,
        total_income = EXCLUDED.total_income,
        total_budget = EXCLUDED.total_budget,
        difference_method = EXCLUDED.difference_method,
        status = EXCLUDED.status,
        updated_at = now()`,
      [
        projectId,
        project['專案登入人'],
        project['專案名稱'],
        project['專案類型'],
        project['專案執行開始時間'] || null,
        project['專案執行結束時間'] || null,
        splitCsv(project['專案執行單位']),
        project['專案內容'],
        project['專案是否收費'] || '否',
        totalIncome,
        totalBudget,
        project['收支差額處理方式'],
        project['專案狀態'] || '規劃中'
      ]
    );

    if (isNew) await createDefaultProjectPermission(client, projectId, project['專案登入人']);
    await replaceRows(client, 'project_people', projectId, people, insertPeopleRow);
    await replaceRows(client, 'project_income', projectId, income, insertIncomeRow);
    await replaceRows(client, 'project_budget', projectId, budget, insertBudgetRow);
    return { success: true, projectId, message: '專案資料已儲存' };
  });
}

async function getProject(projectId) {
  const { rows } = await pool.query('SELECT * FROM projects WHERE project_id = $1', [projectId]);
  return rows[0];
}

async function assertProjectAccess(projectId, currentUser) {
  if (hasAnyRole(currentUser, ['管理員', '超級管理者'])) return '完全控制';
  if (!currentUser || !currentUser.name) throw new Error('缺少登入者資訊');
  if (currentUser.staffId) {
    const { rows } = await pool.query(
      'SELECT permission FROM project_permissions WHERE project_id = $1 AND staff_id = $2',
      [projectId, String(currentUser.staffId)]
    );
    if (rows[0]) return rows[0].permission;
  }
  const { rows } = await pool.query(
    'SELECT permission FROM project_permissions WHERE project_id = $1 AND name = $2',
    [projectId, currentUser.name]
  );
  if (!rows[0]) throw new Error('您未被賦予此專案權限');
  return rows[0].permission;
}

async function assertFullControl(projectId, currentUser) {
  assertDesktop(currentUser);
  if (hasAnyRole(currentUser, ['管理員', '超級管理者'])) return true;
  const access = await assertProjectAccess(projectId, currentUser);
  if (access !== '完全控制') throw new Error('您沒有此專案的完全控制權限');
  return true;
}

async function getProjectPermission(project, user, projectAccess) {
  const access = hasAnyRole(user, ['管理員', '超級管理者']) ? '完全控制' : projectAccess;
  if (user.deviceType === 'mobile') {
    return { canEdit: false, canChangeStatus: false, canViewFinance: access !== '不含收支瀏覽', access, statusOptions: [project.status], readonlyReason: '手機版僅提供瀏覽模式' };
  }
  if (access === '完全控制') {
    const params = await getParams();
    return { canEdit: true, canChangeStatus: true, canViewFinance: true, access, statusOptions: params.projectStatus };
  }
  if (access === '完全瀏覽') {
    return { canEdit: false, canChangeStatus: false, canViewFinance: true, access, statusOptions: [project.status], readonlyReason: '您只有瀏覽權限' };
  }
  return { canEdit: false, canChangeStatus: false, canViewFinance: false, access, statusOptions: [project.status], readonlyReason: '您沒有編輯權限' };
}

async function validateEditPermission(oldProject, newProject, user) {
  await assertFullControl(oldProject.project_id, user);
  return true;
}

async function generateProjectId(client = pool) {
  const now = new Date();
  const prefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const { rows } = await client.query(
    `SELECT project_id FROM projects WHERE project_id LIKE $1 ORDER BY project_id DESC LIMIT 1`,
    [`${prefix}%`]
  );
  const next = rows[0] ? Number(rows[0].project_id.slice(6, 8)) + 1 : 1;
  if (next > 99) throw new Error('本月份專案流水碼已超過 99 筆');
  return `${prefix}${String(next).padStart(2, '0')}`;
}

async function generateMeetingId() {
  const now = new Date();
  const prefix = `M${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const { rows } = await pool.query(
    'SELECT meeting_id FROM meetings WHERE meeting_id LIKE $1 ORDER BY meeting_id DESC LIMIT 1',
    [`${prefix}%`]
  );
  const next = rows[0] ? Number(rows[0].meeting_id.slice(-4)) + 1 : 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

async function createDefaultProjectPermission(client, projectId, loginUserName) {
  const { rows } = await client.query('SELECT staff_id, name FROM accounts WHERE name = $1', [loginUserName]);
  const account = rows[0];
  if (!account) return;
  await client.query(
    'INSERT INTO project_permissions (project_id, staff_id, name, permission) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
    [projectId, account.staff_id, account.name, '完全控制']
  );
}

async function getChildRows(table, projectId) {
  const { rows } = await pool.query(`SELECT * FROM ${table} WHERE project_id = $1 ORDER BY sort_order, id`, [projectId]);
  return rows;
}

async function getPermissions(projectId) {
  const { rows } = await pool.query(
    `SELECT pp.*, a.position
     FROM project_permissions pp
     LEFT JOIN accounts a ON a.staff_id = pp.staff_id
     WHERE pp.project_id = $1
     ORDER BY pp.name`,
    [projectId]
  );
  return rows;
}

async function getMeetings(projectId) {
  const { rows } = await pool.query('SELECT * FROM meetings WHERE project_id = $1 ORDER BY meeting_time', [projectId]);
  return rows.map(toMeetingRow);
}

async function replaceRows(client, table, projectId, rows, insertFn) {
  await client.query(`DELETE FROM ${table} WHERE project_id = $1`, [projectId]);
  for (let i = 0; i < rows.length; i += 1) await insertFn(client, projectId, rows[i], i + 1);
}

function insertPeopleRow(client, projectId, row, sortOrder) {
  return client.query(
    'INSERT INTO project_people (project_id, duty, person, item, note, sort_order) VALUES ($1,$2,$3,$4,$5,$6)',
    [projectId, row['職責'] || '', row['主責人'] || '', row['主責項目'] || '', row['備註'] || '', sortOrder]
  );
}

function insertIncomeRow(client, projectId, row, sortOrder) {
  return client.query(
    'INSERT INTO project_income (project_id, unit, item, quantity, unit_price, subtotal, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [projectId, row['會堂'] || '', row['收入項目'] || '', Number(row['數量'] || 0), Number(row['單價'] || 0), Number(row['小計'] || 0), sortOrder]
  );
}

function insertBudgetRow(client, projectId, row, sortOrder) {
  return client.query(
    'INSERT INTO project_budget (project_id, unit, item, quantity, unit_price, subtotal, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [projectId, row['會堂'] || '', row['支出項目'] || '', Number(row['數量'] || 0), Number(row['單價'] || 0), Number(row['小計'] || 0), sortOrder]
  );
}

function toProjectListItem(row) {
  return {
    projectId: row.project_id,
    loginUser: row.login_user,
    projectName: row.project_name,
    projectType: row.project_type,
    startDate: formatDate(row.start_date),
    endDate: formatDate(row.end_date),
    unit: (row.units || []).join(','),
    status: row.status
  };
}

function toProjectDetail(row) {
  return {
    '計畫編號': row.project_id,
    '專案登入人': row.login_user,
    '專案名稱': row.project_name,
    '專案類型': row.project_type,
    '專案執行開始時間': formatDate(row.start_date),
    '專案執行結束時間': formatDate(row.end_date),
    '專案執行單位': (row.units || []).join(','),
    '專案內容': row.content,
    '專案是否收費': row.is_charged,
    '專案總收入': Number(row.total_income || 0),
    '專案總支出': Number(row.total_budget || 0),
    '收支差額處理方式': row.difference_method,
    '專案狀態': row.status
  };
}

function toPeopleRow(row) {
  return { '職責': row.duty, '主責人': row.person, '主責項目': row.item, '備註': row.note };
}
function toIncomeRow(row) {
  return { '會堂': row.unit, '收入項目': row.item, '數量': Number(row.quantity), '單價': Number(row.unit_price), '小計': Number(row.subtotal) };
}
function toBudgetRow(row) {
  return { '會堂': row.unit, '支出項目': row.item, '數量': Number(row.quantity), '單價': Number(row.unit_price), '小計': Number(row.subtotal) };
}
function toPermissionRow(row) {
  return { '人員序號': row.staff_id, '姓名': [row.name, row.position].filter(Boolean).join(' '), '權限': row.permission };
}
function toMeetingRow(row) {
  return {
    '會議編號': row.meeting_id,
    '計畫編號': row.project_id,
    '會議時間': formatDateTime(row.meeting_time),
    '會議主題': row.topic,
    '討論議題': row.agenda,
    '會議決議': row.decision,
    '與會者': (row.attendees || []).join(','),
    '會議狀態': row.status
  };
}

function createEmptyProject(currentUser) {
  return {
    project: {
      '計畫編號': '',
      '專案登入人': currentUser.name || '',
      '專案名稱': '',
      '專案類型': '',
      '專案執行開始時間': '',
      '專案執行結束時間': '',
      '專案執行單位': '',
      '專案內容': '',
      '專案是否收費': '否',
      '專案總收入': 0,
      '專案總支出': 0,
      '收支差額處理方式': '',
      '專案狀態': '規劃中'
    },
    people: [],
    income: [],
    budget: [],
    meetings: [],
    projectPermissions: [],
    permission: { canEdit: true, canChangeStatus: false, canViewFinance: true, statusOptions: ['規劃中'] }
  };
}

module.exports = { registerProjectRoutes };
