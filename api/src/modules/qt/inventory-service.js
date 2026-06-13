const { pool, tx } = require('../../db');
const { formatDate } = require('../../shared/format');
const { recordAuditLog } = require('../../shared/audit');

const QT_CUTOVER_MONTH = '202609';
const QT_TYPES = [
  { qtType: 'ADULT', label: '成人 QT', legacyProductType: 'adult_student' },
  { qtType: 'CHILD', label: '兒童 QT', legacyProductType: 'eaglet' }
];

async function listReservations(query = {}) {
  const values = [];
  const where = [];

  if (query.reservationId) {
    values.push(String(query.reservationId).trim());
    where.push(`r.reservation_id = $${values.length}`);
  }
  if (query.inventoryId) {
    values.push(String(query.inventoryId).trim());
    where.push(`r.inventory_id = $${values.length}`);
  }
  if (query.qtMonth || query.issueMonth) {
    values.push(normalizeQtMonth(query.qtMonth || query.issueMonth));
    where.push(`m.qt_month = $${values.length}`);
  }
  if (query.qtType || query.productType) {
    values.push(normalizeQtType(query.qtType || query.productType));
    where.push(`m.qt_type = $${values.length}`);
  }
  if (query.churchId !== undefined && query.churchId !== '') {
    values.push(normalizeId(query.churchId, 'churchId'));
    where.push(`m.church_id = $${values.length}`);
  }
  if (query.orderId !== undefined && query.orderId !== '') {
    values.push(normalizePositiveInteger(query.orderId, 'orderId'));
    where.push(`r.order_id = $${values.length}`);
  }
  if (query.orderItemId !== undefined && query.orderItemId !== '') {
    values.push(normalizePositiveInteger(query.orderItemId, 'orderItemId'));
    where.push(`r.order_item_id = $${values.length}`);
  }
  if (query.memberId !== undefined && query.memberId !== '') {
    values.push(normalizePositiveInteger(query.memberId, 'memberId'));
    where.push(`r.member_id = $${values.length}`);
  }
  if (query.status) {
    values.push(normalizeReservationStatus(query.status));
    where.push(`r.status = $${values.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT r.*, m.qt_month, m.qt_type, m.church_id, c.name AS church_name,
       member.name AS member_name,
       creator.name AS created_by_name,
       releaser.name AS released_by_name
     FROM qt_inventory_reservations r
     JOIN qt_inventory_monthly m ON m.inventory_id = r.inventory_id
     JOIN churches c ON c.id = m.church_id
     LEFT JOIN pastoral_members member ON member.id = r.member_id
     LEFT JOIN accounts creator ON creator.staff_id = r.created_by_staff_id
     LEFT JOIN accounts releaser ON releaser.staff_id = r.released_by_staff_id
     ${whereSql}
     ORDER BY r.created_at DESC, r.reservation_id DESC
     LIMIT 200`,
    values
  );
  return rows.map(toReservationItem);
}

async function getInventoryReconciliation(query = {}) {
  const values = [];
  const where = ['i.qt_month >= $1'];
  values.push(QT_CUTOVER_MONTH);

  if (query.qtMonth || query.issueMonth) {
    values.push(normalizeQtMonth(query.qtMonth || query.issueMonth));
    where.push(`i.qt_month = $${values.length}`);
  }
  if (query.qtType || query.productType) {
    values.push(normalizeQtType(query.qtType || query.productType));
    where.push(`i.qt_type = $${values.length}`);
  }
  if (query.churchId !== undefined && query.churchId !== '') {
    values.push(normalizeId(query.churchId, 'churchId'));
    where.push(`i.church_id = $${values.length}`);
  }

  const { rows } = await pool.query(
    `WITH reservation_summary AS (
       SELECT
         r.inventory_id,
         COALESCE(SUM(r.quantity) FILTER (WHERE r.status = 'reserved'), 0)::int AS active_reservation_quantity,
         COUNT(*) FILTER (WHERE r.status = 'reserved')::int AS active_reservation_count,
         COUNT(*) FILTER (WHERE r.status NOT IN ('reserved','released','fulfilled','cancelled'))::int AS bad_status_count,
         COUNT(*) FILTER (WHERE r.order_id IS NOT NULL AND o.order_id IS NULL)::int AS missing_order_count,
         COUNT(*) FILTER (WHERE r.order_item_id IS NOT NULL AND oi.order_item_id IS NULL)::int AS missing_order_item_count
       FROM qt_inventory_reservations r
       LEFT JOIN qt_orders o ON o.order_id = r.order_id
       LEFT JOIN qt_order_items oi ON oi.order_item_id = r.order_item_id
       GROUP BY r.inventory_id
     ),
     duplicate_active_items AS (
       SELECT inventory_id, COUNT(*)::int AS duplicate_active_item_count
       FROM (
         SELECT inventory_id, order_item_id
         FROM qt_inventory_reservations
         WHERE status = 'reserved'
           AND order_item_id IS NOT NULL
         GROUP BY inventory_id, order_item_id
         HAVING COUNT(*) > 1
       ) duplicated
       GROUP BY inventory_id
     ),
     movement_summary AS (
       SELECT
         inventory_id,
         COUNT(*)::int AS movement_count,
         MAX(created_at) AS last_movement_at
       FROM qt_inventory_movements
       WHERE inventory_id IS NOT NULL
       GROUP BY inventory_id
     )
     SELECT
       i.inventory_id,
       i.qt_month,
       i.qt_type,
       i.church_id,
       c.name AS church_name,
       i.physical_quantity,
       i.reserved_quantity,
       i.retail_quantity,
       COALESCE(rs.active_reservation_quantity, 0)::int AS active_reservation_quantity,
       COALESCE(rs.active_reservation_count, 0)::int AS active_reservation_count,
       COALESCE(rs.bad_status_count, 0)::int AS bad_status_count,
       COALESCE(rs.missing_order_count, 0)::int AS missing_order_count,
       COALESCE(rs.missing_order_item_count, 0)::int AS missing_order_item_count,
       COALESCE(dup.duplicate_active_item_count, 0)::int AS duplicate_active_item_count,
       COALESCE(ms.movement_count, 0)::int AS movement_count,
       ms.last_movement_at
     FROM qt_inventory_monthly i
     JOIN churches c ON c.id = i.church_id
     LEFT JOIN reservation_summary rs ON rs.inventory_id = i.inventory_id
     LEFT JOIN duplicate_active_items dup ON dup.inventory_id = i.inventory_id
     LEFT JOIN movement_summary ms ON ms.inventory_id = i.inventory_id
     WHERE ${where.join(' AND ')}
     ORDER BY i.qt_month DESC, c.sort_order, c.id, i.qt_type
     LIMIT 300`,
    values
  );

  const items = rows.map(toReconciliationItem);
  const summary = items.reduce((acc, item) => {
    acc.total += 1;
    acc[item.health] = (acc[item.health] || 0) + 1;
    acc.exceptionCount += item.exceptions.length;
    return acc;
  }, { total: 0, healthy: 0, warning: 0, critical: 0, legacyReview: 0, exceptionCount: 0 });

  return {
    generatedAt: new Date().toISOString(),
    cutoffMonth: QT_CUTOVER_MONTH,
    summary,
    rows: items
  };
}

async function createReservation(payload = {}, currentUser = {}) {
  const normalized = normalizeReservationPayload(payload);
  return tx(async client => {
    const inventory = await lockInventory(client, normalized);
    if (inventory.retail_quantity < normalized.quantity) {
      throw new Error(`QT retail inventory is not enough. Available: ${inventory.retail_quantity}.`);
    }

    await assertOrderReferences(client, normalized);

    const beforeInventory = toInventorySnapshot(inventory);
    const reservedQuantity = Number(inventory.reserved_quantity) + normalized.quantity;
    const retailQuantity = Number(inventory.retail_quantity) - normalized.quantity;

    const reservationResult = await client.query(
      `INSERT INTO qt_inventory_reservations (
         inventory_id, order_id, order_item_id, member_id, quantity,
         created_by_staff_id, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       RETURNING *`,
      [
        inventory.inventory_id,
        normalized.orderId,
        normalized.orderItemId,
        normalized.memberId,
        normalized.quantity,
        currentUser.staffId ? String(currentUser.staffId) : null,
        JSON.stringify(normalized.metadata)
      ]
    );
    const reservation = reservationResult.rows[0];

    const inventoryResult = await client.query(
      `UPDATE qt_inventory_monthly
       SET reserved_quantity = $2,
           retail_quantity = $3,
           updated_by_staff_id = $4,
           updated_at = now()
       WHERE inventory_id = $1
       RETURNING *`,
      [
        inventory.inventory_id,
        reservedQuantity,
        retailQuantity,
        currentUser.staffId ? String(currentUser.staffId) : null
      ]
    );

    const movement = await insertReservationMovement(client, {
      inventory,
      reservation,
      movementType: 'reserve',
      quantity: -normalized.quantity,
      note: normalized.note || 'QT reservation created.',
      currentUser
    });

    await recordAuditLog({
      currentUser,
      systemKey: 'qt',
      entityType: 'qt_inventory_reservation',
      entityId: reservation.reservation_id,
      action: 'create_reservation',
      beforeData: { inventory: beforeInventory },
      afterData: {
        reservation: toReservationItem({
          ...reservation,
          ...pickInventoryIdentity(inventory)
        }),
        inventory: toInventorySnapshot(inventoryResult.rows[0]),
        movementId: movement.movement_id
      },
      metadata: {
        inventoryId: inventory.inventory_id,
        qtMonth: inventory.qt_month,
        qtType: inventory.qt_type,
        quantity: normalized.quantity,
        orderId: normalized.orderId,
        orderItemId: normalized.orderItemId,
        source: 'qt_phase2b'
      }
    }, client);

    return {
      success: true,
      reservation: toReservationItem({
        ...reservation,
        ...pickInventoryIdentity(inventory)
      }),
      inventory: toInventorySnapshot(inventoryResult.rows[0]),
      movementId: movement.movement_id
    };
  });
}

async function approvePaymentAndCreateReservations(orderId, payload = {}, currentUser = {}) {
  const id = normalizePositiveInteger(orderId, 'orderId');

  return tx(async client => {
    const orderResult = await client.query(
      `SELECT o.*
       FROM qt_orders o
       WHERE o.order_id = $1
       FOR UPDATE`,
      [id]
    );
    if (!orderResult.rowCount) throw new Error('QT order not found.');

    const order = orderResult.rows[0];
    if (order.order_status === 'cancelled') throw new Error('Cancelled QT orders cannot be approved.');
    if (!['unpaid', 'received', 'posted'].includes(order.finance_status)) {
      throw new Error('Unsupported QT finance status.');
    }

    const itemResult = await client.query(
      `SELECT i.*
       FROM qt_order_items i
       WHERE i.order_id = $1
         AND to_char(i.issue_month, 'YYYYMM') >= $2
       ORDER BY i.issue_month, i.order_item_id
       FOR UPDATE`,
      [id, QT_CUTOVER_MONTH]
    );
    if (!itemResult.rowCount) {
      throw new Error('No 202609 or later QT order items are eligible for reservation.');
    }

    const orderItemIds = itemResult.rows.map(row => Number(row.order_item_id));
    const existingResult = await client.query(
      `SELECT *
       FROM qt_inventory_reservations
       WHERE status = 'reserved'
         AND order_item_id = ANY($1::int[])
       FOR UPDATE`,
      [orderItemIds]
    );
    const existingByItemId = new Map(existingResult.rows.map(row => [Number(row.order_item_id), row]));

    if (order.finance_status === 'posted') {
      if (existingByItemId.size === itemResult.rowCount) {
    return {
      success: true,
      alreadyPaid: true,
      message: 'QT order is already paid and reservations already exist.',
      orderId: id,
      financeStatus: order.finance_status,
      auditLogCreated: false,
      inventoryLogCreated: false,
      reservations: existingResult.rows.map(toReservationItem)
    };
      }
      throw new Error('QT order is already paid but reservations are incomplete. Run reconciliation before repair.');
    }

    const beforePaymentState = order.finance_status;
    const beforeInventories = [];
    const afterInventories = [];
    const reservations = [];
    const movementIds = [];
    const quantity = normalizePositiveInteger(order.quantity || 1, 'quantity');
    const qtType = normalizeQtType(order.product_type);

    for (const item of itemResult.rows) {
      if (existingByItemId.has(Number(item.order_item_id))) {
        throw new Error('Active QT reservation already exists for this order item.');
      }

      const qtMonth = normalizeQtMonth(item.issue_month);
      if (qtMonth < QT_CUTOVER_MONTH) {
        throw new Error('Legacy QT months cannot create reservations.');
      }

      const inventory = await lockInventory(client, {
        qtMonth,
        qtType,
        churchId: order.church_id
      });
      if (Number(inventory.retail_quantity) < quantity) {
        throw new Error(`QT retail inventory is not enough for ${qtMonth}. Available: ${inventory.retail_quantity}.`);
      }

      const beforeInventory = toInventorySnapshot(inventory);
      beforeInventories.push(beforeInventory);

      const reservationResult = await client.query(
        `INSERT INTO qt_inventory_reservations (
           inventory_id, order_id, order_item_id, member_id, quantity,
           created_by_staff_id, metadata
         ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
         RETURNING *`,
        [
          inventory.inventory_id,
          id,
          item.order_item_id,
          order.member_id || null,
          quantity,
          currentUser.staffId ? String(currentUser.staffId) : null,
          JSON.stringify({
            source: 'qt_phase3b_payment_approval',
            previousPaymentState: beforePaymentState,
            nextPaymentState: 'posted',
            qtMonth,
            qtType,
            orderId: id,
            orderItemId: item.order_item_id
          })
        ]
      );
      const reservation = reservationResult.rows[0];

      const inventoryResult = await client.query(
        `UPDATE qt_inventory_monthly
         SET reserved_quantity = reserved_quantity + $2,
             retail_quantity = retail_quantity - $2,
             updated_by_staff_id = $3,
             updated_at = now()
         WHERE inventory_id = $1
           AND retail_quantity >= $2
         RETURNING *`,
        [
          inventory.inventory_id,
          quantity,
          currentUser.staffId ? String(currentUser.staffId) : null
        ]
      );
      if (!inventoryResult.rowCount) {
        throw new Error(`QT retail inventory is not enough for ${qtMonth}.`);
      }
      assertInventoryInvariant(inventoryResult.rows[0]);
      const afterInventory = toInventorySnapshot(inventoryResult.rows[0]);
      afterInventories.push(afterInventory);

      const movement = await insertReservationMovement(client, {
        inventory,
        reservation,
        movementType: 'reserve',
        quantity: -quantity,
        note: payload.note || 'QT reservation created by payment approval.',
        currentUser,
        sourceSystem: 'qt_phase3b_payment_approval',
        phase: '3B'
      });

      reservations.push({
        ...reservation,
        ...pickInventoryIdentity(inventory)
      });
      movementIds.push(movement.movement_id);
    }

    const updatedOrderResult = await client.query(
      `UPDATE qt_orders
       SET finance_status = 'posted',
           paid_at = COALESCE(paid_at, now()),
           cashier_staff_id = COALESCE($2, cashier_staff_id),
           updated_at = now()
       WHERE order_id = $1
       RETURNING *`,
      [id, currentUser.staffId ? String(currentUser.staffId) : null]
    );

    await recordAuditLog({
      currentUser,
      systemKey: 'qt',
      entityType: 'qt_order',
      entityId: String(id),
      action: 'qt.payment.approve.create_reservation',
      beforeData: {
        orderId: id,
        financeStatus: beforePaymentState,
        inventories: beforeInventories
      },
      afterData: {
        orderId: id,
        financeStatus: updatedOrderResult.rows[0].finance_status,
        reservations: reservations.map(toReservationItem),
        inventories: afterInventories,
        movementIds
      },
      metadata: {
        orderId: id,
        qtMonths: itemResult.rows.map(row => normalizeQtMonth(row.issue_month)),
        qtType,
        churchId: order.church_id,
        quantity,
        previousPaymentState: beforePaymentState,
        nextPaymentState: 'posted',
        inventoryBefore: beforeInventories,
        inventoryAfter: afterInventories,
        reservationIds: reservations.map(row => row.reservation_id),
        movementIds,
        source: 'qt_phase3b_payment_approval'
      }
    }, client);

    return {
      success: true,
      message: 'QT payment approved and reservations created.',
      orderId: id,
      previousFinanceStatus: beforePaymentState,
      financeStatus: updatedOrderResult.rows[0].finance_status,
      reservations: reservations.map(toReservationItem),
      inventories: afterInventories,
      movementIds,
      auditLogCreated: true,
      inventoryLogCreated: movementIds.length > 0
    };
  });
}

async function releaseReservation(reservationId, payload = {}, currentUser = {}) {
  const id = normalizeUuid(reservationId, 'reservationId');
  const reason = String(payload.reason || payload.note || '').trim();

  return tx(async client => {
    const reservationResult = await client.query(
      `SELECT r.*, m.qt_month, m.qt_type, m.church_id, m.physical_quantity,
         m.reserved_quantity, m.retail_quantity, m.estimated_inbound_quantity,
         m.actual_inbound_quantity, m.status AS inventory_status
       FROM qt_inventory_reservations r
       JOIN qt_inventory_monthly m ON m.inventory_id = r.inventory_id
       WHERE r.reservation_id = $1
       FOR UPDATE OF r`,
      [id]
    );
    if (!reservationResult.rowCount) throw new Error('QT reservation not found.');
    const reservation = reservationResult.rows[0];
    if (reservation.status !== 'reserved') throw new Error('Only reserved QT reservations can be released.');

    const inventory = await lockInventory(client, { inventoryId: reservation.inventory_id });
    if (Number(inventory.reserved_quantity) < Number(reservation.quantity)) {
      throw new Error('QT reserved inventory would become negative.');
    }

    const beforeInventory = toInventorySnapshot(inventory);
    const reservedQuantity = Number(inventory.reserved_quantity) - Number(reservation.quantity);
    const retailQuantity = Number(inventory.retail_quantity) + Number(reservation.quantity);

    const updatedReservation = await client.query(
      `UPDATE qt_inventory_reservations
       SET status = 'released',
           released_at = now(),
           released_by_staff_id = $2,
           release_reason = $3,
           updated_at = now()
       WHERE reservation_id = $1
       RETURNING *`,
      [
        id,
        currentUser.staffId ? String(currentUser.staffId) : null,
        reason || null
      ]
    );

    const inventoryResult = await client.query(
      `UPDATE qt_inventory_monthly
       SET reserved_quantity = $2,
           retail_quantity = $3,
           updated_by_staff_id = $4,
           updated_at = now()
       WHERE inventory_id = $1
       RETURNING *`,
      [
        inventory.inventory_id,
        reservedQuantity,
        retailQuantity,
        currentUser.staffId ? String(currentUser.staffId) : null
      ]
    );

    const movement = await insertReservationMovement(client, {
      inventory,
      reservation,
      movementType: 'release',
      quantity: Number(reservation.quantity),
      note: reason || 'QT reservation released.',
      currentUser
    });

    await recordAuditLog({
      currentUser,
      systemKey: 'qt',
      entityType: 'qt_inventory_reservation',
      entityId: id,
      action: 'release_reservation',
      beforeData: {
        reservation: toReservationItem({
          ...reservation,
          ...pickInventoryIdentity(inventory)
        }),
        inventory: beforeInventory
      },
      afterData: {
        reservation: toReservationItem({
          ...updatedReservation.rows[0],
          ...pickInventoryIdentity(inventory)
        }),
        inventory: toInventorySnapshot(inventoryResult.rows[0]),
        movementId: movement.movement_id
      },
      metadata: {
        inventoryId: inventory.inventory_id,
        qtMonth: inventory.qt_month,
        qtType: inventory.qt_type,
        quantity: Number(reservation.quantity),
        orderId: reservation.order_id,
        orderItemId: reservation.order_item_id,
        source: 'qt_phase2b'
      }
    }, client);

    return {
      success: true,
      reservation: toReservationItem({
        ...updatedReservation.rows[0],
        ...pickInventoryIdentity(inventory)
      }),
      inventory: toInventorySnapshot(inventoryResult.rows[0]),
      movementId: movement.movement_id
    };
  });
}

async function fulfillSameChurchOrderItem(orderItemId, payload = {}, currentUser = {}) {
  const id = normalizePositiveInteger(orderItemId, 'orderItemId');
  const requestedChurchId = payload.churchId || payload.receivedChurchId || currentUser.counterChurchId || null;
  const receiverMemberId = normalizeOptionalPositiveInteger(payload.receiverMemberId || payload.memberId, 'receiverMemberId');
  const note = String(payload.note || '').trim();

  return tx(async client => {
    const itemResult = await client.query(
      `SELECT
         i.*,
         o.order_id,
         o.member_id,
         o.church_id,
         o.product_type,
         o.quantity AS order_quantity,
         o.finance_status,
         o.order_status
       FROM qt_order_items i
       JOIN qt_orders o ON o.order_id = i.order_id
       WHERE i.order_item_id = $1
       FOR UPDATE OF i, o`,
      [id]
    );
    if (!itemResult.rowCount) throw new Error('QT order item not found.');

    const item = itemResult.rows[0];
    if (item.order_status === 'cancelled') throw new Error('Cancelled QT orders cannot be fulfilled.');
    if (item.finance_status !== 'posted') throw new Error('Only paid QT orders can be fulfilled.');
    if (item.is_received) throw new Error('QT order item is already fulfilled.');

    const qtMonth = normalizeQtMonth(item.issue_month);
    if (qtMonth < QT_CUTOVER_MONTH) throw new Error('Legacy QT months cannot be fulfilled by the new inventory model.');

    const fulfillChurchId = requestedChurchId === null
      ? Number(item.church_id)
      : normalizeId(requestedChurchId, 'churchId');
    if (Number(item.church_id) !== fulfillChurchId) {
      throw new Error('Package A only supports same church fulfillment.');
    }

    const reservationResult = await client.query(
      `SELECT r.*, m.qt_month, m.qt_type, m.church_id, m.physical_quantity,
         m.reserved_quantity, m.retail_quantity, m.estimated_inbound_quantity,
         m.actual_inbound_quantity, m.status AS inventory_status
       FROM qt_inventory_reservations r
       JOIN qt_inventory_monthly m ON m.inventory_id = r.inventory_id
       WHERE r.order_item_id = $1
         AND r.status = 'reserved'
       FOR UPDATE OF r`,
      [id]
    );
    if (!reservationResult.rowCount) throw new Error('Active QT reservation not found. Approve payment before fulfillment.');
    if (reservationResult.rowCount > 1) throw new Error('Multiple active QT reservations found. Run reconciliation before fulfillment.');

    const reservation = reservationResult.rows[0];
    if (Number(reservation.church_id) !== fulfillChurchId) {
      throw new Error('Reservation church does not match same church fulfillment.');
    }
    if (reservation.qt_month !== qtMonth) {
      throw new Error('Reservation month does not match order item month.');
    }

    const inventory = await lockInventory(client, { inventoryId: reservation.inventory_id });
    const quantity = normalizePositiveInteger(reservation.quantity || item.order_quantity || 1, 'quantity');
    if (Number(inventory.physical_quantity) < quantity) throw new Error('QT physical inventory would become negative.');
    if (Number(inventory.reserved_quantity) < quantity) throw new Error('QT reserved inventory would become negative.');

    const beforeInventory = toInventorySnapshot(inventory);
    const beforeReservation = toReservationItem({
      ...reservation,
      ...pickInventoryIdentity(inventory)
    });

    const inventoryResult = await client.query(
      `UPDATE qt_inventory_monthly
       SET physical_quantity = physical_quantity - $2,
           reserved_quantity = reserved_quantity - $2,
           updated_by_staff_id = $3,
           updated_at = now()
       WHERE inventory_id = $1
         AND physical_quantity >= $2
         AND reserved_quantity >= $2
       RETURNING *`,
      [
        inventory.inventory_id,
        quantity,
        currentUser.staffId ? String(currentUser.staffId) : null
      ]
    );
    if (!inventoryResult.rowCount) throw new Error('QT inventory is not enough for fulfillment.');
    assertInventoryInvariant(inventoryResult.rows[0]);

    const updatedReservation = await client.query(
      `UPDATE qt_inventory_reservations
       SET status = 'fulfilled',
           fulfilled_at = now(),
           updated_at = now(),
           metadata = metadata || $2::jsonb
       WHERE reservation_id = $1
       RETURNING *`,
      [
        reservation.reservation_id,
        JSON.stringify({
          fulfilledByStaffId: currentUser.staffId || null,
          fulfilledChurchId: fulfillChurchId,
          source: 'qt_package_a_same_church_fulfillment'
        })
      ]
    );

    const updatedItem = await client.query(
      `UPDATE qt_order_items
       SET is_received = true,
           received_at = now(),
           receiver_member_id = COALESCE($2, receiver_member_id, $3),
           updated_at = now()
       WHERE order_item_id = $1
       RETURNING *`,
      [id, receiverMemberId, item.member_id || null]
    );

    const movement = await insertReservationMovement(client, {
      inventory,
      reservation: updatedReservation.rows[0],
      movementType: 'sale',
      quantity: -quantity,
      note: note || 'QT same church fulfillment.',
      currentUser,
      sourceSystem: 'qt_package_a_same_church_fulfillment',
      phase: 'PackageA'
    });

    await recordAuditLog({
      currentUser,
      systemKey: 'qt',
      entityType: 'qt_order_item',
      entityId: String(id),
      action: 'qt.fulfillment.same_church',
      beforeData: {
        orderItem: {
          orderItemId: id,
          isReceived: Boolean(item.is_received),
          receivedAt: item.received_at || null
        },
        reservation: beforeReservation,
        inventory: beforeInventory
      },
      afterData: {
        orderItem: {
          orderItemId: id,
          isReceived: Boolean(updatedItem.rows[0].is_received),
          receivedAt: updatedItem.rows[0].received_at || null
        },
        reservation: toReservationItem({
          ...updatedReservation.rows[0],
          ...pickInventoryIdentity(inventory)
        }),
        inventory: toInventorySnapshot(inventoryResult.rows[0]),
        movementId: movement.movement_id
      },
      metadata: {
        orderId: item.order_id,
        orderItemId: id,
        inventoryId: inventory.inventory_id,
        reservationId: reservation.reservation_id,
        qtMonth,
        qtType: inventory.qt_type,
        churchId: fulfillChurchId,
        quantity,
        source: 'qt_package_a_same_church_fulfillment'
      }
    }, client);

    return {
      success: true,
      message: 'QT same church fulfillment completed.',
      orderId: item.order_id,
      orderItemId: id,
      reservation: toReservationItem({
        ...updatedReservation.rows[0],
        ...pickInventoryIdentity(inventory)
      }),
      inventory: toInventorySnapshot(inventoryResult.rows[0]),
      movementId: movement.movement_id,
      auditLogCreated: true,
      inventoryLogCreated: true
    };
  });
}

async function lockInventory(client, payload) {
  const inventoryId = payload.inventoryId ? normalizeUuid(payload.inventoryId, 'inventoryId') : '';
  const values = [];
  const where = [];

  if (inventoryId) {
    values.push(inventoryId);
    where.push(`inventory_id = $${values.length}`);
  } else {
    const qtMonth = normalizeQtMonth(payload.qtMonth || payload.issueMonth);
    if (qtMonth < QT_CUTOVER_MONTH) throw new Error('QT reservations only support 202609 and later.');
    values.push(qtMonth);
    where.push(`qt_month = $${values.length}`);

    values.push(normalizeQtType(payload.qtType || payload.productType));
    where.push(`qt_type = $${values.length}`);

    values.push(normalizeId(payload.churchId, 'churchId'));
    where.push(`church_id = $${values.length}`);
  }

  const { rows } = await client.query(
    `SELECT *
     FROM qt_inventory_monthly
     WHERE ${where.join(' AND ')}
     FOR UPDATE`,
    values
  );
  if (!rows.length) throw new Error('QT monthly inventory not found.');
  const inventory = rows[0];
  assertInventoryInvariant(inventory);
  return inventory;
}

async function assertOrderReferences(client, payload) {
  if (payload.orderId) {
    const order = await client.query(
      'SELECT order_id FROM qt_orders WHERE order_id = $1',
      [payload.orderId]
    );
    if (!order.rowCount) throw new Error('QT order not found.');
  }
  if (payload.orderItemId) {
    const item = await client.query(
      'SELECT order_item_id, order_id FROM qt_order_items WHERE order_item_id = $1',
      [payload.orderItemId]
    );
    if (!item.rowCount) throw new Error('QT order item not found.');
    if (payload.orderId && Number(item.rows[0].order_id) !== Number(payload.orderId)) {
      throw new Error('QT order item does not belong to the provided order.');
    }
  }
  if (payload.memberId) {
    const member = await client.query(
      'SELECT id FROM pastoral_members WHERE id = $1',
      [payload.memberId]
    );
    if (!member.rowCount) throw new Error('Pastoral member not found.');
  }
}

async function insertReservationMovement(client, {
  inventory,
  reservation,
  movementType,
  quantity,
  note,
  currentUser,
  sourceSystem = 'qt_phase2b_reservation',
  phase = '2B'
}) {
  const result = await client.query(
    `INSERT INTO qt_inventory_movements (
       issue_month, church_id, product_type, movement_type, quantity,
       inventory_id, reservation_id, order_id, order_item_id,
       source_system, source_id, note, created_by_staff_id,
       qt_month, qt_type, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
     RETURNING movement_id`,
    [
      qtMonthToIssueMonth(inventory.qt_month),
      inventory.church_id,
      qtTypeToLegacyProductType(inventory.qt_type),
      movementType,
      quantity,
      inventory.inventory_id,
      reservation.reservation_id,
      reservation.order_id || null,
      reservation.order_item_id || null,
      sourceSystem,
      String(reservation.reservation_id),
      note || null,
      currentUser.staffId ? String(currentUser.staffId) : null,
      inventory.qt_month,
      inventory.qt_type,
      JSON.stringify({
        phase,
        reservationStatus: reservation.status,
        orderId: reservation.order_id || null,
        orderItemId: reservation.order_item_id || null
      })
    ]
  );
  return result.rows[0];
}

function normalizeReservationPayload(payload) {
  const inventoryId = payload.inventoryId ? normalizeUuid(payload.inventoryId, 'inventoryId') : '';
  const qtMonth = inventoryId ? '' : normalizeQtMonth(payload.qtMonth || payload.issueMonth);
  if (qtMonth && qtMonth < QT_CUTOVER_MONTH) throw new Error('QT reservations only support 202609 and later.');
  const qtType = inventoryId ? '' : normalizeQtType(payload.qtType || payload.productType);
  const churchId = inventoryId ? null : normalizeId(payload.churchId, 'churchId');
  const quantity = normalizePositiveInteger(payload.quantity || 1, 'quantity');

  return {
    inventoryId,
    qtMonth,
    qtType,
    churchId,
    quantity,
    orderId: normalizeOptionalPositiveInteger(payload.orderId, 'orderId'),
    orderItemId: normalizeOptionalPositiveInteger(payload.orderItemId, 'orderItemId'),
    memberId: normalizeOptionalPositiveInteger(payload.memberId, 'memberId'),
    note: String(payload.note || '').trim(),
    metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}
  };
}

