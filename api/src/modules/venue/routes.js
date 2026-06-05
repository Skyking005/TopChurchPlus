const { pool } = require('../../db');
const { assertFeatureEditable, assertFeatureReadable } = require('../../shared/permissions');
const { parseUser } = require('../../shared/users');

function registerVenueRoutes(app) {
  app.get('/venues/resources', async (req, res, next) => {
    try {
      await assertFeatureReadable(parseUser(req), 'venue');
      res.json(await getVenueResources(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.put('/venues/resources/calendar', async (req, res, next) => {
    try {
      await assertFeatureEditable(req.body.currentUser, 'venue');
      const resource = req.body.resource || {};
      res.json(await saveVenueResourceCalendar(resource));
    } catch (err) {
      next(err);
    }
  });

  app.put('/venues/resources/bookable', async (req, res, next) => {
    try {
      await assertFeatureEditable(req.body.currentUser, 'venue');
      const resource = req.body.resource || {};
      res.json(await saveVenueResourceBookable(resource));
    } catch (err) {
      next(err);
    }
  });

  app.get('/venues/reservations', async (req, res, next) => {
    try {
      await assertFeatureReadable(parseUser(req), 'venue');
      res.json(await getVenueReservations(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.get('/venues/availability', async (req, res, next) => {
    try {
      await assertFeatureReadable(parseUser(req), 'venue');
      const [resources, reservations] = await Promise.all([
        getVenueResources({ ...req.query, bookableOnly: '1' }),
        getVenueReservations(req.query)
      ]);
      res.json({ resources, reservations });
    } catch (err) {
      next(err);
    }
  });
}

async function getVenueResources(query = {}) {
  const hall = String(query.hall || '').trim();
  const mainLocation = String(query.mainLocation || '').trim();
  const bookableOnly = String(query.bookableOnly || '') === '1';
  const values = [];
  const where = [];
  if (hall) {
    values.push(hall);
    where.push(`l.hall = $${values.length}`);
  }
  if (mainLocation) {
    values.push(mainLocation);
    where.push(`l.main_location = $${values.length}`);
  }
  if (bookableOnly) {
    where.push('l.is_bookable');
  }

  const { rows } = await pool.query(
    `SELECT
       l.hall,
       l.main_location,
       bool_or(l.is_bookable) AS is_bookable,
       count(*)::int AS location_count,
       vc.calendar_id,
       vc.note
     FROM asset_locations l
     LEFT JOIN venue_resource_calendars vc
       ON vc.hall = l.hall
      AND vc.main_location = l.main_location
      AND vc.is_active
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     GROUP BY l.hall, l.main_location, vc.calendar_id, vc.note
     ORDER BY l.hall, l.main_location`,
    values
  );
  return rows.map(toVenueResource);
}

async function saveVenueResourceBookable(resource) {
  const hall = normalizeRequired(resource.hall, '請選擇會堂');
  const mainLocation = normalizeRequired(resource.mainLocation, '請選擇主要位置');
  const isBookable = Boolean(resource.isBookable);

  const result = await pool.query(
    `UPDATE asset_locations
     SET is_bookable = $3,
         updated_at = now()
     WHERE hall = $1
       AND main_location = $2
     RETURNING location_id`,
    [hall, mainLocation, isBookable]
  );
  if (!result.rowCount) throw new Error('找不到此場地位置');

  const resources = await getVenueResources({ hall, mainLocation });
  return {
    success: true,
    message: isBookable ? '場地已設為可借用' : '場地已設為不可借用',
    resource: resources[0]
  };
}

async function saveVenueResourceCalendar(resource) {
  const hall = normalizeRequired(resource.hall, '請選擇會堂');
  const mainLocation = normalizeRequired(resource.mainLocation, '請選擇主要位置');
  const calendarId = String(resource.calendarId || '').trim();
  const note = String(resource.note || '').trim();

  const exists = await pool.query(
    'SELECT 1 FROM asset_locations WHERE hall = $1 AND main_location = $2 LIMIT 1',
    [hall, mainLocation]
  );
  if (!exists.rows[0]) throw new Error('找不到此場地位置');

  await pool.query(
    `INSERT INTO venue_resource_calendars (hall, main_location, calendar_id, note, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (hall, main_location) DO UPDATE SET
       calendar_id = EXCLUDED.calendar_id,
       note = EXCLUDED.note,
       is_active = true,
       updated_at = now()`,
    [hall, mainLocation, calendarId || null, note || null]
  );

  const resources = await getVenueResources({ hall });
  const savedResource = resources.find(item => item.mainLocation === mainLocation);
  return { success: true, message: '場地行事曆設定已儲存', resource: savedResource };
}

async function getVenueReservations(query = {}) {
  const { startAt, endAt } = normalizeRange(query.startAt, query.endAt);
  const hall = String(query.hall || '').trim();
  const mainLocation = String(query.mainLocation || '').trim();
  const values = [startAt, endAt];
  const where = [
    `r.status NOT IN ('cancelled', 'rejected')`,
    `r.start_at < $2`,
    `r.end_at > $1`
  ];

  if (hall) {
    values.push(hall);
    where.push(`r.hall = $${values.length}`);
  }
  if (mainLocation) {
    values.push(mainLocation);
    where.push(`r.main_location = $${values.length}`);
  }

  const { rows } = await pool.query(
    `SELECT *
     FROM venue_reservations r
     WHERE ${where.join(' AND ')}
     ORDER BY r.start_at, r.hall, r.main_location`,
    values
  );
  return rows.map(toVenueReservation);
}

function normalizeRange(startAt, endAt) {
  const start = startAt ? new Date(startAt) : new Date();
  const end = endAt ? new Date(endAt) : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error('查詢時間格式錯誤');
  if (end <= start) throw new Error('結束時間必須晚於開始時間');
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function normalizeRequired(value, message) {
  const text = String(value || '').trim();
  if (!text) throw new Error(message);
  return text;
}

function toVenueResource(row) {
  return {
    hall: row.hall,
    mainLocation: row.main_location,
    isBookable: Boolean(row.is_bookable),
    locationCount: Number(row.location_count || 0),
    calendarId: row.calendar_id || '',
    note: row.note || '',
    label: [row.hall, row.main_location].filter(Boolean).join(' / ')
  };
}

function toVenueReservation(row) {
  return {
    reservationId: row.reservation_id,
    hall: row.hall,
    mainLocation: row.main_location,
    title: row.title,
    requesterName: row.requester_name,
    requesterStaffId: row.requester_staff_id,
    contactPhone: row.contact_phone,
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status,
    calendarId: row.calendar_id,
    calendarEventId: row.calendar_event_id,
    sourceSystem: row.source_system,
    sourceType: row.source_type,
    sourceId: row.source_id,
    note: row.note
  };
}

module.exports = { registerVenueRoutes };
