const { pool, tx } = require('../../db');
const { assertFeatureEditable, assertFeatureReadable } = require('../../shared/permissions');
const { parseUser } = require('../../shared/users');
const { formatDate } = require('../../shared/format');
const { getConfigValue, saveConfig } = require('../../shared/config');
const { recordAuditLog } = require('../../shared/audit');
const { recordNotificationLog } = require('../../shared/notifications');
const {
  approvePaymentAndCreateReservations,
  createReservation,
  fulfillSameChurchOrderItem,
  getInventoryReconciliation,
  listReservations,
  releaseReservation
} = require('./inventory-service');

const QT_OPEN_PICKUP_MONTH_KEY = 'QT_OPEN_PICKUP_MONTH';
const QT_AUTO_NOTIFICATIONS_ENABLED = false;
const QT_CUTOVER_MONTH = '202609';
const QT_TYPES = [
  { qtType: 'ADULT', label: '成人 QT', legacyProductType: 'adult_student' },
  { qtType: 'CHILD', label: '兒童 QT', legacyProductType: 'eaglet' }
];

function registerQtRoutes(app) {
  app.get('/qt/options', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'qt');
      res.json(await getQtOptions());
    } catch (err) {
      next(err);
    }
  });

  app.get('/qt/dashboard', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'qt');
      res.json(await getDashboard(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.get('/qt/settings', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'qt');
      res.json(await getSettings());
    } catch (err) {
      next(err);
    }
  });

  app.put('/qt/settings', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'qt');
      res.json(await saveSettings(req.body.settings || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.get('/qt/inventory', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'qt');
      res.json(await getInventory(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.post('/qt/inventory/monthly', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'qt');
      res.json(await createMonthlyInventory(req.body.inventory || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.get('/qt/inventory/reservations', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'qt');
      res.json(await listReservations(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.get('/qt/inventory/reconciliation', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'qt');
      res.json(await getInventoryReconciliation(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.post('/qt/inventory/reservations', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'qt');
      res.json(await createReservation(req.body.reservation || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.post('/qt/inventory/reservations/:reservationId/release', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'qt');
      res.json(await releaseReservation(req.params.reservationId, req.body.release || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.get('/qt/orders', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'qt');
      res.json(await getOrders(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.get('/qt/orders/:orderId', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'qt');
      res.json(await getOrderDetail(req.params.orderId));
    } catch (err) {
      next(err);
    }
  });

  app.post('/qt/orders/:orderId/payment/approve', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'qt');
      res.json(await approvePaymentAndCreateReservations(req.params.orderId, req.body.payment || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.post('/qt/order-items/:orderItemId/fulfill', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'qt');
      res.json(await fulfillSameChurchOrderItem(req.params.orderItemId, req.body.fulfillment || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.get('/qt/reports/:type', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'qt');
      res.json(await getReport(req.params.type, req.query));
    } catch (err) {
      next(err);
    }
  });

  app.get('/qt/notifications/:type/preview', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'qt');
      res.json(await previewManualNotification(req.params.type, req.query));
    } catch (err) {
      next(err);
    }
  });

  app.post('/qt/notifications/:type/results', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'qt');
      res.json(await recordManualNotificationResults(req.params.type, req.body || {}, currentUser, req));
    } catch (err) {
      next(err);
    }
  });

  app.get('/qt/inventory/movements', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'qt');
      res.json(await getInventoryMovements(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.post('/qt/inventory/movements', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'qt');
      res.json(await createInventoryMovement(req.body.movement || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.post('/qt/inventory/transfers', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'qt');
      res.json(await transferInventory(req.body.transfer || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.get('/qt/stock-check', async (req, res, next) => {
    try {
      res.json(await checkStock(req.query));
    } catch (err) {
      next(err);
    }
  });
}

async function getOrders(query) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 50);
  const offset = (page - 1) * pageSize;
  const keyword = String(query.keyword || '').trim();
  const values = [];
  const where = [];

  if (keyword) {
    values.push(`%${keyword}%`);
    where.push(`(
      CAST(o.order_id AS text) ILIKE $${values.length}
      OR COALESCE(m.name, '') ILIKE $${values.length}
      OR COALESCE(pc.mobile_phone, '') ILIKE $${values.length}
      OR COALESCE(pg.name, '') ILIKE $${values.length}
    )`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const listValues = values.concat([pageSize, offset]);
  const { rows } = await pool.query(
    `${orderListSelect()}
     ${whereSql}
     ORDER BY o.order_id DESC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    listValues
  );
  const countResult = await pool.query(
    `SELECT count(*)::int AS total
     FROM qt_orders o
     LEFT JOIN pastoral_members m ON m.id = o.member_id
     LEFT JOIN pastoral_member_contacts pc ON pc.member_id = m.id
     LEFT JOIN LATERAL (
       SELECT g.name
       FROM pastoral_member_group_assignments a
       JOIN pastoral_groups g ON g.id = a.group_id
       WHERE a.member_id = m.id AND a.is_current
       ORDER BY g.level_no DESC, g.sort_order DESC, g.id DESC
       LIMIT 1
     ) pg ON true
     ${whereSql}`,
    values
  );

  return {
    rows: rows.map(toOrderListItem),
    page,
    pageSize,
    total: Number(countResult.rows[0].total || 0)
  };
}

async function getOrderDetail(orderId) {
  const { rows } = await pool.query(
    `${orderListSelect()}
     WHERE o.order_id = $1`,
    [Number(orderId)]
  );
  if (!rows.length) throw new Error('找不到此 QT 訂單');

  const items = await pool.query(
    `SELECT i.order_item_id, i.issue_month, i.is_received, i.received_at, rm.name AS receiver_name
     FROM qt_order_items i
     LEFT JOIN pastoral_members rm ON rm.id = i.receiver_member_id
     WHERE i.order_id = $1
     ORDER BY i.issue_month, i.order_item_id`,
    [Number(orderId)]
  );

  return {
    ...toOrderListItem(rows[0]),
    items: items.rows.map(row => ({
      orderItemId: row.order_item_id,
      issueMonth: formatDate(row.issue_month),
      isReceived: Boolean(row.is_received),
      receiverName: row.receiver_name || '',
      receivedAt: row.received_at
    }))
  };
}

async function getReport(type, query) {
  if (type === 'finance') return getFinanceReport(query);
  if (type === 'expiring') return getExpiringReport(query);
  if (type === 'pickup') return getPickupReport(query);
  if (type === 'pastoral-summary') return getPastoralSummaryReport(query);
  if (type === 'pastoral-tree') return getPastoralTreeReport(query);
  throw new Error('QT 報表類型錯誤');
}

async function getQtOptions() {
  const [productTypes, pricePlans, churches] = await Promise.all([
    pool.query(
      `SELECT product_type, product_name
       FROM qt_product_types
       WHERE is_active
       ORDER BY sort_order, product_type`
    ),
    pool.query(
      `SELECT plan_id, plan_name, product_type, duration_months, unit_price
       FROM qt_price_plans
       WHERE is_active
       ORDER BY plan_id`
    ),
    pool.query(
      `SELECT id, name
       FROM churches
       WHERE church_type = '本會'
       ORDER BY sort_order, id`
    )
  ]);

  return {
    qtTypes: QT_TYPES.map(item => ({
      qtType: item.qtType,
      label: item.label
    })),
    productTypes: productTypes.rows.map(row => ({
      productType: row.product_type,
      productName: row.product_name
    })),
    pricePlans: pricePlans.rows.map(row => ({
      planId: row.plan_id,
      planName: row.plan_name,
      productType: row.product_type,
      durationMonths: row.duration_months,
      unitPrice: Number(row.unit_price || 0)
    })),
    churches: churches.rows.map(row => ({
      churchId: row.id,
      churchName: row.name
    }))
  };
}

async function getDashboard(query) {
  const settings = await getSettings();
  const issueMonth = normalizeMonth(query.issueMonth || settings.openPickupMonth || new Date());
  const [orders, pickup] = await Promise.all([
    pool.query(
      `SELECT
         count(*)::int AS order_count,
         COALESCE(sum(quantity), 0)::int AS quantity,
         COALESCE(sum(amount), 0)::int AS amount,
         count(*) FILTER (WHERE order_status = 'cancelled')::int AS cancelled_count,
         count(*) FILTER (WHERE order_status <> 'cancelled' AND finance_status = 'unpaid')::int AS unpaid_count,
         count(*) FILTER (WHERE order_status <> 'cancelled' AND finance_status = 'received')::int AS pending_review_count,
         count(*) FILTER (WHERE order_status <> 'cancelled' AND finance_status = 'posted')::int AS paid_count
       FROM qt_orders`
    ),
    pool.query(
      `SELECT
         count(*)::int AS item_count,
         count(*) FILTER (WHERE is_received)::int AS received_count,
         count(*) FILTER (WHERE NOT is_received)::int AS unreceived_count
       FROM qt_order_items
       WHERE issue_month = $1`,
      [issueMonth]
    )
  ]);

  const orderRow = orders.rows[0] || {};
  const pickupRow = pickup.rows[0] || {};
  return {
    openPickupMonth: settings.openPickupMonth,
    issueMonth,
    orders: {
      orderCount: Number(orderRow.order_count || 0),
      quantity: Number(orderRow.quantity || 0),
      amount: Number(orderRow.amount || 0),
      unpaidCount: Number(orderRow.unpaid_count || 0),
      pendingReviewCount: Number(orderRow.pending_review_count || 0),
      paidCount: Number(orderRow.paid_count || 0),
      cancelledCount: Number(orderRow.cancelled_count || 0)
    },
    pickup: {
      itemCount: Number(pickupRow.item_count || 0),
      receivedCount: Number(pickupRow.received_count || 0),
      unreceivedCount: Number(pickupRow.unreceived_count || 0)
    }
  };
}

async function getSettings() {
  const openPickupMonth = await getConfigValue(QT_OPEN_PICKUP_MONTH_KEY, { revealSecrets: true });
  return {
    openPickupMonth: normalizeYearMonth(openPickupMonth || new Date())
  };
}

async function saveSettings(payload, currentUser) {
  const openPickupMonth = normalizeYearMonth(payload.openPickupMonth || payload.open_pickup_month || new Date());
  await saveConfig({
    configKey: QT_OPEN_PICKUP_MONTH_KEY,
    configValue: openPickupMonth,
    description: 'QT 開放領取月份，格式 YYYY-MM。此設定供 QT 領取管理與櫃台流程驗證使用。',
    isSecret: false,
    enabled: true
  }, currentUser);
  return {
    success: true,
    message: 'QT 設定已儲存',
    settings: { openPickupMonth }
  };
}

function orderListSelect() {
  return `SELECT
       o.order_id,
       o.start_month,
       o.end_month,
       o.quantity,
       o.amount,
       o.order_status,
       o.finance_status,
       o.ordered_at,
       o.paid_at,
       o.cancelled_at,
       c.name AS church_name,
       m.name AS member_name,
       pc.mobile_phone,
       pg.name AS pastoral_group_name,
       p.plan_name,
       pt.payment_type_name
     FROM qt_orders o
     LEFT JOIN churches c ON c.id = o.church_id
     LEFT JOIN pastoral_members m ON m.id = o.member_id
     LEFT JOIN pastoral_member_contacts pc ON pc.member_id = m.id
     LEFT JOIN qt_price_plans p ON p.plan_id = o.plan_id
     LEFT JOIN qt_payment_types pt ON pt.payment_type_id = o.payment_type_id
     LEFT JOIN LATERAL (
       SELECT g.name
       FROM pastoral_member_group_assignments a
       JOIN pastoral_groups g ON g.id = a.group_id
       WHERE a.member_id = m.id AND a.is_current
       ORDER BY g.level_no DESC, g.sort_order DESC, g.id DESC
       LIMIT 1
     ) pg ON true`;
}

async function getFinanceReport(query) {
  const issueMonth = normalizeMonth(query.issueMonth || new Date());
  const { rows } = await pool.query(
    `SELECT c.name AS church_name, pt.payment_type_name, o.finance_status,
       count(*)::int AS order_count,
       COALESCE(sum(o.quantity), 0)::int AS quantity,
       COALESCE(sum(o.amount), 0)::int AS amount
     FROM qt_orders o
     LEFT JOIN churches c ON c.id = o.church_id
     LEFT JOIN qt_payment_types pt ON pt.payment_type_id = o.payment_type_id
     WHERE date_trunc('month', o.paid_at)::date = $1
     GROUP BY c.sort_order, c.name, pt.payment_type_name, o.finance_status
     ORDER BY c.sort_order, c.name, pt.payment_type_name, o.finance_status`,
    [issueMonth]
  );
  return rows.map(row => ({
    churchName: row.church_name || '未設定會堂',
    paymentTypeName: row.payment_type_name || '未設定',
    financeStatus: row.finance_status,
    orderCount: Number(row.order_count || 0),
    quantity: Number(row.quantity || 0),
    amount: Number(row.amount || 0)
  }));
}

async function getExpiringReport(query) {
  const issueMonth = normalizeMonth(query.issueMonth || new Date());
  const { rows } = await pool.query(
    `${orderListSelect()}
     WHERE date_trunc('month', o.end_month)::date = $1
       AND o.order_status <> 'cancelled'
     ORDER BY c.sort_order, pg.name, m.name, o.order_id`,
    [issueMonth]
  );
  return rows.map(toOrderListItem);
}

async function getPickupReport(query) {
  const issueMonth = normalizeMonth(query.issueMonth || new Date());
  const pickupStatus = normalizePickupStatus(query.pickupStatus);
  const values = [issueMonth];
  const where = ['i.issue_month = $1'];
  if (pickupStatus === 'received') {
    where.push('i.is_received');
  } else if (pickupStatus === 'unreceived') {
    where.push('NOT i.is_received');
  }

  const { rows } = await pool.query(
    `SELECT c.name AS church_name, pg.name AS pastoral_group_name, m.name AS member_name,
       pc.mobile_phone, o.order_id, i.order_item_id, p.plan_name, i.issue_month, i.is_received,
       i.received_at, rm.name AS receiver_name
     FROM qt_order_items i
     JOIN qt_orders o ON o.order_id = i.order_id
     LEFT JOIN churches c ON c.id = o.church_id
     LEFT JOIN pastoral_members m ON m.id = o.member_id
     LEFT JOIN pastoral_member_contacts pc ON pc.member_id = m.id
     LEFT JOIN pastoral_members rm ON rm.id = i.receiver_member_id
     LEFT JOIN qt_price_plans p ON p.plan_id = o.plan_id
     LEFT JOIN LATERAL (
       SELECT g.name
       FROM pastoral_member_group_assignments a
       JOIN pastoral_groups g ON g.id = a.group_id
       WHERE a.member_id = m.id AND a.is_current
       ORDER BY g.level_no DESC, g.sort_order DESC, g.id DESC
       LIMIT 1
     ) pg ON true
     WHERE ${where.join(' AND ')}
     ORDER BY c.sort_order, pg.name, m.name, o.order_id
     LIMIT 500`,
    values
  );
  return rows.map(row => ({
    churchName: row.church_name || '未設定會堂',
    pastoralGroupName: row.pastoral_group_name || '未分配',
    memberName: row.member_name || '',
    mobilePhone: row.mobile_phone || '',
    orderId: row.order_id,
    orderItemId: row.order_item_id,
    planName: row.plan_name || '',
    issueMonth: formatDate(row.issue_month),
    isReceived: Boolean(row.is_received),
    receiverName: row.receiver_name || '',
    receivedAt: row.received_at
  }));
}

async function getPastoralSummaryReport(query) {
  const issueMonth = normalizeMonth(query.issueMonth || new Date());
  const { rows } = await pool.query(
    `SELECT c.name AS church_name, COALESCE(pg.name, '未分配') AS pastoral_group_name,
       p.plan_name,
       count(DISTINCT o.order_id)::int AS order_count,
       COALESCE(sum(o.quantity), 0)::int AS quantity,
       COALESCE(sum(o.amount), 0)::int AS amount
     FROM qt_order_items i
     JOIN qt_orders o ON o.order_id = i.order_id
     LEFT JOIN churches c ON c.id = o.church_id
     LEFT JOIN pastoral_members m ON m.id = o.member_id
     LEFT JOIN qt_price_plans p ON p.plan_id = o.plan_id
     LEFT JOIN LATERAL (
       SELECT g.name
       FROM pastoral_member_group_assignments a
       JOIN pastoral_groups g ON g.id = a.group_id
       WHERE a.member_id = m.id AND a.is_current
       ORDER BY g.level_no DESC, g.sort_order DESC, g.id DESC
       LIMIT 1
     ) pg ON true
     WHERE i.issue_month = $1
     GROUP BY c.sort_order, c.name, pg.name, p.plan_name
     ORDER BY c.sort_order, c.name, pg.name, p.plan_name`,
    [issueMonth]
  );
  return rows.map(row => ({
    churchName: row.church_name || '未設定會堂',
    pastoralGroupName: row.pastoral_group_name || '未分配',
    planName: row.plan_name || '',
    orderCount: Number(row.order_count || 0),
    quantity: Number(row.quantity || 0),
    amount: Number(row.amount || 0)
  }));
}

async function getPastoralTreeReport(query) {
  const issueMonth = normalizeMonth(query.issueMonth || new Date());
  const { rows } = await pool.query(
    `SELECT c.name AS church_name, COALESCE(pg.name, 'Unassigned') AS pastoral_group_name,
       COALESCE(p.plan_name, 'Unspecified') AS plan_name,
       count(DISTINCT o.order_id)::int AS order_count,
       COALESCE(sum(o.quantity), 0)::int AS quantity,
       COALESCE(sum(o.amount), 0)::int AS amount,
       count(DISTINCT o.order_id) FILTER (WHERE o.finance_status = 'posted') AS paid_count,
       count(DISTINCT o.order_id) FILTER (WHERE o.finance_status <> 'posted') AS unpaid_count,
       count(i.order_item_id) FILTER (WHERE i.is_received) AS received_count,
       count(i.order_item_id) FILTER (WHERE NOT i.is_received) AS unreceived_count
     FROM qt_order_items i
     JOIN qt_orders o ON o.order_id = i.order_id
     LEFT JOIN churches c ON c.id = o.church_id
     LEFT JOIN pastoral_members m ON m.id = o.member_id
     LEFT JOIN qt_price_plans p ON p.plan_id = o.plan_id
     LEFT JOIN LATERAL (
       SELECT g.name
       FROM pastoral_member_group_assignments a
       JOIN pastoral_groups g ON g.id = a.group_id
       WHERE a.member_id = m.id AND a.is_current
       ORDER BY g.level_no DESC, g.sort_order DESC, g.id DESC
       LIMIT 1
     ) pg ON true
     WHERE i.issue_month = $1
       AND o.order_status <> 'cancelled'
     GROUP BY c.sort_order, c.name, pg.name, p.plan_name
     ORDER BY c.sort_order, c.name, pg.name, p.plan_name`,
    [issueMonth]
  );

  return buildPastoralTreeReport(issueMonth, rows.map(row => ({
    churchName: row.church_name || 'Unassigned church',
    pastoralGroupName: row.pastoral_group_name || 'Unassigned group',
    planName: row.plan_name || 'Unspecified plan',
    metrics: toQtReportMetrics(row)
  })));
}

async function previewManualNotification(type, query) {
  const notificationType = normalizeQtNotificationType(type);
  const issueMonth = normalizeMonth(query.issueMonth || new Date());
  const recipients = await getQtNotificationRecipients(notificationType, issueMonth);
  return {
    notificationType,
    issueMonth,
    autoNotificationEnabled: QT_AUTO_NOTIFICATIONS_ENABLED,
    recipientCount: recipients.length,
    sendableCount: recipients.filter(row => row.email).length,
    skippedCount: recipients.filter(row => !row.email).length,
    recipients
  };
}

async function recordManualNotificationResults(type, payload, currentUser, req) {
  const notificationType = normalizeQtNotificationType(type);
  const issueMonth = normalizeMonth(payload.issueMonth || new Date());
  const results = Array.isArray(payload.results) ? payload.results : [];
  const summary = normalizeQtNotificationSummary(payload.summary || {}, results);
  const batchId = payload.batchId || `qt-${notificationType}-${issueMonth}-${Date.now()}`;

  await tx(async client => {
    for (const result of results) {
      if (!result.email) continue;
      await recordNotificationLog({
        templateCode: getQtNotificationTemplateCode(notificationType),
        channel: 'EMAIL',
        recipient: result.email,
        subject: result.subject || buildQtNotificationSubject(notificationType, issueMonth),
        contentSnapshot: result.body || '',
        status: result.success ? 'SENT' : 'FAILED',
        errorMessage: result.error || '',
        sentAt: result.success ? new Date() : null,
        metadata: {
          batchId,
          issueMonth,
          notificationType,
          orderId: result.orderId || null,
          memberId: result.memberId || null,
          manual: true,
          autoNotificationEnabled: QT_AUTO_NOTIFICATIONS_ENABLED
        }
      }, client);
    }

    await recordAuditLog({
      currentUser,
      systemKey: 'qt',
      entityType: 'qt_notification_batch',
      entityId: batchId,
      action: `MANUAL_${notificationType.toUpperCase()}_EMAIL`,
      afterData: summary,
      metadata: {
        batchId,
        issueMonth,
        notificationType,
        manual: true,
        autoNotificationEnabled: QT_AUTO_NOTIFICATIONS_ENABLED,
        successCount: summary.successCount,
        failedCount: summary.failedCount,
        skippedCount: summary.skippedCount,
        recipientCount: summary.recipientCount
      },
      ipAddress: req.ip,
      userAgent: req.get ? req.get('user-agent') : null
    }, client);
  });

  return {
    success: true,
    batchId,
    issueMonth,
    notificationType,
    autoNotificationEnabled: QT_AUTO_NOTIFICATIONS_ENABLED,
    ...summary
  };
}

async function getInventory(query) {
  const qtMonth = normalizeQtMonth(query.qtMonth || query.issueMonth || new Date());
  if (qtMonth < QT_CUTOVER_MONTH) return [];

  const values = [qtMonth];
  const where = ['m.qt_month = $1'];

  if (query.churchId) {
    values.push(Number(query.churchId));
    where.push(`m.church_id = $${values.length}`);
  }
  if (query.qtType || query.productType) {
    values.push(normalizeQtType(query.qtType || query.productType));
    where.push(`m.qt_type = $${values.length}`);
  }

  const { rows } = await pool.query(
    `SELECT
       m.inventory_id,
       m.qt_month,
       m.qt_type,
       m.church_id,
       c.name AS church_name,
       m.physical_quantity,
       m.reserved_quantity,
       m.retail_quantity,
       m.estimated_inbound_quantity,
       m.actual_inbound_quantity,
       m.status,
       m.created_at,
       m.updated_at
     FROM qt_inventory_monthly m
     JOIN churches c ON c.id = m.church_id
     WHERE ${where.join(' AND ')}
     ORDER BY m.qt_month DESC, c.sort_order, c.id, m.qt_type`,
    values
  );

  return rows.map(toInventoryItem);
}

async function getInventoryMovements(query) {
  const values = [];
  const where = [];
  if (query.qtMonth || query.issueMonth) {
    values.push(normalizeQtMonth(query.qtMonth || query.issueMonth));
    where.push(`COALESCE(m.qt_month, to_char(m.issue_month, 'YYYYMM')) = $${values.length}`);
  }
  if (query.churchId) {
    values.push(Number(query.churchId));
    where.push(`m.church_id = $${values.length}`);
  }
  if (query.qtType || query.productType) {
    values.push(normalizeQtType(query.qtType || query.productType));
    where.push(`COALESCE(m.qt_type, CASE WHEN m.product_type = 'eaglet' THEN 'CHILD' ELSE 'ADULT' END) = $${values.length}`);
  }
  if (query.startDate) {
    values.push(normalizeDateOnly(query.startDate));
    where.push(`m.created_at >= $${values.length}::date`);
  }
  if (query.endDate) {
    values.push(normalizeDateOnly(query.endDate));
    where.push(`m.created_at < ($${values.length}::date + interval '1 day')`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT m.*, c.name AS church_name, pt.product_name, a.name AS created_by_name
     FROM qt_inventory_movements m
     JOIN churches c ON c.id = m.church_id
     JOIN qt_product_types pt ON pt.product_type = m.product_type
     LEFT JOIN accounts a ON a.staff_id = m.created_by_staff_id
     ${whereSql}
     ORDER BY m.created_at DESC, m.movement_id DESC
     LIMIT 200`,
    values
  );
  return rows.map(toMovementItem);
}

async function createInventoryMovement(payload, currentUser) {
  const normalized = normalizeMovementPayload(payload);
  const signedQuantity = signQuantity(normalized.movementType, normalized.quantity);
  const result = await pool.query(
    `INSERT INTO qt_inventory_movements (
       issue_month, church_id, product_type, movement_type, quantity, note, created_by_staff_id,
       qt_month, qt_type
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING movement_id`,
    [
      normalized.issueMonth,
      normalized.churchId,
      normalized.productType,
      normalized.movementType,
      signedQuantity,
      normalized.note,
      currentUser.staffId ? String(currentUser.staffId) : null,
      normalized.qtMonth,
      normalized.qtType
    ]
  );
  return { success: true, movementId: result.rows[0].movement_id, message: 'QT 庫存異動已建立' };
}

async function createMonthlyInventory(payload, currentUser) {
  const inventory = normalizeMonthlyInventoryPayload(payload);

  try {
    const { rows } = await pool.query(
      `INSERT INTO qt_inventory_monthly (
         qt_month, qt_type, church_id, physical_quantity, reserved_quantity, retail_quantity,
         estimated_inbound_quantity, actual_inbound_quantity, created_by_staff_id, updated_by_staff_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
       RETURNING *`,
      [
        inventory.qtMonth,
        inventory.qtType,
        inventory.churchId,
        inventory.physicalQuantity,
        inventory.reservedQuantity,
        inventory.retailQuantity,
        inventory.estimatedInboundQuantity,
        inventory.actualInboundQuantity,
        currentUser.staffId ? String(currentUser.staffId) : null
      ]
    );
    return {
      success: true,
      message: 'QT monthly inventory created.',
      inventory: toInventoryItem({ ...rows[0], church_name: '' })
    };
  } catch (err) {
    if (err && err.code === '23505') {
      throw new Error('Duplicate QT inventory month, church, and type.');
    }
    throw err;
  }
}

async function transferInventory(payload, currentUser) {
  const issueMonth = normalizeMonth(payload.issueMonth);
  const productType = String(payload.productType || '').trim();
  const fromChurchId = Number(payload.fromChurchId || 0);
  const toChurchId = Number(payload.toChurchId || 0);
  const quantity = Number(payload.quantity || 0);
  const note = String(payload.note || '').trim();
  if (!productType) throw new Error('請選擇 QT 類型');
  if (!fromChurchId || !toChurchId || fromChurchId === toChurchId) throw new Error('請選擇不同的調出與調入會堂');
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('調撥數量需大於 0');

  const stock = await getAvailableQuantity({ issueMonth, churchId: fromChurchId, productType });
  if (stock < quantity) throw new Error(`調出會堂庫存不足，目前可用 ${stock} 本`);

  return tx(async client => {
    const outResult = await client.query(
      `INSERT INTO qt_inventory_movements (
         issue_month, church_id, product_type, movement_type, quantity, note, created_by_staff_id
       ) VALUES ($1,$2,$3,'transfer_out',$4,$5,$6)
       RETURNING movement_id`,
      [issueMonth, fromChurchId, productType, -quantity, note, currentUser.staffId ? String(currentUser.staffId) : null]
    );
    const inResult = await client.query(
      `INSERT INTO qt_inventory_movements (
         issue_month, church_id, product_type, movement_type, quantity, related_movement_id, note, created_by_staff_id
       ) VALUES ($1,$2,$3,'transfer_in',$4,$5,$6,$7)
       RETURNING movement_id`,
      [issueMonth, toChurchId, productType, quantity, outResult.rows[0].movement_id, note, currentUser.staffId ? String(currentUser.staffId) : null]
    );
    await client.query(
      'UPDATE qt_inventory_movements SET related_movement_id = $1 WHERE movement_id = $2',
      [inResult.rows[0].movement_id, outResult.rows[0].movement_id]
    );
    return { success: true, message: 'QT 庫存調撥已完成' };
  });
}

async function checkStock(query) {
  const issueMonth = normalizeMonth(query.issueMonth);
  const churchId = Number(query.churchId || 0);
  const productType = String(query.productType || '').trim();
  const quantity = Number(query.quantity || 1);
  if (!churchId || !productType) throw new Error('缺少會堂或 QT 類型');
  const availableQuantity = await getAvailableQuantity({ issueMonth, churchId, productType });
  return {
    issueMonth,
    churchId,
    productType,
    requestedQuantity: quantity,
    availableQuantity,
    canOrder: availableQuantity >= quantity
  };
}

async function getAvailableQuantity({ issueMonth, churchId, productType }) {
  const { rows } = await pool.query(
    `SELECT COALESCE(sum(quantity), 0)::int AS available_quantity
     FROM qt_inventory_movements
     WHERE issue_month = $1
       AND church_id = $2
       AND product_type = $3`,
    [normalizeMonth(issueMonth), churchId, productType]
  );
  return Number(rows[0].available_quantity || 0);
}

async function getQtNotificationRecipients(type, issueMonth) {
  if (type === 'unreceived') {
    return getQtUnreceivedNotificationRecipients(issueMonth);
  }
  if (type === 'expiring') {
    return getQtExpiringNotificationRecipients(issueMonth);
  }
  throw new Error('Unsupported QT notification type.');
}

async function getQtUnreceivedNotificationRecipients(issueMonth) {
  const { rows } = await pool.query(
    `SELECT c.name AS church_name, pg.name AS pastoral_group_name,
       m.id AS member_id, m.name AS member_name, pc.email, pc.mobile_phone,
       o.order_id, p.plan_name, i.issue_month, o.start_month, o.end_month
     FROM qt_order_items i
     JOIN qt_orders o ON o.order_id = i.order_id
     LEFT JOIN churches c ON c.id = o.church_id
     LEFT JOIN pastoral_members m ON m.id = o.member_id
     LEFT JOIN pastoral_member_contacts pc ON pc.member_id = m.id
     LEFT JOIN qt_price_plans p ON p.plan_id = o.plan_id
     LEFT JOIN LATERAL (
       SELECT g.name
       FROM pastoral_member_group_assignments a
       JOIN pastoral_groups g ON g.id = a.group_id
       WHERE a.member_id = m.id AND a.is_current
       ORDER BY g.level_no DESC, g.sort_order DESC, g.id DESC
       LIMIT 1
     ) pg ON true
     WHERE i.issue_month = $1
       AND NOT i.is_received
       AND o.order_status <> 'cancelled'
     ORDER BY c.sort_order, pg.name, m.name, o.order_id
     LIMIT 500`,
    [issueMonth]
  );
  return rows.map(row => toQtNotificationRecipient('unreceived', issueMonth, row));
}

async function getQtExpiringNotificationRecipients(issueMonth) {
  const { rows } = await pool.query(
    `SELECT c.name AS church_name, pg.name AS pastoral_group_name,
       m.id AS member_id, m.name AS member_name, pc.email, pc.mobile_phone,
       o.order_id, p.plan_name, o.start_month, o.end_month, o.end_month AS issue_month
     FROM qt_orders o
     LEFT JOIN churches c ON c.id = o.church_id
     LEFT JOIN pastoral_members m ON m.id = o.member_id
     LEFT JOIN pastoral_member_contacts pc ON pc.member_id = m.id
     LEFT JOIN qt_price_plans p ON p.plan_id = o.plan_id
     LEFT JOIN LATERAL (
       SELECT g.name
       FROM pastoral_member_group_assignments a
       JOIN pastoral_groups g ON g.id = a.group_id
       WHERE a.member_id = m.id AND a.is_current
       ORDER BY g.level_no DESC, g.sort_order DESC, g.id DESC
       LIMIT 1
     ) pg ON true
     WHERE date_trunc('month', o.end_month)::date = $1
       AND o.order_status <> 'cancelled'
     ORDER BY c.sort_order, pg.name, m.name, o.order_id
     LIMIT 500`,
    [issueMonth]
  );
  return rows.map(row => toQtNotificationRecipient('expiring', issueMonth, row));
}

function toQtNotificationRecipient(type, issueMonth, row) {
  const subject = buildQtNotificationSubject(type, issueMonth);
  const body = buildQtNotificationBody(type, issueMonth, row);
  return {
    notificationType: type,
    issueMonth,
    memberId: row.member_id || '',
    memberName: row.member_name || '',
    email: row.email || '',
    mobilePhone: row.mobile_phone || '',
    churchName: row.church_name || '',
    pastoralGroupName: row.pastoral_group_name || '',
    orderId: row.order_id || '',
    planName: row.plan_name || '',
    startMonth: formatDate(row.start_month),
    endMonth: formatDate(row.end_month),
    subject,
    body,
    canSend: Boolean(row.email)
  };
}

function buildQtNotificationSubject(type, issueMonth) {
  const yearMonth = normalizeYearMonth(issueMonth);
  if (type === 'unreceived') return `TopChurchPlus QT 未領取提醒 ${yearMonth}`;
  return `TopChurchPlus QT 即將到期提醒 ${yearMonth}`;
}

function buildQtNotificationBody(type, issueMonth, row) {
  const memberName = row.member_name || '您好';
  const planName = row.plan_name || 'QT';
  const yearMonth = normalizeYearMonth(issueMonth);
  if (type === 'unreceived') {
    return [
      `${memberName} 平安：`,
      '',
      `提醒您 ${yearMonth} 的 ${planName} 目前尚未領取。`,
      `訂單編號：${row.order_id || ''}`,
      `會堂：${row.church_name || ''}`,
      '',
      '請於開放領取期間至指定會堂領取。'
    ].join('\n');
  }
  return [
    `${memberName} 平安：`,
    '',
    `提醒您的 ${planName} 訂閱即將於 ${yearMonth} 到期。`,
    `訂單編號：${row.order_id || ''}`,
    `會堂：${row.church_name || ''}`,
    '',
    '若需要續訂，請洽行政同工或透過 TopChurchPlus 指定流程處理。'
  ].join('\n');
}

function normalizeQtNotificationType(type) {
  const value = String(type || '').trim();
  if (['unreceived', 'expiring'].includes(value)) return value;
  throw new Error('Unsupported QT notification type.');
}

function getQtNotificationTemplateCode(type) {
  return type === 'unreceived' ? 'QT_UNRECEIVED_REMINDER' : 'QT_EXPIRING_REMINDER';
}

function normalizeQtNotificationSummary(summary, results) {
  const recipientCount = Number(summary.recipientCount ?? results.length ?? 0);
  const successCount = Number(summary.successCount ?? results.filter(row => row.success).length ?? 0);
  const failedCount = Number(summary.failedCount ?? results.filter(row => row.email && !row.success).length ?? 0);
  const skippedCount = Number(summary.skippedCount ?? results.filter(row => !row.email).length ?? 0);
  return { recipientCount, successCount, failedCount, skippedCount };
}

function buildPastoralTreeReport(issueMonth, rows) {
  const root = [];
  const churchMap = new Map();
  const totals = createEmptyQtReportMetrics();

  rows.forEach(row => {
    addQtReportMetrics(totals, row.metrics);

    const churchKey = row.churchName || 'Unassigned church';
    if (!churchMap.has(churchKey)) {
      const church = createPastoralTreeNode('church', churchKey);
      churchMap.set(churchKey, { node: church, groups: new Map() });
      root.push(church);
    }

    const churchEntry = churchMap.get(churchKey);
    addQtReportMetrics(churchEntry.node.metrics, row.metrics);

    const groupKey = row.pastoralGroupName || 'Unassigned group';
    if (!churchEntry.groups.has(groupKey)) {
      const group = createPastoralTreeNode('pastoralGroup', groupKey);
      churchEntry.groups.set(groupKey, { node: group, plans: new Map() });
      churchEntry.node.children.push(group);
    }

    const groupEntry = churchEntry.groups.get(groupKey);
    addQtReportMetrics(groupEntry.node.metrics, row.metrics);

    const planKey = row.planName || 'Unspecified plan';
    if (!groupEntry.plans.has(planKey)) {
      const plan = createPastoralTreeNode('plan', planKey);
      groupEntry.plans.set(planKey, plan);
      groupEntry.node.children.push(plan);
    }
    addQtReportMetrics(groupEntry.plans.get(planKey).metrics, row.metrics);
  });

  return { issueMonth, totals, tree: root };
}

function createPastoralTreeNode(type, label) {
  return {
    type,
    label,
    metrics: createEmptyQtReportMetrics(),
    children: []
  };
}

function createEmptyQtReportMetrics() {
  return {
    orderCount: 0,
    quantity: 0,
    amount: 0,
    paidCount: 0,
    unpaidCount: 0,
    receivedCount: 0,
    unreceivedCount: 0
  };
}

function toQtReportMetrics(row) {
  return {
    orderCount: Number(row.order_count || 0),
    quantity: Number(row.quantity || 0),
    amount: Number(row.amount || 0),
    paidCount: Number(row.paid_count || 0),
    unpaidCount: Number(row.unpaid_count || 0),
    receivedCount: Number(row.received_count || 0),
    unreceivedCount: Number(row.unreceived_count || 0)
  };
}

function addQtReportMetrics(target, source) {
  Object.keys(createEmptyQtReportMetrics()).forEach(key => {
    target[key] = Number(target[key] || 0) + Number(source[key] || 0);
  });
}

function normalizeMonthlyInventoryPayload(payload) {
  const qtMonth = normalizeQtMonth(payload.qtMonth || payload.issueMonth);
  if (qtMonth < QT_CUTOVER_MONTH) {
    throw new Error('QT monthly inventory starts from 202609. Legacy months must stay read-only.');
  }

  const qtType = normalizeQtType(payload.qtType || payload.productType);
  const churchId = Number(payload.churchId || 0);
  const physicalQuantity = normalizeNonNegativeInteger(payload.physicalQuantity, 'physicalQuantity');
  const reservedQuantity = normalizeNonNegativeInteger(payload.reservedQuantity || 0, 'reservedQuantity');
  const retailQuantity = payload.retailQuantity === undefined || payload.retailQuantity === ''
    ? physicalQuantity - reservedQuantity
    : normalizeNonNegativeInteger(payload.retailQuantity, 'retailQuantity');
  const estimatedInboundQuantity = normalizeNonNegativeInteger(payload.estimatedInboundQuantity || 0, 'estimatedInboundQuantity');
  const actualInboundQuantity = normalizeNonNegativeInteger(payload.actualInboundQuantity || 0, 'actualInboundQuantity');

  if (!Number.isInteger(churchId) || churchId < 0) throw new Error('churchId is required.');
  if (reservedQuantity + retailQuantity !== physicalQuantity) {
    throw new Error('Invalid QT inventory invariant: physicalQuantity must equal reservedQuantity + retailQuantity.');
  }

  return {
    qtMonth,
    qtType,
    churchId,
    physicalQuantity,
    reservedQuantity,
    retailQuantity,
    estimatedInboundQuantity,
    actualInboundQuantity
  };
}

function normalizeMovementPayload(payload) {
  const issueMonth = normalizeMonth(payload.issueMonth);
  const qtMonth = normalizeQtMonth(payload.qtMonth || payload.issueMonth);
  const qtType = normalizeQtType(payload.qtType || payload.productType);
  const churchId = Number(payload.churchId || 0);
  const productType = String(payload.productType || qtTypeToLegacyProductType(qtType)).trim();
  const movementType = String(payload.movementType || '').trim();
  const quantity = Number(payload.quantity || 0);
  if (!churchId) throw new Error('請選擇會堂');
  if (!productType) throw new Error('請選擇 QT 類型');
  if (!['initial_stock', 'receive', 'sale', 'reserve', 'release', 'adjustment'].includes(movementType)) {
    throw new Error('庫存異動類型錯誤');
  }
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('數量需大於 0');
  return {
    issueMonth,
    churchId,
    productType,
    qtMonth,
    qtType,
    movementType,
    quantity,
    note: String(payload.note || '').trim()
  };
}

function signQuantity(movementType, quantity) {
  if (['sale', 'reserve'].includes(movementType)) return -Math.abs(quantity);
  return Math.abs(quantity);
}

function normalizeMonth(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error('月份格式錯誤');
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function normalizeYearMonth(value) {
  return normalizeMonth(value).slice(0, 7);
}

function normalizeQtMonth(value) {
  if (value instanceof Date) {
    return `${value.getFullYear()}${String(value.getMonth() + 1).padStart(2, '0')}`;
  }
  const raw = String(value || '').trim();
  const compact = raw.includes('-') ? raw.slice(0, 7).replace('-', '') : raw;
  if (!/^\d{6}$/.test(compact)) throw new Error('qt_month must use YYYYMM format.');
  const month = Number(compact.slice(4, 6));
  if (month < 1 || month > 12) throw new Error('qt_month month must be between 01 and 12.');
  return compact;
}

function normalizeQtType(value) {
  const raw = String(value || '').trim().toUpperCase();
  const legacy = String(value || '').trim();
  if (raw === 'ADULT' || legacy === 'adult_student') return 'ADULT';
  if (raw === 'CHILD' || legacy === 'eaglet') return 'CHILD';
  throw new Error('qt_type must be ADULT or CHILD.');
}

function qtTypeToLegacyProductType(qtType) {
  const type = QT_TYPES.find(item => item.qtType === qtType);
  return type ? type.legacyProductType : 'adult_student';
}

function qtTypeLabel(qtType) {
  const type = QT_TYPES.find(item => item.qtType === qtType);
  return type ? type.label : qtType;
}

function normalizeNonNegativeInteger(value, fieldName) {
  const number = Number(value || 0);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${fieldName} must be a non-negative integer.`);
  return number;
}

function normalizeDateOnly(value) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error('Date filter must use YYYY-MM-DD format.');
  return raw;
}

function normalizePickupStatus(value) {
  const status = String(value || 'unreceived').trim();
  return ['unreceived', 'received', 'all'].includes(status) ? status : 'unreceived';
}

function toInventoryItem(row) {
  const qtMonth = row.qt_month || (row.issue_month ? normalizeQtMonth(row.issue_month) : '');
  const qtType = row.qt_type || (row.product_type === 'eaglet' ? 'CHILD' : 'ADULT');
  return {
    inventoryId: row.inventory_id || '',
    qtMonth,
    qtType,
    qtTypeLabel: qtTypeLabel(qtType),
    issueMonth: row.issue_month ? formatDate(row.issue_month) : `${qtMonth.slice(0, 4)}-${qtMonth.slice(4, 6)}-01`,
    churchId: row.church_id,
    churchName: row.church_name,
    productType: row.product_type || qtTypeToLegacyProductType(qtType),
    productName: row.product_name || qtTypeLabel(qtType),
    physicalQuantity: Number(row.physical_quantity || 0),
    reservedQuantity: Number(row.reserved_quantity || 0),
    retailQuantity: Number(row.retail_quantity || 0),
    estimatedInboundQuantity: Number(row.estimated_inbound_quantity || 0),
    actualInboundQuantity: Number(row.actual_inbound_quantity || 0),
    inboundQuantity: Number(row.actual_inbound_quantity ?? row.inbound_quantity ?? 0),
    outboundQuantity: Number(row.reserved_quantity ?? row.outbound_quantity ?? 0),
    availableQuantity: Number(row.retail_quantity ?? row.available_quantity ?? 0),
    status: row.status || '',
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

function toOrderListItem(row) {
  return {
    orderId: row.order_id,
    churchName: row.church_name || '未設定會堂',
    pastoralGroupName: row.pastoral_group_name || '未分配',
    memberName: row.member_name || '',
    mobilePhone: row.mobile_phone || '',
    startMonth: formatDate(row.start_month),
    endMonth: formatDate(row.end_month),
    planName: row.plan_name || '',
    quantity: Number(row.quantity || 0),
    amount: Number(row.amount || 0),
    orderStatus: row.order_status,
    financeStatus: row.finance_status,
    paymentTypeName: row.payment_type_name || '',
    orderedAt: row.ordered_at,
    paidAt: row.paid_at,
    cancelledAt: row.cancelled_at
  };
}

function toMovementItem(row) {
  const qtType = row.qt_type || (row.product_type === 'eaglet' ? 'CHILD' : 'ADULT');
  return {
    movementId: row.movement_id,
    qtMonth: row.qt_month || (row.issue_month ? normalizeQtMonth(row.issue_month) : ''),
    qtType,
    qtTypeLabel: qtTypeLabel(qtType),
    issueMonth: formatDate(row.issue_month),
    churchId: row.church_id,
    churchName: row.church_name,
    productType: row.product_type,
    productName: row.product_name,
    movementType: row.movement_type,
    quantity: Number(row.quantity || 0),
    note: row.note || '',
    sourceSystem: row.source_system || '',
    sourceId: row.source_id || '',
    createdBy: row.created_by_name || '',
    createdAt: row.created_at
  };
}

module.exports = { registerQtRoutes };