function normalizeReservationStatus(value) {
  const status = String(value || '').trim();
  if (!['reserved', 'released', 'fulfilled', 'cancelled'].includes(status)) {
    throw new Error('Invalid QT reservation status.');
  }
  return status;
}

function assertInventoryInvariant(row) {
  const physical = Number(row.physical_quantity || 0);
  const reserved = Number(row.reserved_quantity || 0);
  const retail = Number(row.retail_quantity || 0);
  if (physical < 0 || reserved < 0 || retail < 0 || physical !== reserved + retail) {
    throw new Error('Invalid QT inventory invariant.');
  }
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

function normalizeId(value, fieldName) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${fieldName} is required.`);
  return number;
}

function normalizePositiveInteger(value, fieldName) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${fieldName} must be a positive integer.`);
  return number;
}

function normalizeOptionalPositiveInteger(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  return normalizePositiveInteger(value, fieldName);
}

function normalizeUuid(value, fieldName) {
  const text = String(value || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error(`${fieldName} must be a valid UUID.`);
  }
  return text;
}

function qtTypeToLegacyProductType(qtType) {
  const type = QT_TYPES.find(item => item.qtType === qtType);
  return type ? type.legacyProductType : 'adult_student';
}

function qtTypeLabel(qtType) {
  const type = QT_TYPES.find(item => item.qtType === qtType);
  return type ? type.label : qtType;
}

