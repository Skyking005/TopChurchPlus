const { pool } = require('../../db');
const { assertFeatureEditable, assertFeatureReadable } = require('../../shared/permissions');
const { parseUser } = require('../../shared/users');

function registerZoomRoutes(app) {
  app.get('/zoom/accounts', async (req, res, next) => {
    try {
      await assertFeatureReadable(parseUser(req), 'zoom');
      res.json(await getZoomAccounts(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.get('/zoom/availability', async (req, res, next) => {
    try {
      await assertFeatureReadable(parseUser(req), 'zoom');
      const [accounts, reservations] = await Promise.all([
        getZoomAccounts({ activeOnly: '1' }),
        getZoomReservations(req.query)
      ]);
      res.json({ accounts, reservations });
    } catch (err) {
      next(err);
    }
  });

  app.post('/zoom/reservations', async (req, res, next) => {
    try {
      await assertFeatureEditable(req.body.currentUser, 'zoom');
      res.json(await createZoomReservation(req.body));
    } catch (err) {
      next(err);
    }
  });

  app.patch('/zoom/reservations/:reservationId/cancel', async (req, res, next) => {
    try {
      await assertFeatureEditable(req.body.currentUser, 'zoom');
      res.json(await cancelZoomReservation(req.params.reservationId));
    } catch (err) {
      next(err);
    }
  });
}

async function getZoomAccounts(query = {}) {
  const activeOnly = String(query.activeOnly || '') === '1';
  const { rows } = await pool.query(
    `SELECT *
     FROM zoom_accounts
     ${activeOnly ? "WHERE status = 'active'" : ''}
     ORDER BY sort_order, email`
  );
  return rows.map(toZoomAccount);
}

async function getZoomReservations(query = {}) {
  const { startAt, endAt } = normalizeRange(query.startAt, query.endAt);
  const values = [startAt, endAt];
  const where = [
    "zr.status = 'reserved'",
    'zr.start_at < $2',
    'zr.end_at > $1'
  ];

  if (query.zoomAccountId) {
    values.push(String(query.zoomAccountId));
    where.push(`zr.zoom_account_id = $${values.length}`);
  }

  const { rows } = await pool.query(
    `SELECT zr.*, za.email, za.display_name
     FROM zoom_reservations zr
     JOIN zoom_accounts za ON za.zoom_account_id = zr.zoom_account_id
     WHERE ${where.join(' AND ')}
     ORDER BY zr.start_at, za.sort_order`,
    values
  );
  return rows.map(toZoomReservation);
}

async function createZoomReservation(payload) {
  const currentUser = payload.currentUser || {};
  const reservation = payload.reservation || {};
  const zoomAccountId = normalizeRequired(reservation.zoomAccountId, '請選擇 Zoom 帳號');
  const title = normalizeRequired(reservation.title, '請填寫借用主題');
  const borrowerName = normalizeRequired(reservation.borrowerName || currentUser.name, '請填寫借用人');
  const { startAt, endAt } = normalizeRange(reservation.startAt, reservation.endAt);
  const meetingTopic = String(reservation.meetingTopic || '').trim();
  const note = String(reservation.note || '').trim();

  await assertZoomAccountActive(zoomAccountId);
  await assertZoomAvailable(zoomAccountId, startAt, endAt);

  const { rows } = await pool.query(
    `INSERT INTO zoom_reservations (
       zoom_account_id, title, borrower_staff_id, borrower_name, start_at, end_at,
       meeting_topic, note, created_by_staff_id, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
     RETURNING zoom_reservation_id`,
    [
      zoomAccountId,
      title,
      currentUser.staffId ? String(currentUser.staffId) : null,
      borrowerName,
      startAt,
      endAt,
      meetingTopic || null,
      note || null,
      currentUser.staffId ? String(currentUser.staffId) : null
    ]
  );
  return { success: true, message: 'Zoom 帳號借用已建立', reservationId: rows[0].zoom_reservation_id };
}

async function cancelZoomReservation(reservationId) {
  const result = await pool.query(
    `UPDATE zoom_reservations
     SET status = 'cancelled', updated_at = now()
     WHERE zoom_reservation_id = $1
       AND status = 'reserved'`,
    [reservationId]
  );
  if (!result.rowCount) throw new Error('找不到可取消的 Zoom 借用資料');
  return { success: true, message: 'Zoom 借用已取消' };
}

async function assertZoomAccountActive(zoomAccountId) {
  const { rows } = await pool.query(
    "SELECT zoom_account_id FROM zoom_accounts WHERE zoom_account_id = $1 AND status = 'active'",
    [zoomAccountId]
  );
  if (!rows[0]) throw new Error('找不到可借用的 Zoom 帳號');
}

async function assertZoomAvailable(zoomAccountId, startAt, endAt) {
  const { rows } = await pool.query(
    `SELECT title, start_at, end_at
     FROM zoom_reservations
     WHERE zoom_account_id = $1
       AND status = 'reserved'
       AND start_at < $3
       AND end_at > $2
     LIMIT 1`,
    [zoomAccountId, startAt, endAt]
  );
  if (rows[0]) throw new Error(`此 Zoom 帳號已被借用：${rows[0].title}`);
}

function normalizeRange(startAt, endAt) {
  const start = startAt ? new Date(startAt) : new Date();
  const end = endAt ? new Date(endAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error('時間格式錯誤');
  if (end <= start) throw new Error('結束時間必須晚於開始時間');
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function normalizeRequired(value, message) {
  const text = String(value || '').trim();
  if (!text) throw new Error(message);
  return text;
}

function toZoomAccount(row) {
  return {
    zoomAccountId: row.zoom_account_id,
    email: row.email,
    displayName: row.display_name,
    status: row.status,
    note: row.note || '',
    label: `${row.display_name} / ${row.email}`
  };
}

function toZoomReservation(row) {
  return {
    reservationId: row.zoom_reservation_id,
    zoomAccountId: row.zoom_account_id,
    email: row.email,
    displayName: row.display_name,
    title: row.title,
    borrowerStaffId: row.borrower_staff_id,
    borrowerName: row.borrower_name,
    startAt: row.start_at,
    endAt: row.end_at,
    meetingTopic: row.meeting_topic || '',
    status: row.status,
    note: row.note || ''
  };
}

module.exports = { registerZoomRoutes };
