const { pool, tx } = require('../../db');
const { createEntityLink, recordDomainEvent } = require('../../shared/cross-system');
const { assertFeatureEditable, assertFeatureReadable } = require('../../shared/permissions');
const { assertDesktop, parseUser } = require('../../shared/users');
const { formatDate } = require('../../shared/format');


const PURCHASE_TYPES = ['專案採購', '一般採購', '維修採購', '其他採購'];
const QUOTE_PDF_MAX_BYTES = 10 * 1024 * 1024;

function registerFinanceRoutes(app) {
  app.get('/purchases', async (req, res, next) => {
  try {
    await assertFeatureReadable(parseUser(req), 'finance');
    const keyword = String(req.query.keyword || '').trim().toLowerCase();
    const where = [];
    const values = [];

    if (keyword) {
      values.push(`%${keyword}%`);
      where.push(`(
        lower(purchase_id) LIKE $${values.length}
        OR lower(summary) LIKE $${values.length}
        OR lower(applicant) LIKE $${values.length}
        OR lower(coalesce(purchase_type, department, '')) LIKE $${values.length}
        OR lower(coalesce(project_id, '')) LIKE $${values.length}
      )`);
    }

    const { rows } = await pool.query(
      `SELECT purchase_id, summary, status, total_amount, purchase_type, project_id
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

  app.get('/purchases/:purchaseId/quote-pdfs/:fileId', async (req, res, next) => {
  try {
    await assertFeatureReadable(parseUser(req), 'finance');
    res.json(await getPurchaseQuotePdfData(req.params.purchaseId, req.params.fileId));
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

  app.get('/payment-requests', async (req, res, next) => {
  try {
    await assertFeatureReadable(parseUser(req), 'finance');
    res.json(await getPaymentRequests(req.query));
  } catch (err) {
    next(err);
  }
});

  app.get('/payment-requests/:paymentId', async (req, res, next) => {
  try {
    await assertFeatureReadable(parseUser(req), 'finance');
    res.json(await getPaymentRequestDetail(req.params.paymentId));
  } catch (err) {
    next(err);
  }
});

  app.post('/payment-requests', async (req, res, next) => {
  try {
    await assertFeatureEditable(req.body.currentUser, 'finance');
    res.json(await savePaymentRequest(null, req.body));
  } catch (err) {
    next(err);
  }
});

  app.put('/payment-requests/:paymentId', async (req, res, next) => {
  try {
    await assertFeatureEditable(req.body.currentUser, 'finance');
    res.json(await savePaymentRequest(null, req.body, req.params.paymentId));
  } catch (err) {
    next(err);
  }
});

  app.post('/payment-requests/:paymentId/expense-proofs', async (req, res, next) => {
  try {
    await assertFeatureEditable(req.body.currentUser, 'finance');
    res.json(await saveExpenseProofForPayment(req.params.paymentId, req.body));
  } catch (err) {
    next(err);
  }
});
}

async function getPaymentRequests(query) {
  const keyword = String(query.keyword || '').trim().toLowerCase();
  const where = [];
  const values = [];

  if (keyword) {
    values.push(`%${keyword}%`);
    where.push(`(
      lower(pr.payment_id) LIKE $${values.length}
      OR lower(coalesce(pr.claimant, '')) LIKE $${values.length}
      OR lower(coalesce(pr.hall, '')) LIKE $${values.length}
      OR lower(coalesce(pr.purchase_id, '')) LIKE $${values.length}
      OR lower(coalesce(p.summary, '')) LIKE $${values.length}
    )`);
  }

  const { rows } = await pool.query(
    `SELECT pr.*, p.summary AS purchase_summary,
            count(DISTINCT ep.proof_id)::int AS expense_proof_count
     FROM purchase_payment_requests pr
     LEFT JOIN purchases p ON p.purchase_id = pr.purchase_id
     LEFT JOIN purchase_expense_proofs ep ON ep.payment_id = pr.payment_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     GROUP BY pr.payment_id, p.summary
     ORDER BY pr.request_date DESC, pr.payment_id DESC`,
    values
  );
  return rows.map(toPaymentRequestListItem);
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

async function getPurchaseDetail(purchaseId) {
  const { rows } = await pool.query('SELECT * FROM purchases WHERE purchase_id = $1', [purchaseId]);
  const purchase = rows[0];
  if (!purchase) throw new Error('找不到採購資料');

  const [items, advances, advanceItems, expenseProofs, expenseProofItems, payments, paymentItems, quotePdfs] = await Promise.all([
    getPurchaseChildRows('purchase_items', 'purchase_id', purchaseId),
    getPurchaseChildRows('purchase_advances', 'purchase_id', purchaseId),
    getAdvanceItems(purchaseId),
    getPurchaseChildRows('purchase_expense_proofs', 'purchase_id', purchaseId),
    getExpenseProofItems(purchaseId),
    getPurchaseChildRows('purchase_payment_requests', 'purchase_id', purchaseId),
    getPaymentItems(purchaseId),
    getPurchaseQuotePdfs(purchaseId)
  ]);

  return {
    purchase: toPurchaseDetail(purchase),
    items: items.map(toPurchaseItem),
    advances: advances.map(row => toAdvance(row, advanceItems.filter(item => item.advance_id === row.advance_id))),
    expenseProofs: expenseProofs.map(row => toExpenseProof(row, expenseProofItems.filter(item => item.proof_id === row.proof_id))),
    payments: payments.map(row => toPaymentRequest(row, paymentItems.filter(item => item.payment_id === row.payment_id))),
    quotePdfs
  };
}

async function savePurchase(payload) {
  const { currentUser, purchase, items = [], sourceEntity = null, sourceProjectId = '', quotePdf = null } = payload;
  assertDesktop(currentUser);
  if (!purchase['採購摘要']) throw new Error('請填寫採購摘要');
  if (!items.length) throw new Error('請至少新增一筆請購詳情');
  const purchaseType = normalizePurchaseType(purchase);
  const projectId = String(purchase['專案編號'] || purchase.projectId || '').trim();
  if (purchaseType === '專案採購' && !projectId) throw new Error('專案採購請選擇專案編號');

  return tx(async client => {
    let purchaseId = purchase['採購編號'];
    const isNew = !purchaseId;
    if (!purchaseId) purchaseId = await generateSerialId(client, 'purchases', 'purchase_id', 'P');

    const totalAmount = items.reduce((sum, row) => sum + Number(row['總價'] || 0), 0);
    await client.query(
      `INSERT INTO purchases (
        purchase_id, hall, department, purchase_type, project_id, applicant, request_date, summary, reason, status, total_amount, created_by, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
      ON CONFLICT (purchase_id) DO UPDATE SET
        hall = EXCLUDED.hall,
        department = EXCLUDED.department,
        purchase_type = EXCLUDED.purchase_type,
        project_id = EXCLUDED.project_id,
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
        purchaseType,
        purchaseType === '專案採購' ? projectId : null,
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
    if (quotePdf) await savePurchaseQuotePdf(client, purchaseId, quotePdf, currentUser);
    await linkPurchaseSource(client, {
      currentUser,
      purchaseId,
      sourceEntity,
      sourceProjectId: sourceProjectId || purchase['來源專案編號'] || (purchaseType === '專案採購' ? projectId : '') || ''
    });
    await recordDomainEvent({
      eventType: isNew ? 'finance.purchase_created' : 'finance.purchase_saved',
      systemKey: 'finance',
      entityType: 'purchase',
      entityId: purchaseId,
      payload: { totalAmount, itemCount: items.length },
      currentUser
    }, client);
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
    await recordDomainEvent({
      eventType: 'finance.advance_created',
      systemKey: 'finance',
      entityType: 'advance',
      entityId: advanceId,
      payload: { purchaseId, totalAmount, itemCount: items.length },
      currentUser
    }, client);
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
    await recordDomainEvent({
      eventType: 'finance.expense_proof_created',
      systemKey: 'finance',
      entityType: 'expense_proof',
      entityId: proofId,
      payload: { purchaseId, paidAmount, itemCount: items.length },
      currentUser
    }, client);
    return { success: true, proofId, message: '支出證明申請已建立' };
  });
}

async function saveExpenseProofForPayment(paymentId, payload) {
  const { currentUser, proof, items = [] } = payload;
  assertDesktop(currentUser);
  const payment = await assertPaymentEditable(paymentId);
  if (!items.length) throw new Error('請至少新增一筆支出證明詳情');

  return tx(async client => {
    const proofId = await generateSerialId(client, 'purchase_expense_proofs', 'proof_id', 'E');
    const paidAmount = items.reduce((sum, row) => sum + Number(row['費用'] || 0), 0);
    await client.query(
      `INSERT INTO purchase_expense_proofs (
        proof_id, purchase_id, payment_id, hall, request_date, paid_amount, no_receipt_reason,
        recipient_name, recipient_identity_no, recipient_address
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        proofId,
        payment.purchase_id || null,
        paymentId,
        proof['請款會堂'] || payment.hall || '',
        proof['申請日期'] || new Date(),
        Number(proof['實付金額'] || paidAmount),
        proof['不能取得單據原因'] || '',
        proof['姓名'] || '',
        proof['身分證字號'] || '',
        proof['地址'] || ''
      ]
    );
    await replacePurchaseRows(client, 'purchase_expense_proof_items', 'proof_id', proofId, items, insertExpenseProofItem);
    await recordDomainEvent({
      eventType: 'finance.expense_proof_created',
      systemKey: 'finance',
      entityType: 'expense_proof',
      entityId: proofId,
      payload: { paymentId, paidAmount, itemCount: items.length },
      currentUser
    }, client);
    return { success: true, proofId, message: '支出證明申請已建立' };
  });
}

async function savePaymentRequest(purchaseId, payload, existingPaymentId = '') {
  const { currentUser, payment, items = [] } = payload;
  assertDesktop(currentUser);
  const oldPayment = existingPaymentId ? await assertPaymentEditable(existingPaymentId) : null;
  const targetPurchaseId = purchaseId || (oldPayment && oldPayment.purchase_id) || '';
  if (targetPurchaseId) await assertPurchaseEditable(targetPurchaseId);
  if (!items.length) throw new Error('請至少新增一筆請款詳情');
  if (payment['支付方式'] === '匯款交付墊款人' && !payment['帳號']) throw new Error('匯款交付墊款人時請填寫匯款資料');

  return tx(async client => {
    const isNew = !existingPaymentId;
    const paymentId = existingPaymentId || await generateSerialId(client, 'purchase_payment_requests', 'payment_id', 'R');
    const totalAmount = items.reduce((sum, row) => sum + Number(row['總價'] || 0), 0);
    await client.query(
      `INSERT INTO purchase_payment_requests (
        payment_id, purchase_id, hall, claimant, request_date, total_amount, has_advance,
        payment_method, advance_id, advance_amount, offset_amount, behalf_amount, return_amount,
        bank, branch, account_name, account_no
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      ON CONFLICT (payment_id) DO UPDATE SET
        purchase_id = EXCLUDED.purchase_id,
        hall = EXCLUDED.hall,
        claimant = EXCLUDED.claimant,
        request_date = EXCLUDED.request_date,
        total_amount = EXCLUDED.total_amount,
        has_advance = EXCLUDED.has_advance,
        payment_method = EXCLUDED.payment_method,
        advance_id = EXCLUDED.advance_id,
        advance_amount = EXCLUDED.advance_amount,
        offset_amount = EXCLUDED.offset_amount,
        behalf_amount = EXCLUDED.behalf_amount,
        return_amount = EXCLUDED.return_amount,
        bank = EXCLUDED.bank,
        branch = EXCLUDED.branch,
        account_name = EXCLUDED.account_name,
        account_no = EXCLUDED.account_no,
        updated_at = now()`,
      [
        paymentId,
        targetPurchaseId || null,
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
    await createEntityLink({
      sourceSystem: 'finance',
      sourceType: targetPurchaseId ? 'purchase' : 'independent_payment',
      sourceId: targetPurchaseId || paymentId,
      targetSystem: 'finance',
      targetType: 'payment_request',
      targetId: paymentId,
      linkType: 'generated',
      metadata: { totalAmount, itemCount: items.length },
      currentUser
    }, client);
    await recordDomainEvent({
      eventType: isNew ? 'finance.payment_request_created' : 'finance.payment_request_updated',
      systemKey: 'finance',
      entityType: 'payment_request',
      entityId: paymentId,
      payload: { purchaseId: targetPurchaseId || '', totalAmount, itemCount: items.length },
      currentUser
    }, client);
    return { success: true, paymentId, message: isNew ? '請款申請已建立' : '請款申請已更新' };
  });
}

async function linkPurchaseSource(client, { currentUser, purchaseId, sourceEntity, sourceProjectId }) {
  if (sourceEntity && sourceEntity.system && sourceEntity.type && sourceEntity.id) {
    await createEntityLink({
      sourceSystem: sourceEntity.system,
      sourceType: sourceEntity.type,
      sourceId: sourceEntity.id,
      targetSystem: 'finance',
      targetType: 'purchase',
      targetId: purchaseId,
      linkType: sourceEntity.linkType || 'created_from',
      metadata: sourceEntity.metadata || {},
      currentUser
    }, client);
    return;
  }

  if (!sourceProjectId) return;
  await createEntityLink({
    sourceSystem: 'project',
    sourceType: 'project',
    sourceId: sourceProjectId,
    targetSystem: 'finance',
    targetType: 'purchase',
    targetId: purchaseId,
    linkType: 'created_from',
    metadata: {},
    currentUser
  }, client);
}

function normalizePurchaseType(purchase) {
  const value = String(purchase['採購類型'] || purchase.purchaseType || purchase['部門'] || '一般採購').trim();
  if (!PURCHASE_TYPES.includes(value)) throw new Error('採購類型不正確');
  return value;
}

function toPurchaseListItem(row) {
  return {
    purchaseId: row.purchase_id,
    summary: row.summary,
    status: row.status,
    totalAmount: Number(row.total_amount || 0),
    purchaseType: row.purchase_type || row.department || '',
    projectId: row.project_id || ''
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

function toPaymentRequestListItem(row) {
  return {
    paymentId: row.payment_id,
    purchaseId: row.purchase_id || '',
    sourceLabel: row.purchase_id ? `採購 ${row.purchase_id}` : '獨立請款',
    purchaseSummary: row.purchase_summary || '',
    hall: row.hall || '',
    claimant: row.claimant || '',
    requestDate: formatDate(row.request_date),
    totalAmount: Number(row.total_amount || 0),
    paymentMethod: row.payment_method || '',
    hasAdvance: Boolean(row.has_advance),
    expenseProofCount: Number(row.expense_proof_count || 0)
  };
}

function createEmptyPurchase(currentUser) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    purchase: {
      '採購編號': '',
      '會堂': '',
      '採購類型': '一般採購',
      '專案編號': '',
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
    payments: [],
    quotePdfs: []
  };
}

async function getPurchaseChildRows(table, column, value) {
  const orderBy = table.endsWith('_items') || table === 'purchase_items'
    ? 'sort_order, id'
    : 'created_at, updated_at';
  const { rows } = await pool.query(`SELECT * FROM ${table} WHERE ${column} = $1 ORDER BY ${orderBy}`, [value]);
  return rows;
}

async function getPurchaseQuotePdfs(purchaseId) {
  const { rows } = await pool.query(
    `SELECT f.file_id, f.original_name, f.mime_type, f.file_size, f.uploaded_at
     FROM file_links fl
     JOIN files f ON f.file_id = fl.file_id
     WHERE fl.entity_type = 'purchase'
       AND fl.entity_id = $1
       AND fl.file_type = 'quote_pdf'
       AND NOT f.is_deleted
     ORDER BY fl.sort_order, f.uploaded_at DESC`,
    [purchaseId]
  );
  return rows.map(row => ({
    fileId: row.file_id,
    fileName: row.original_name,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size || 0),
    uploadedAt: row.uploaded_at
  }));
}

async function getPurchaseQuotePdfData(purchaseId, fileId) {
  const { rows } = await pool.query(
    `SELECT f.file_id, f.original_name, f.mime_type, f.file_size, f.file_data
     FROM file_links fl
     JOIN files f ON f.file_id = fl.file_id
     WHERE fl.entity_type = 'purchase'
       AND fl.entity_id = $1
       AND fl.file_type = 'quote_pdf'
       AND fl.file_id = $2
       AND NOT f.is_deleted`,
    [purchaseId, fileId]
  );
  const file = rows[0];
  if (!file || !file.file_data) throw new Error('找不到報價單 PDF');
  return {
    fileId: file.file_id,
    fileName: file.original_name,
    mimeType: file.mime_type,
    fileSize: Number(file.file_size || 0),
    dataUrl: `data:${file.mime_type};base64,${file.file_data.toString('base64')}`
  };
}

async function savePurchaseQuotePdf(client, purchaseId, value, currentUser) {
  const file = normalizeQuotePdf(value);
  if (!file) return null;
  const { rows } = await client.query(
    `INSERT INTO files (
       original_name, stored_name, mime_type, file_size, storage_provider, storage_path,
       uploaded_by_staff_id, file_data
     ) VALUES ($1,$2,$3,$4,'postgres',$5,$6,$7)
     RETURNING file_id`,
    [
      file.fileName,
      `${purchaseId}_${Date.now()}_${file.fileName}`,
      file.mimeType,
      file.fileSize,
      `finance/purchases/${purchaseId}/quotes/${file.fileName}`,
      currentUser && currentUser.staffId ? String(currentUser.staffId) : null,
      file.buffer
    ]
  );
  const fileId = rows[0].file_id;
  await client.query(
    `INSERT INTO file_links (file_id, entity_type, entity_id, file_type, sort_order)
     VALUES ($1, 'purchase', $2, 'quote_pdf', 0)
     ON CONFLICT (file_id, entity_type, entity_id, file_type) DO NOTHING`,
    [fileId, purchaseId]
  );
  return fileId;
}

function normalizeQuotePdf(value) {
  if (!value || typeof value !== 'object') return null;
  const fileName = String(value.fileName || 'quote.pdf').trim() || 'quote.pdf';
  const mimeType = String(value.mimeType || '').trim();
  const data = String(value.data || '').trim();
  if (!data) return null;
  if (mimeType !== 'application/pdf') throw new Error('報價單附件僅支援 PDF');
  const base64 = data.includes(',') ? data.split(',').pop() : data;
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) return null;
  if (buffer.length > QUOTE_PDF_MAX_BYTES) throw new Error('報價單 PDF 不可超過 10MB');
  return {
    fileName,
    mimeType,
    fileSize: buffer.length,
    buffer
  };
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
    `SELECT i.*
     FROM purchase_payment_items i
     WHERE i.payment_id = $1
     ORDER BY i.sort_order, i.id`,
    [paymentId]
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

async function assertPaymentEditable(paymentId) {
  const { rows } = await pool.query(
    `SELECT pr.payment_id, pr.purchase_id, pr.hall, p.status AS purchase_status
     FROM purchase_payment_requests pr
     LEFT JOIN purchases p ON p.purchase_id = pr.purchase_id
     WHERE pr.payment_id = $1`,
    [paymentId]
  );
  if (!rows[0]) throw new Error('找不到請款資料');
  if (rows[0].purchase_status === '已結案') throw new Error('已結案的採購案不可新增支出證明');
  return rows[0];
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

module.exports = { registerFinanceRoutes };
