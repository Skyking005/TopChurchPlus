const fs = require('fs/promises');
const path = require('path');

const { pool } = require('../../db');
const { assertFeatureReadable } = require('../../shared/permissions');
const { formatDate, formatDateTime } = require('../../shared/format');
const { hasAnyRole, parseUser } = require('../../shared/users');
const { buildSpecDocx } = require('./docx-builder');

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function registerDocumentRoutes(app) {
  app.get('/documents/test-docx', async (req, res, next) => {
    try {
      const file = await createSpecFile({
        title: '卓越行道會測試文件',
        sections: [
          { title: '說明', type: 'keyValue', rows: [['產生來源', 'TopChurchPlus NAS API'], ['用途', 'DOCX 套件測試']] }
        ],
        includeSignature: false
      }, ['test'], `topchurchplus-test-${formatStamp(new Date())}`);
      sendDocx(res, file);
    } catch (err) {
      next(err);
    }
  });

  app.get('/documents/projects/:projectId.docx', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'project');
      const detail = await getProjectDetail(req.params.projectId, currentUser);
      const project = detail.project || {};
      const spec = buildProjectDocSpec(detail);
      const file = await createSpecFile(
        spec,
        ['project'],
        `${project['計畫編號'] || req.params.projectId}_${project['專案名稱'] || '專案'}_專案文件`
      );
      sendDocx(res, file);
    } catch (err) {
      next(err);
    }
  });

  app.get('/documents/finance/purchases/:purchaseId/:docType.docx', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'finance');
      const detail = await getPurchaseDetail(req.params.purchaseId);
      const spec = buildPurchaseDocSpec(req.params.docType, '', detail);
      const file = await createSpecFile(spec, ['finance', 'purchases'], `${req.params.purchaseId}_${spec.title}`);
      sendDocx(res, file);
    } catch (err) {
      next(err);
    }
  });

  app.get('/documents/finance/purchases/:purchaseId/:docType/:docId.docx', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'finance');
      const detail = await getPurchaseDetail(req.params.purchaseId);
      const spec = buildPurchaseDocSpec(req.params.docType, req.params.docId, detail);
      const file = await createSpecFile(spec, ['finance', 'purchases'], `${req.params.purchaseId}_${spec.title}_${req.params.docId}`);
      sendDocx(res, file);
    } catch (err) {
      next(err);
    }
  });

  app.get('/documents/finance/payment-requests/:paymentId.docx', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'finance');
      const detail = await getPaymentRequestDetail(req.params.paymentId);
      const spec = buildPurchaseDocSpec('payment', req.params.paymentId, {
        purchase: {
          '採購編號': detail.payment['請購編號'] || req.params.paymentId,
          '採購摘要': detail.payment['請款編號'] || req.params.paymentId
        },
        payments: [detail.payment],
        expenseProofs: detail.expenseProofs
      });
      const file = await createSpecFile(spec, ['finance', 'payment-requests'], `${req.params.paymentId}_${spec.title}`);
      sendDocx(res, file);
    } catch (err) {
      next(err);
    }
  });

  app.get('/documents/finance/payment-requests/:paymentId/expense-proofs/:proofId.docx', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'finance');
      const detail = await getPaymentRequestDetail(req.params.paymentId);
      const spec = buildPurchaseDocSpec('expenseProof', req.params.proofId, {
        purchase: {
          '採購編號': detail.payment['請購編號'] || req.params.paymentId,
          '採購摘要': detail.payment['請款編號'] || req.params.paymentId
        },
        payments: [detail.payment],
        expenseProofs: detail.expenseProofs
      });
      const file = await createSpecFile(spec, ['finance', 'expense-proofs'], `${req.params.paymentId}_${spec.title}_${req.params.proofId}`);
      sendDocx(res, file);
    } catch (err) {
      next(err);
    }
  });
}

