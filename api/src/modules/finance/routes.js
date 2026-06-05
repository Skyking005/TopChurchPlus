const { pool, tx } = require('../../db');
const { FEATURE_ACCESS_RANK, PARAM_CATEGORIES, SYSTEM_FEATURES } = require('../core/catalog');

function registerFinanceRoutes(app) {
  app.get('/purchases', async (req, res, next) => {
  try {
    await assertFeatureReadable(parseUser(req), 'finance');
    const keyword = String(req.query.keyword || '').trim().toLowerCase();
    const where = [];
    const values = [];

    if (keyword) {
      values.push(`%${keyword}%`);
      where.push(`(lower(purchase_id) LIKE $${values.length} OR lower(summary) LIKE $${values.length} OR lower(applicant) LIKE $${values.length} OR lower(department) LIKE $${values.length})`);
    }

    const { rows } = await pool.query(
      `SELECT purchase_id, summary, status, total_amount
       FROM purchases
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY purchase_id DESC`,
      values
    );

    res.json(rows.map(toPurchaseListItem));
  } catch (err) {
    next(err);
  }
});

  app.post('/purchases/detail', async (req, res, next) => {
  try {
    const currentUser = req.body.currentUser || {};
    await assertFeatureReadable(currentUser, 'finance');
    const purchaseId = req.body.purchaseId || '';
    if (!purchaseId) return res.json(createEmptyPurchase(currentUser));
    res.json(await getPurchaseDetail(purchaseId));
  } catch (err) {
    next(err);
  }
});

  app.post('/purchases', async (req, res, next) => {
  try {
    await assertFeatureEditable(req.body.currentUser, 'finance');
    res.json(await savePurchase(req.body));
  } catch (err) {
    next(err);
  }
});

  app.patch('/purchases/:purchaseId/close', async (req, res, next) => {
  try {
    await assertFeatureEditable(req.body.currentUser, 'finance');
    const result = await pool.query(
      `UPDATE purchases SET status = '已結案', updated_at = now() WHERE purchase_id = $1`,
      [req.params.purchaseId]
    );
    if (!result.rowCount) throw new Error('找不到採購資料');
    res.json({ success: true, message: '採購案已結案' });
  } catch (err) {
    next(err);
  }
});

  app.post('/purchases/:purchaseId/advances', async (req, res, next) => {
  try {
    await assertFeatureEditable(req.body.currentUser, 'finance');
    res.json(await savePurchaseAdvance(req.params.purchaseId, req.body));
  } catch (err) {
    next(err);
  }
});

  app.post('/purchases/:purchaseId/expense-proofs', async (req, res, next) => {
  try {
    await assertFeatureEditable(req.body.currentUser, 'finance');
    res.json(await saveExpenseProof(req.params.purchaseId, req.body));
  } catch (err) {
    next(err);
  }
});

  app.post('/purchases/:purchaseId/payment-requests', async (req, res, next) => {
  try {
    await assertFeatureEditable(req.body.currentUser, 'finance');
    res.json(await savePaymentRequest(req.params.purchaseId, req.body));
  } catch (err) {
    next(err);
  }
});
}

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

async function getEffectiveFeaturePermissions(user) {
  const roles = normalizeRoles(user && user.roles, user && user.role);
  if (!roles.length) return {};

  const { rows } = await pool.query(
    `SELECT feature_key, access_level
     FROM role_feature_permissions
     WHERE role = ANY($1::text[])`,
    [roles]
  );

  const access = {};
  rows.forEach(row => {
    const current = access[row.feature_key] || 'none';
    if ((FEATURE_ACCESS_RANK[row.access_level] || 0) > (FEATURE_ACCESS_RANK[current] || 0)) {
      access[row.feature_key] = row.access_level;
    }
  });
  return access;
}

async function getFeatureAccess(user, featureKey) {
  if (!SYSTEM_FEATURES.includes(featureKey)) return 'none';
  if (user && user.featurePermissions && user.featurePermissions[featureKey]) {
    return user.featurePermissions[featureKey];
  }
  const access = await getEffectiveFeaturePermissions(user);
  return access[featureKey] || 'none';
}

async function assertFeatureReadable(user, featureKey) {
  if (!user || !user.name) throw new Error('缺少登入者資訊');
  const access = await getFeatureAccess(user, featureKey);
  if (access === 'read' || access === 'edit') return access;
  throw new Error('沒有此系統功能的使用權限');
}