function qtMonthToIssueMonth(qtMonth) {
  return `${qtMonth.slice(0, 4)}-${qtMonth.slice(4, 6)}-01`;
}

function pickInventoryIdentity(row) {
  return {
    inventory_id: row.inventory_id,
    qt_month: row.qt_month,
    qt_type: row.qt_type,
    church_id: row.church_id,
    church_name: row.church_name
  };
}

function toInventorySnapshot(row) {
  return {
    inventoryId: row.inventory_id,
    qtMonth: row.qt_month,
    qtType: row.qt_type,
    churchId: row.church_id,
    physicalQuantity: Number(row.physical_quantity || 0),
    reservedQuantity: Number(row.reserved_quantity || 0),
    retailQuantity: Number(row.retail_quantity || 0),
    estimatedInboundQuantity: Number(row.estimated_inbound_quantity || 0),
    actualInboundQuantity: Number(row.actual_inbound_quantity || 0),
    status: row.status || ''
  };
}

function toReservationItem(row) {
  return {
    reservationId: row.reservation_id,
    inventoryId: row.inventory_id,
    qtMonth: row.qt_month,
    qtType: row.qt_type,
    qtTypeLabel: qtTypeLabel(row.qt_type),
    issueMonth: row.qt_month ? qtMonthToIssueMonth(row.qt_month) : '',
    churchId: row.church_id,
    churchName: row.church_name || '',
    orderId: row.order_id || null,
    orderItemId: row.order_item_id || null,
    memberId: row.member_id || null,
    memberName: row.member_name || '',
    quantity: Number(row.quantity || 0),
    status: row.status,
    reservedAt: row.reserved_at ? formatDate(row.reserved_at) : null,
    releasedAt: row.released_at ? formatDate(row.released_at) : null,
    fulfilledAt: row.fulfilled_at ? formatDate(row.fulfilled_at) : null,
    releaseReason: row.release_reason || '',
    createdBy: row.created_by_name || '',
    releasedBy: row.released_by_name || '',
    metadata: row.metadata || {},
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

function toReconciliationItem(row) {
  const physical = Number(row.physical_quantity || 0);
  const reserved = Number(row.reserved_quantity || 0);
  const retail = Number(row.retail_quantity || 0);
  const activeReservationQuantity = Number(row.active_reservation_quantity || 0);
  const reservationDelta = reserved - activeReservationQuantity;
  const exceptions = [];

  if (physical < 0) exceptions.push({ code: 'INV_NEG_PHYSICAL', severity: 'critical', message: 'Physical Inventory is negative.' });
  if (reserved < 0) exceptions.push({ code: 'INV_NEG_RESERVED', severity: 'critical', message: 'Reserved Inventory is negative.' });
  if (retail < 0) exceptions.push({ code: 'INV_NEG_RETAIL', severity: 'critical', message: 'Retail Inventory is negative.' });
  if (reserved + retail > physical) exceptions.push({ code: 'INV_SUM_OVER_PHYSICAL', severity: 'critical', message: 'Reserved + Retail is greater than Physical.' });
  if (reserved + retail < physical) exceptions.push({ code: 'INV_SUM_UNDER_PHYSICAL', severity: 'warning', message: 'Reserved + Retail is less than Physical.' });
  if (reservationDelta !== 0) exceptions.push({ code: 'RESERVATION_DELTA', severity: 'warning', message: 'Reserved quantity does not match active reservations.' });
  if (Number(row.bad_status_count || 0) > 0) exceptions.push({ code: 'RES_BAD_STATUS', severity: 'critical', message: 'Reservation has invalid status.' });
  if (Number(row.missing_order_count || 0) > 0) exceptions.push({ code: 'RES_NO_ORDER', severity: 'critical', message: 'Reservation references a missing order.' });
  if (Number(row.missing_order_item_count || 0) > 0) exceptions.push({ code: 'RES_NO_ORDER_ITEM', severity: 'critical', message: 'Reservation references a missing order item.' });
  if (Number(row.duplicate_active_item_count || 0) > 0) exceptions.push({ code: 'RES_DUP_ACTIVE_ITEM', severity: 'critical', message: 'Duplicate active reservation exists for one order item.' });
  if (String(row.qt_month || '') < QT_CUTOVER_MONTH) exceptions.push({ code: 'LEGACY_NEW_MODEL_MIX', severity: 'legacyReview', message: 'Legacy QT month appears in the new inventory model.' });

  const health = exceptions.some(item => item.severity === 'critical')
    ? 'critical'
    : exceptions.some(item => item.severity === 'legacyReview')
      ? 'legacyReview'
      : exceptions.length
        ? 'warning'
        : 'healthy';

  return {
    inventoryId: row.inventory_id,
    qtMonth: row.qt_month,
    qtType: row.qt_type,
    qtTypeLabel: qtTypeLabel(row.qt_type),
    churchId: row.church_id,
    churchName: row.church_name || '',
    physicalQuantity: physical,
    reservedQuantity: reserved,
    retailQuantity: retail,
    activeReservationQuantity,
    activeReservationCount: Number(row.active_reservation_count || 0),
    reservationDelta,
    movementCount: Number(row.movement_count || 0),
    lastMovementAt: row.last_movement_at || null,
    missingOrderCount: Number(row.missing_order_count || 0),
    missingOrderItemCount: Number(row.missing_order_item_count || 0),
    duplicateActiveItemCount: Number(row.duplicate_active_item_count || 0),
    badStatusCount: Number(row.bad_status_count || 0),
    health,
    exceptions
  };
}

module.exports = {
  approvePaymentAndCreateReservations,
  createReservation,
  fulfillSameChurchOrderItem,
  getInventoryReconciliation,
  listReservations,
  releaseReservation
};