async function createSpecFile(spec, pathParts, baseName) {
  const stamp = formatStamp(new Date());
  const fileName = `${sanitizeFileName(baseName)}_${stamp}.docx`;
  const outputDir = path.join(getDocumentOutputDir(), ...pathParts);
  const filePath = path.join(outputDir, fileName);
  await fs.mkdir(outputDir, { recursive: true });
  const buffer = await buildSpecDocx(spec);
  await fs.writeFile(filePath, buffer);
  return { fileName, filePath, buffer };
}

async function getProjectDetail(projectId, currentUser) {
  const { rows } = await pool.query('SELECT * FROM projects WHERE project_id = $1', [projectId]);
  const project = rows[0];
  if (!project) throw new Error('找不到此專案資料');
  await assertProjectAccess(projectId, currentUser);

  const [people, income, budget, meetings] = await Promise.all([
    getProjectChildRows('project_people', projectId),
    getProjectChildRows('project_income', projectId),
    getProjectChildRows('project_budget', projectId),
    getProjectMeetings(projectId)
  ]);

  return {
    project: toProjectDetail(project),
    people: people.map(toPeopleRow),
    income: income.map(toIncomeRow),
    budget: budget.map(toBudgetRow),
    meetings
  };
}

async function assertProjectAccess(projectId, currentUser) {
  if (hasAnyRole(currentUser, ['管理員', '超級管理者'])) return true;
  if (!currentUser || !currentUser.name) throw new Error('缺少登入者資訊');
  if (currentUser.staffId) {
    const { rows } = await pool.query(
      'SELECT 1 FROM project_permissions WHERE project_id = $1 AND staff_id = $2 LIMIT 1',
      [projectId, String(currentUser.staffId)]
    );
    if (rows[0]) return true;
  }
  const { rows } = await pool.query(
    'SELECT 1 FROM project_permissions WHERE project_id = $1 AND name = $2 LIMIT 1',
    [projectId, currentUser.name]
  );
  if (!rows[0]) throw new Error('您未被賦予此專案權限');
  return true;
}

async function getProjectChildRows(table, projectId) {
  const { rows } = await pool.query(`SELECT * FROM ${table} WHERE project_id = $1 ORDER BY sort_order, id`, [projectId]);
  return rows;
}