async function assertFeatureEditable(user, featureKey) {
  assertDesktop(user);
  const access = await getFeatureAccess(user, featureKey);
  if (access === 'edit') return true;
  throw new Error('沒有此系統功能的操作權限');
}

function normalizeRoles(roles, fallbackRole) {
  const values = Array.isArray(roles) ? roles : [];
  const normalized = values
    .concat(fallbackRole || [])
    .map(role => String(role || '').trim())
    .filter(Boolean);
  return [...new Set(normalized)];
}

function hasRole(user, role) {
  const roles = normalizeRoles(user && user.roles, user && user.role);
  return roles.includes(role);
}

function hasAnyRole(user, rolesToCheck) {
  const roles = normalizeRoles(user && user.roles, user && user.role);
  return rolesToCheck.some(role => roles.includes(role));
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

async function getPurchaseDetail(purchaseId) {
  const { rows } = await pool.query('SELECT * FROM purchases WHERE purchase_id = $1', [purchaseId]);
  const purchase = rows[0];
  if (!purchase) throw new Error('找不到採購資料');

  const [items, advances, advanceItems, expenseProofs, expenseProofItems, payments, paymentItems] = await Promise.all([
    getPurchaseChildRows('purchase_items', 'purchase_id', purchaseId),
    getPurchaseChildRows('purchase_advances', 'purchase_id', purchaseId),
    getAdvanceItems(purchaseId),
    getPurchaseChildRows('purchase_expense_proofs', 'purchase_id', purchaseId),
    getExpenseProofItems(purchaseId),
    getPurchaseChildRows('purchase_payment_requests', 'purchase_id', purchaseId),
    getPaymentItems(purchaseId)
  ]);

  return {
    purchase: toPurchaseDetail(purchase),
    items: items.map(toPurchaseItem),
    advances: advances.map(row => toAdvance(row, advanceItems.filter(item => item.advance_id === row.advance_id))),
    expenseProofs: expenseProofs.map(row => toExpenseProof(row, expenseProofItems.filter(item => item.proof_id === row.proof_id))),
    payments: payments.map(row => toPaymentRequest(row, paymentItems.filter(item => item.payment_id === row.payment_id)))
  };
}

async function savePurchase(payload) {
  const { currentUser, purchase, items = [] } = payload;
  assertDesktop(currentUser);
  if (!purchase['採購摘要']) throw new Error('請填寫採購摘要');
  if (!items.length) throw new Error('請至少新增一筆請購詳情');

  return tx(async client => {
    let purchaseId = purchase['採購編號'];
    const isNew = !purchaseId;
    if (!purchaseId) purchaseId = await generateSerialId(client, 'purchases', 'purchase_id', 'P');

    const totalAmount = items.reduce((sum, row) => sum + Number(row['總價'] || 0), 0);
    await client.query(
      `INSERT INTO purchases (
        purchase_id, hall, department, applicant, request_date, summary, reason, status, total_amount, created_by, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
      ON CONFLICT (purchase_id) DO UPDATE SET
        hall = EXCLUDED.hall,
        department = EXCLUDED.department,
        applicant = EXCLUDED.applicant,
        request_date = EXCLUDED.request_date,
        summary = EXCLUDED.summary,
        reason = EXCLUDED.reason,
        status = EXCLUDED.status,
        total_amount = EXCLUDED.total_amount,
        updated_at = now()`,
      [
        purchaseId,
        purchase['會堂'] || '',
        purchase['部門'] || '',
        purchase['申請人'] || currentUser.name || '',
        purchase['申請日期'] || new Date(),
        purchase['採購摘要'],
        purchase['申請詳細原因'] || '',
        purchase['請購狀態'] || '申請中',
        totalAmount,
        currentUser.name || ''
      ]
    );

    await replacePurchaseRows(client, 'purchase_items', 'purchase_id', purchaseId, items, insertPurchaseItem);
    return { success: true, purchaseId, message: isNew ? '採購申請已建立' : '採購申請已儲存' };
  });
}

async function savePurchaseAdvance(purchaseId, payload) {
  const { currentUser, advance, items = [] } = payload;
  assertDesktop(currentUser);
  await assertPurchaseEditable(purchaseId);
  if (!items.length) throw new Error('請至少新增一筆預借詳情');
  if (needsBankInfo(advance['支付方式']) && !advance['帳號']) throw new Error('非現金交付時請填寫匯款資料');

  return tx(async client => {
    const advanceId = await generateSerialId(client, 'purchase_advances', 'advance_id', 'A');
    const totalAmount = items.reduce((sum, row) => sum + Number(row['金額'] || 0), 0);
    await client.query(
      `INSERT INTO purchase_advances (
        advance_id, purchase_id, hall, borrower, request_date, total_amount, expected_clear_date,
        payment_method, bank, branch, account_name, account_no
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        advanceId,
        purchaseId,
        advance['請款會堂'] || '',
        advance['借款人'] || currentUser.name || '',
        advance['申請日期'] || new Date(),
        totalAmount,
        advance['預計核銷日期'] || null,
        advance['支付方式'] || '',
        advance['匯款銀行'] || '',
        advance['分行'] || '',
        advance['帳戶名稱'] || '',
        advance['帳號'] || ''
      ]
    );
    await replacePurchaseRows(client, 'purchase_advance_items', 'advance_id', advanceId, items, insertAdvanceItem);
    return { success: true, advanceId, message: '預借申請已建立' };
  });
}

async function saveExpenseProof(purchaseId, payload) {
  const { currentUser, proof, items = [] } = payload;
  assertDesktop(currentUser);
  await assertPurchaseEditable(purchaseId);
  if (!items.length) throw new Error('請至少新增一筆支出證明詳情');

  return tx(async client => {
    const proofId = await generateSerialId(client, 'purchase_expense_proofs', 'proof_id', 'E');
    const paidAmount = items.reduce((sum, row) => sum + Number(row['費用'] || 0), 0);
    await client.query(
      `INSERT INTO purchase_expense_proofs (
        proof_id, purchase_id, hall, request_date, paid_amount, no_receipt_reason,
        recipient_name, recipient_identity_no, recipient_address
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        proofId,
        purchaseId,
        proof['請款會堂'] || '',
        proof['申請日期'] || new Date(),
        Number(proof['實付金額'] || paidAmount),
        proof['不能取得單據原因'] || '',
        proof['姓名'] || '',
        proof['身分證字號'] || '',
        proof['地址'] || ''
      ]
    );
    await replacePurchaseRows(client, 'purchase_expense_proof_items', 'proof_id', proofId, items, insertExpenseProofItem);
    return { success: true, proofId, message: '支出證明申請已建立' };
  });
}

async function savePaymentRequest(purchaseId, payload) {
  const { currentUser, payment, items = [] } = payload;
  assertDesktop(currentUser);
  await assertPurchaseEditable(purchaseId);
  if (!items.length) throw new Error('請至少新增一筆請款詳情');
  if (payment['支付方式'] === '匯款交付墊款人' && !payment['帳號']) throw new Error('匯款交付墊款人時請填寫匯款資料');

  return tx(async client => {
    const paymentId = await generateSerialId(client, 'purchase_payment_requests', 'payment_id', 'R');
    const totalAmount = items.reduce((sum, row) => sum + Number(row['總價'] || 0), 0);
    await client.query(
      `INSERT INTO purchase_payment_requests (
        payment_id, purchase_id, hall, claimant, request_date, total_amount, has_advance,
        payment_method, advance_id, advance_amount, offset_amount, behalf_amount, return_amount,
        bank, branch, account_name, account_no
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        paymentId,
        purchaseId,
        payment['請款會堂'] || '',
        payment['請款人'] || currentUser.name || '',
        payment['申請日期'] || new Date(),
        totalAmount,
        String(payment['是否有預借'] || '') === '是',
        payment['支付方式'] || '',
        payment['預借編號'] || null,
        Number(payment['前已預借金額'] || 0),
        Number(payment['轉正'] || 0),
        Number(payment['代支'] || 0),
        Number(payment['繳回'] || 0),
        payment['匯款銀行'] || '',
        payment['分行'] || '',
        payment['帳戶名稱'] || '',
        payment['帳號'] || ''
      ]
    );
    await replacePurchaseRows(client, 'purchase_payment_items', 'payment_id', paymentId, items, insertPaymentItem);
    return { success: true, paymentId, message: '請款申請已建立' };
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

function assertDesktop(currentUser) {
  if (!currentUser || currentUser.deviceType === 'mobile') {
    throw new Error('手機版僅提供瀏覽功能，請使用電腦操作');
  }
}

function assertSuperAdmin(currentUser) {
  assertDesktop(currentUser);
  if (!currentUser.isSuperAdmin && !hasRole(currentUser, '超級管理者')) {
    throw new Error('只有超級管理者可以操作系統層級設定');
  }
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

function toPurchaseListItem(row) {
  return {
    purchaseId: row.purchase_id,
    summary: row.summary,
    status: row.status,
    totalAmount: Number(row.total_amount || 0)
  };
}

function toPurchaseDetail(row) {
  return {
    '採購編號': row.purchase_id,
    '會堂': row.hall,
    '部門': row.department,
    '申請人': row.applicant,
    '申請日期': formatDate(row.request_date),
    '採購摘要': row.summary,
    '申請詳細原因': row.reason,
    '請購狀態': row.status,
    '總計金額': Number(row.total_amount || 0)
  };
}

function toPurchaseItem(row) {
  return {
    '項目': row.item,
    '數量': Number(row.quantity || 0),
    '單價': Number(row.unit_price || 0),
    '總價': Number(row.subtotal || 0),
    '備註': row.note
  };
}

function toAdvance(row, items) {
  return {
    '預借編號': row.advance_id,
    '請購編號': row.purchase_id,
    '請款會堂': row.hall,
    '借款人': row.borrower,
    '申請日期': formatDate(row.request_date),
    '預借總金額': Number(row.total_amount || 0),
    '預計核銷日期': formatDate(row.expected_clear_date),
    '支付方式': row.payment_method,
    '匯款銀行': row.bank,
    '分行': row.branch,
    '帳戶名稱': row.account_name,
    '帳號': row.account_no,
    items: items.map(item => ({
      '項次': item.sort_order,
      '事由': item.reason,
      '金額': Number(item.amount || 0),
      '備註/說明': item.note
    }))
  };
}

function toExpenseProof(row, items) {
  return {
    '支出證明編號': row.proof_id,
    '請購編號': row.purchase_id,
    '請款會堂': row.hall,
    '申請日期': formatDate(row.request_date),
    '實付金額': Number(row.paid_amount || 0),
    '不能取得單據原因': row.no_receipt_reason,
    '姓名': row.recipient_name,
    '身分證字號': row.recipient_identity_no,
    '地址': row.recipient_address,
    items: items.map(item => ({
      '項次': item.sort_order,
      '項目': item.item,
      '費用': Number(item.amount || 0)
    }))
  };
}

function toPaymentRequest(row, items) {
  return {
    '請款編號': row.payment_id,
    '請購編號': row.purchase_id,
    '請款會堂': row.hall,
    '請款人': row.claimant,
    '申請日期': formatDate(row.request_date),
    '請款總金額': Number(row.total_amount || 0),
    '是否有預借': row.has_advance ? '是' : '否',
    '支付方式': row.payment_method,
    '預借編號': row.advance_id,
    '前已預借金額': Number(row.advance_amount || 0),
    '轉正': Number(row.offset_amount || 0),
    '代支': Number(row.behalf_amount || 0),
    '繳回': Number(row.return_amount || 0),
    '匯款銀行': row.bank,
    '分行': row.branch,
    '帳戶名稱': row.account_name,
    '帳號': row.account_no,
    items: items.map(item => ({
      '項目': item.item,
      '數量': Number(item.quantity || 0),
      '單價': Number(item.unit_price || 0),
      '總價': Number(item.subtotal || 0),
      '備註': item.note
    }))
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

function createEmptyPurchase(currentUser) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    purchase: {
      '採購編號': '',
      '會堂': '',
      '部門': '',
      '申請人': currentUser.name || '',
      '申請日期': today,
      '採購摘要': '',
      '申請詳細原因': '',
      '請購狀態': '申請中',
      '總計金額': 0
    },
    items: [],
    advances: [],
    expenseProofs: [],
    payments: []
  };
}

async function getPurchaseChildRows(table, column, value) {
  const orderBy = table.endsWith('_items') || table === 'purchase_items'
    ? 'sort_order, id'
    : 'created_at, updated_at';
  const { rows } = await pool.query(`SELECT * FROM ${table} WHERE ${column} = $1 ORDER BY ${orderBy}`, [value]);
  return rows;
}

async function getAdvanceItems(purchaseId) {
  const { rows } = await pool.query(
    `SELECT i.*
     FROM purchase_advance_items i
     JOIN purchase_advances a ON a.advance_id = i.advance_id
     WHERE a.purchase_id = $1
     ORDER BY i.advance_id, i.sort_order, i.id`,
    [purchaseId]
  );
  return rows;
}

async function getExpenseProofItems(purchaseId) {
  const { rows } = await pool.query(
    `SELECT i.*
     FROM purchase_expense_proof_items i
     JOIN purchase_expense_proofs p ON p.proof_id = i.proof_id
     WHERE p.purchase_id = $1
     ORDER BY i.proof_id, i.sort_order, i.id`,
    [purchaseId]
  );
  return rows;
}

async function getPaymentItems(purchaseId) {
  const { rows } = await pool.query(
    `SELECT i.*
     FROM purchase_payment_items i
     JOIN purchase_payment_requests p ON p.payment_id = i.payment_id
     WHERE p.purchase_id = $1
     ORDER BY i.payment_id, i.sort_order, i.id`,
    [purchaseId]
  );
  return rows;
}

async function replacePurchaseRows(client, table, column, value, rows, insertFn) {
  await client.query(`DELETE FROM ${table} WHERE ${column} = $1`, [value]);
  for (let i = 0; i < rows.length; i += 1) await insertFn(client, value, rows[i], i + 1);
}

function insertPurchaseItem(client, purchaseId, row, sortOrder) {
  return client.query(
    'INSERT INTO purchase_items (purchase_id, item, quantity, unit_price, subtotal, note, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [purchaseId, row['項目'] || '', Number(row['數量'] || 0), Number(row['單價'] || 0), Number(row['總價'] || 0), row['備註'] || '', sortOrder]
  );
}

function insertAdvanceItem(client, advanceId, row, sortOrder) {
  return client.query(
    'INSERT INTO purchase_advance_items (advance_id, reason, amount, note, sort_order) VALUES ($1,$2,$3,$4,$5)',
    [advanceId, row['事由'] || '', Number(row['金額'] || 0), row['備註/說明'] || '', sortOrder]
  );
}

function insertExpenseProofItem(client, proofId, row, sortOrder) {
  return client.query(
    'INSERT INTO purchase_expense_proof_items (proof_id, item, amount, sort_order) VALUES ($1,$2,$3,$4)',
    [proofId, row['項目'] || '', Number(row['費用'] || 0), sortOrder]
  );
}

function insertPaymentItem(client, paymentId, row, sortOrder) {
  return client.query(
    'INSERT INTO purchase_payment_items (payment_id, item, quantity, unit_price, subtotal, note, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [paymentId, row['項目'] || '', Number(row['數量'] || 0), Number(row['單價'] || 0), Number(row['總價'] || 0), row['備註'] || '', sortOrder]
  );
}

async function assertPurchaseEditable(purchaseId) {
  const { rows } = await pool.query('SELECT status FROM purchases WHERE purchase_id = $1', [purchaseId]);
  if (!rows[0]) throw new Error('找不到採購資料');
  if (rows[0].status === '已結案') throw new Error('已結案的採購案不可新增申請單');
}

async function generateSerialId(client, table, column, prefix) {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const idPrefix = `${prefix}${datePart}`;
  const { rows } = await client.query(
    `SELECT ${column} AS id FROM ${table} WHERE ${column} LIKE $1 ORDER BY ${column} DESC LIMIT 1`,
    [`${idPrefix}%`]
  );
  const next = rows[0] ? Number(String(rows[0].id).slice(-4)) + 1 : 1;
  return `${idPrefix}${String(next).padStart(4, '0')}`;
}

function needsBankInfo(paymentMethod) {
  return paymentMethod === '已匯款交付借款人' || paymentMethod === '逕行匯款給廠商';
}

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

function getDefaultDepartments() {
  return ['秘書部', '牧養部', '教育部', '行政部', '財務部', '資訊部', '技術部', '媒體部'];
}

function parseUser(req) {
  const raw = req.get('x-current-user');
  if (!raw) return {};
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch (err) {
    return {};
  }
}

function parseQueryUser(req) {
  const raw = req.query.currentUser;
  if (!raw) return {};
  try {
    return JSON.parse(Buffer.from(String(raw), 'base64url').toString('utf8'));
  } catch (err) {
    return {};
  }
}


module.exports = { registerFinanceRoutes };