async function getProjectMeetings(projectId) {
  const { rows } = await pool.query('SELECT * FROM meetings WHERE project_id = $1 ORDER BY meeting_time', [projectId]);
  return rows.map(toMeetingRow);
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

async function getPaymentRequestDetail(paymentId) {
  const { rows } = await pool.query(
    `SELECT pr.*, p.summary AS purchase_summary
     FROM purchase_payment_requests pr
     LEFT JOIN purchases p ON p.purchase_id = pr.purchase_id
     WHERE pr.payment_id = $1`,
    [paymentId]
  );
  if (!rows[0]) throw new Error('找不到請款資料');

  const [paymentItems, proofs, proofItems] = await Promise.all([
    getPaymentItemsByPaymentId(paymentId),
    getPurchaseChildRows('purchase_expense_proofs', 'payment_id', paymentId),
    getExpenseProofItemsByPaymentId(paymentId)
  ]);

  return {
    payment: toPaymentRequest(rows[0], paymentItems),
    expenseProofs: proofs.map(row => toExpenseProof(row, proofItems.filter(item => item.proof_id === row.proof_id)))
  };
}

async function getPurchaseChildRows(table, column, value) {
  const orderBy = table.endsWith('_items') || table === 'purchase_items' ? 'sort_order, id' : 'created_at, updated_at';
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

async function getExpenseProofItemsByPaymentId(paymentId) {
  const { rows } = await pool.query(
    `SELECT i.*
     FROM purchase_expense_proof_items i
     JOIN purchase_expense_proofs p ON p.proof_id = i.proof_id
     WHERE p.payment_id = $1
     ORDER BY i.proof_id, i.sort_order, i.id`,
    [paymentId]
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

async function getPaymentItemsByPaymentId(paymentId) {
  const { rows } = await pool.query(
    `SELECT *
     FROM purchase_payment_items
     WHERE payment_id = $1
     ORDER BY sort_order, id`,
    [paymentId]
  );
  return rows;
}

function buildProjectDocSpec(detail) {
  const project = detail.project || {};
  return {
    title: '專案申請/執行資料',
    sections: [
      {
        title: '一、基本資料',
        type: 'keyValue',
        rows: [
          ['計畫編號', project['計畫編號']],
          ['專案登入人', project['專案登入人']],
          ['專案名稱', project['專案名稱']],
          ['專案類型', project['專案類型']],
          ['執行期間', `${project['專案執行開始時間'] || ''} ~ ${project['專案執行結束時間'] || ''}`],
          ['執行單位', project['專案執行單位']],
          ['是否收費', project['專案是否收費']],
          ['專案狀態', project['專案狀態']],
          ['收支差額處理方式', project['收支差額處理方式']]
        ]
      },
      { title: '二、專案內容', type: 'html', content: project['專案內容'] },
      { title: '三、專案人員', type: 'rows', headers: ['職責', '主責人', '主責項目', '備註'], rows: detail.people || [] },
      { title: '四、收入資料', type: 'rows', headers: ['會堂', '收入項目', '數量', '單價', '小計'], rows: detail.income || [] },
      { title: '五、支出資料', type: 'rows', headers: ['會堂', '支出項目', '數量', '單價', '小計'], rows: detail.budget || [] },
      {
        title: '六、收支摘要',
        type: 'keyValue',
        rows: [
          ['專案總收入', project['專案總收入']],
          ['專案總支出', project['專案總支出']],
          ['收支差額', Number(project['專案總收入'] || 0) - Number(project['專案總支出'] || 0)]
        ]
      },
      { title: '七、會議記錄', type: 'rows', headers: ['會議編號', '會議時間', '會議主題', '與會者', '會議狀態'], rows: detail.meetings || [] }
    ]
  };
}

function buildPurchaseDocSpec(docType, docId, detail) {
  const purchase = detail.purchase || {};

  if (docType === 'purchase') {
    return {
      title: '採購申請單',
      sections: [
        {
          title: '一、採購基本資料',
          type: 'keyValue',
          rows: [
            ['採購編號', purchase['採購編號']],
            ['會堂', purchase['會堂']],
            ['採購類型', purchase['採購類型']],
            ['專案編號', purchase['專案編號']],
            ['申請人', purchase['申請人']],
            ['申請日期', purchase['申請日期']],
            ['採購摘要', purchase['採購摘要']],
            ['請購狀態', purchase['請購狀態']],
            ['總計金額', purchase['總計金額']]
          ]
        },
        { title: '二、申請詳細原因', type: 'keyValue', rows: [['說明', purchase['申請詳細原因']]] },
        { title: '三、請購詳情', type: 'rows', headers: ['項目', '數量', '單價', '總價', '備註'], rows: detail.items || [] }
      ]
    };
  }

  if (docType === 'advance') {
    const advance = findDocRow(detail.advances, '預借編號', docId);
    return {
      title: '預借申請單',
      sections: [
        {
          title: '一、預借基本資料',
          type: 'keyValue',
          rows: [
            ['預借編號', advance['預借編號']],
            ['請購編號', advance['請購編號']],
            ['請款會堂', advance['請款會堂']],
            ['借款人', advance['借款人']],
            ['申請日期', advance['申請日期']],
            ['預借總金額', advance['預借總金額']],
            ['預計核銷日期', advance['預計核銷日期']]
          ]
        },
        { title: '二、預借詳情', type: 'rows', headers: ['項次', '事由', '金額', '備註/說明'], rows: advance.items || [] },
        {
          title: '三、支付方式',
          type: 'keyValue',
          rows: [
            ['支付方式', advance['支付方式']],
            ['匯款銀行', advance['匯款銀行']],
            ['分行', advance['分行']],
            ['帳戶名稱', advance['帳戶名稱']],
            ['帳號', advance['帳號']]
          ]
        }
      ]
    };
  }

  if (docType === 'expenseProof') {
    const proof = findDocRow(detail.expenseProofs, '支出證明編號', docId);
    return {
      title: '支出證明申請單',
      sections: [
        {
          title: '一、支出證明基本資料',
          type: 'keyValue',
          rows: [
            ['支出證明編號', proof['支出證明編號']],
            ['請購編號', proof['請購編號']],
            ['請款編號', proof['請款編號']],
            ['請款會堂', proof['請款會堂']],
            ['申請日期', proof['申請日期']],
            ['實付金額', proof['實付金額']],
            ['不能取得單據原因', proof['不能取得單據原因']]
          ]
        },
        {
          title: '二、受領人資料',
          type: 'keyValue',
          rows: [
            ['姓名', proof['姓名']],
            ['身分證字號', proof['身分證字號']],
            ['地址', proof['地址']]
          ]
        },
        { title: '三、支出證明詳情', type: 'rows', headers: ['項次', '項目', '費用'], rows: proof.items || [] }
      ]
    };
  }

  if (docType === 'payment') {
    const payment = findDocRow(detail.payments, '請款編號', docId);
    return {
      title: '請款申請單',
      sections: [
        {
          title: '一、請款基本資料',
          type: 'keyValue',
          rows: [
            ['請款編號', payment['請款編號']],
            ['請購編號', payment['請購編號']],
            ['請款會堂', payment['請款會堂']],
            ['請款人', payment['請款人']],
            ['申請日期', payment['申請日期']],
            ['請款總金額', payment['請款總金額']]
          ]
        },
        { title: '二、請款詳細內容', type: 'rows', headers: ['項目', '數量', '單價', '總價', '備註'], rows: payment.items || [] },
        {
          title: '三、支付方式',
          type: 'keyValue',
          rows: [
            ['是否有預借', payment['是否有預借']],
            ['支付方式', payment['支付方式']],
            ['預借編號', payment['預借編號']],
            ['前已預借金額', payment['前已預借金額']],
            ['轉正', payment['轉正']],
            ['代支', payment['代支']],
            ['繳回', payment['繳回']],
            ['匯款銀行', payment['匯款銀行']],
            ['分行', payment['分行']],
            ['帳戶名稱', payment['帳戶名稱']],
            ['帳號', payment['帳號']]
          ]
        }
      ]
    };
  }

  throw new Error('未知的採購單據類型');
}

function findDocRow(rows, key, value) {
  const row = (rows || []).find(item => String(item[key] || '') === String(value || ''));
  if (!row) throw new Error(`找不到單據資料：${value}`);
  return row;
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
  return { '會堂': row.unit, '收入項目': row.item, '數量': Number(row.quantity || 0), '單價': Number(row.unit_price || 0), '小計': Number(row.subtotal || 0) };
}

function toBudgetRow(row) {
  return { '會堂': row.unit, '支出項目': row.item, '數量': Number(row.quantity || 0), '單價': Number(row.unit_price || 0), '小計': Number(row.subtotal || 0) };
}

function toMeetingRow(row) {
  return {
    '會議編號': row.meeting_id,
    '會議時間': formatDateTime(row.meeting_time),
    '會議主題': row.topic,
    '與會者': (row.attendees || []).join(','),
    '會議狀態': row.status
  };
}

function toPurchaseDetail(row) {
  return {
    '採購編號': row.purchase_id,
    '會堂': row.hall,
    '採購類型': row.purchase_type || row.department || '一般採購',
    '專案編號': row.project_id || '',
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
    '請款編號': row.payment_id,
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

function sendDocx(res, file) {
  res.setHeader('Content-Type', DOCX_MIME_TYPE);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
  res.setHeader('X-Document-Path', encodeURIComponent(file.filePath));
  res.send(file.buffer);
}

function getDocumentOutputDir() {
  return process.env.DOCUMENT_OUTPUT_DIR || '/app/files/documents';
}

function formatStamp(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const sec = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${min}${sec}`;
}

function sanitizeFileName(value) {
  return String(value || 'document').replace(/[\\/:*?"<>|]/g, '_');
}

module.exports = { registerDocumentRoutes };
