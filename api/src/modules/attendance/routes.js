const { pool } = require('../../db');
const { formatDate, formatDateTime } = require('../../shared/format');
const { assertFeatureReadable } = require('../../shared/permissions');
const { hasAnyRole, parseUser } = require('../../shared/users');

function registerAttendanceRoutes(app) {
  app.get('/attendance/options', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertAttendanceReadable(currentUser);
      res.json(await getAttendanceOptions(currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.get('/attendance/small-groups', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertAttendanceReadable(currentUser);
      res.json(await getSmallGroupStats(req.query, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.get('/attendance/small-groups/:groupId/members', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertAttendanceReadable(currentUser);
      res.json(await getSmallGroupMembers(req.params.groupId, req.query, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.get('/attendance/meetings', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertAttendanceReadable(currentUser);
      res.json(await getMeetingStats(req.query, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.get('/attendance/members/:memberId/recent', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertAttendanceReadable(currentUser);
      res.json(await getMemberRecentAttendance(req.params.memberId));
    } catch (err) {
      next(err);
    }
  });
}

async function getAttendanceOptions(currentUser) {
  const access = await getPastoralChurchAccess(currentUser);
  const values = [];
  const churchWhere = [];
  if (!access.all) {
    values.push(access.churchIds);
    churchWhere.push(`id = ANY($${values.length}::int[])`);
  }

  const [types, churches, groups, events] = await Promise.all([
    pool.query(
      `SELECT id, name, is_area_based, active_weekdays
       FROM attendance_types
       WHERE is_active
       ORDER BY sort_order, id`
    ),
    pool.query(
      `SELECT id, name
       FROM churches
       ${churchWhere.length ? `WHERE ${churchWhere.join(' AND ')}` : ''}
       ORDER BY sort_order, id`,
      values
    ),
    pool.query(
      `SELECT g.id, g.name, g.path, g.church_id, ch.name AS church_name, g.level_no
       FROM pastoral_groups g
       LEFT JOIN churches ch ON ch.id = g.church_id
       WHERE g.is_active
         ${access.all ? '' : 'AND g.church_id = ANY($1::int[])'}
       ORDER BY ch.sort_order NULLS LAST, g.path, g.sort_order, g.id`,
      access.all ? [] : [access.churchIds]
    ),
    pool.query(
      `SELECT id, event_date
       FROM attendance_events
       ORDER BY event_date DESC
       LIMIT 24`
    )
  ]);

  const dateBounds = await getAttendanceDateBounds();

  return {
    types: types.rows.map(row => ({
      typeId: row.id,
      typeName: row.name,
      isAreaBased: Boolean(row.is_area_based),
      activeWeekdays: row.active_weekdays || []
    })),
    churches: churches.rows.map(row => ({
      churchId: row.id,
      churchName: row.name
    })),
    groups: groups.rows.map(row => ({
      groupId: row.id,
      groupName: row.name,
      groupPath: row.path || row.name,
      churchId: row.church_id,
      churchName: row.church_name || '',
      levelNo: row.level_no
    })),
    recentEvents: events.rows.map(row => ({
      eventId: row.id,
      eventDate: formatDate(row.event_date)
    })),
    defaultStartDate: dateBounds.startDate,
    defaultEndDate: dateBounds.endDate
  };
}

async function getSmallGroupStats(query, currentUser) {
  const access = await getPastoralChurchAccess(currentUser);
  const range = await getQueryDateRange(query);
  const typeId = Number(query.typeId || 2);
  const churchId = Number(query.churchId || 0);
  const groupId = Number(query.groupId || 0);
  const values = [range.startDate, range.endDate, typeId];
  const groupWhere = ['g.is_active'];

  applyChurchFilters(groupWhere, values, access, churchId, 'g.church_id');
  if (groupId) {
    values.push(groupId);
    groupWhere.push(`EXISTS (
      SELECT 1
      FROM pastoral_group_closure selected
      WHERE selected.ancestor_id = $${values.length}
        AND selected.descendant_id = g.id
    )`);
  }

  const { rows } = await pool.query(
    `WITH event_scope AS (
       SELECT id, event_date
       FROM attendance_events
       WHERE event_date BETWEEN $1::date AND $2::date
     ),
     last_events AS (
       SELECT id
       FROM event_scope
       ORDER BY event_date DESC
       LIMIT 3
     ),
     group_scope AS (
       SELECT g.id, g.name, g.path, g.church_id, g.level_no, ch.name AS church_name
       FROM pastoral_groups g
       LEFT JOIN churches ch ON ch.id = g.church_id
       WHERE ${groupWhere.join(' AND ')}
     ),
     member_scope AS (
       SELECT gs.id AS group_id, pm.id AS member_id
       FROM group_scope gs
       JOIN pastoral_member_group_assignments pga ON pga.group_id = gs.id AND pga.is_current
       JOIN pastoral_members pm ON pm.id = pga.member_id AND pm.is_active
     ),
     record_scope AS (
       SELECT ar.member_id, ar.event_id, ar.attendance_mode
       FROM attendance_record_dedup ar
       JOIN event_scope ev ON ev.id = ar.event_id
       WHERE ar.attendance_type_id = $3
     ),
     event_count AS (
       SELECT count(*)::int AS total_events FROM event_scope
     )
     SELECT
       gs.id AS group_id,
       gs.name AS group_name,
       gs.path AS group_path,
       gs.church_id,
       gs.church_name,
       gs.level_no,
       count(DISTINCT ms.member_id)::int AS member_count,
       count(rs.event_id)::int AS attendance_count,
       count(rs.event_id) FILTER (WHERE rs.attendance_mode = 'online')::int AS online_count,
       count(rs.event_id) FILTER (WHERE rs.attendance_mode = 'physical')::int AS physical_count,
       ec.total_events,
       count(DISTINCT ms.member_id) FILTER (
         WHERE NOT EXISTS (
           SELECT 1
           FROM record_scope recent
           JOIN last_events le ON le.id = recent.event_id
           WHERE recent.member_id = ms.member_id
         )
       )::int AS recent_absent_count
     FROM group_scope gs
     LEFT JOIN member_scope ms ON ms.group_id = gs.id
     LEFT JOIN record_scope rs ON rs.member_id = ms.member_id
     CROSS JOIN event_count ec
     GROUP BY gs.id, gs.name, gs.path, gs.church_id, gs.church_name, gs.level_no, ec.total_events
     HAVING count(DISTINCT ms.member_id) > 0
     ORDER BY gs.path, gs.id
     LIMIT 300`,
    values
  );

  return {
    startDate: range.startDate,
    endDate: range.endDate,
    typeId,
    rows: rows.map(toSmallGroupStatsRow)
  };
}

async function getSmallGroupMembers(groupId, query, currentUser) {
  const access = await getPastoralChurchAccess(currentUser);
  const range = await getQueryDateRange(query);
  const typeId = Number(query.typeId || 2);
  const group = await getAccessibleGroup(groupId, access);
  if (!group) throw new Error('找不到可讀取的小家資料');

  const events = await pool.query(
    `SELECT id, event_date
     FROM attendance_events
     WHERE event_date BETWEEN $1::date AND $2::date
     ORDER BY event_date DESC
     LIMIT 8`,
    [range.startDate, range.endDate]
  );
  const eventIds = events.rows.map(row => row.id);

  const { rows } = await pool.query(
    `SELECT
       pm.id AS member_id,
       pm.name AS member_name,
       pc.mobile_phone,
       a.name AS followup_name,
       e.id AS event_id,
       e.event_date,
       ar.attendance_mode,
       ar.recorded_at
     FROM pastoral_member_group_assignments pga
     JOIN pastoral_members pm ON pm.id = pga.member_id AND pm.is_active
     LEFT JOIN pastoral_member_contacts pc ON pc.member_id = pm.id
     LEFT JOIN accounts a ON a.staff_id = pm.followup_staff_id::text
     CROSS JOIN LATERAL (
       SELECT id, event_date
       FROM attendance_events
       WHERE id = ANY($2::bigint[])
     ) e
     LEFT JOIN attendance_record_dedup ar
       ON ar.member_id = pm.id
      AND ar.event_id = e.id
      AND ar.attendance_type_id = $3
     WHERE pga.group_id = $1
       AND pga.is_current
     ORDER BY pm.name, e.event_date DESC`,
    [Number(groupId), eventIds, typeId]
  );

  const members = new Map();
  rows.forEach(row => {
    if (!members.has(row.member_id)) {
      members.set(row.member_id, {
        memberId: row.member_id,
        memberName: row.member_name,
        mobilePhone: row.mobile_phone || '',
        followupName: row.followup_name || '',
        attendances: []
      });
    }
    members.get(row.member_id).attendances.push({
      eventId: row.event_id,
      eventDate: formatDate(row.event_date),
      attended: Boolean(row.attendance_mode),
      attendanceMode: row.attendance_mode || '',
      recordedAt: formatDateTime(row.recorded_at)
    });
  });

  return {
    group: {
      groupId: group.id,
      groupName: group.name,
      groupPath: group.path || group.name,
      churchName: group.church_name || ''
    },
    events: events.rows.map(row => ({
      eventId: row.id,
      eventDate: formatDate(row.event_date)
    })),
    members: [...members.values()]
  };
}

async function getMeetingStats(query, currentUser) {
  const access = await getPastoralChurchAccess(currentUser);
  const range = await getQueryDateRange(query);
  const typeId = Number(query.typeId || 0);
  const churchId = Number(query.churchId || 0);
  const values = [range.startDate, range.endDate];
  const where = ['e.event_date BETWEEN $1::date AND $2::date'];

  if (typeId) {
    values.push(typeId);
    where.push(`ar.attendance_type_id = $${values.length}`);
  }
  applyChurchFilters(where, values, access, churchId, 'pm.church_id');

  const { rows } = await pool.query(
    `SELECT
       e.event_date,
       t.id AS type_id,
       t.name AS type_name,
       ch.id AS church_id,
       ch.name AS church_name,
       count(DISTINCT ar.member_id)::int AS total_count,
       count(DISTINCT ar.member_id) FILTER (WHERE ar.attendance_mode = 'physical')::int AS physical_count,
       count(DISTINCT ar.member_id) FILTER (WHERE ar.attendance_mode = 'online')::int AS online_count
     FROM attendance_record_dedup ar
     JOIN attendance_events e ON e.id = ar.event_id
     JOIN attendance_types t ON t.id = ar.attendance_type_id
     JOIN pastoral_members pm ON pm.id = ar.member_id
     LEFT JOIN churches ch ON ch.id = pm.church_id
     WHERE ${where.join(' AND ')}
     GROUP BY e.event_date, t.id, t.name, ch.id, ch.name
     ORDER BY e.event_date DESC, t.sort_order, ch.sort_order NULLS LAST, ch.id
     LIMIT 500`,
    values
  );

  const totalAttendance = rows.reduce((sum, row) => sum + Number(row.total_count || 0), 0);
  const eventKeys = new Set(rows.map(row => `${formatDate(row.event_date)}:${row.type_id}`));
  const maxAttendance = rows.reduce((max, row) => Math.max(max, Number(row.total_count || 0)), 0);

  return {
    startDate: range.startDate,
    endDate: range.endDate,
    summary: {
      totalAttendance,
      eventCount: eventKeys.size,
      averageAttendance: eventKeys.size ? Math.round(totalAttendance / eventKeys.size) : 0,
      maxAttendance
    },
    rows: rows.map(row => ({
      eventDate: formatDate(row.event_date),
      typeId: row.type_id,
      typeName: row.type_name,
      churchId: row.church_id,
      churchName: row.church_name || '未分會堂',
      totalCount: Number(row.total_count || 0),
      physicalCount: Number(row.physical_count || 0),
      onlineCount: Number(row.online_count || 0)
    }))
  };
}

async function getMemberRecentAttendance(memberId) {
  const { rows } = await pool.query(
    `SELECT
       t.id AS type_id,
       t.name AS type_name,
       e.id AS event_id,
       e.event_date,
       ar.id AS record_id,
       ar.attendance_mode,
       ar.recorded_at
     FROM attendance_events e
     JOIN attendance_types t ON t.id IN (1, 2)
     LEFT JOIN attendance_record_dedup ar
       ON ar.event_id = e.id
      AND ar.attendance_type_id = t.id
      AND ar.member_id = $1
     WHERE e.event_date >= current_date - interval '2 months'
       AND e.event_date <= current_date + interval '1 day'
     ORDER BY t.id, e.event_date DESC`,
    [Number(memberId)]
  );

  const typeMap = new Map();
  rows.forEach(row => {
    if (!typeMap.has(row.type_id)) {
      typeMap.set(row.type_id, {
        typeId: row.type_id,
        typeName: row.type_name,
        attendedCount: 0,
        totalEvents: 0,
        latestAttendanceDate: '',
        latestAttendanceMode: '',
        consecutiveAbsentCount: 0,
        events: []
      });
    }
    const item = typeMap.get(row.type_id);
    const attended = Boolean(row.record_id);
    item.totalEvents += 1;
    if (attended) {
      item.attendedCount += 1;
      if (!item.latestAttendanceDate) {
        item.latestAttendanceDate = formatDate(row.event_date);
        item.latestAttendanceMode = row.attendance_mode || '';
      }
    } else if (!item.latestAttendanceDate) {
      item.consecutiveAbsentCount += 1;
    }
    item.events.push({
      eventId: row.event_id,
      eventDate: formatDate(row.event_date),
      attended,
      attendanceMode: row.attendance_mode || '',
      recordedAt: formatDateTime(row.recorded_at)
    });
  });

  return [...typeMap.values()];
}

async function getAttendanceDateBounds() {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(max(event_date), current_date) AS end_date,
       COALESCE(max(event_date) - interval '56 days', current_date - interval '56 days') AS start_date
     FROM attendance_events
     WHERE event_date <= current_date + interval '7 days'`
  );
  return {
    startDate: formatDate(rows[0].start_date),
    endDate: formatDate(rows[0].end_date)
  };
}

async function getQueryDateRange(query) {
  const defaults = await getAttendanceDateBounds();
  return {
    startDate: normalizeDate(query.startDate) || defaults.startDate,
    endDate: normalizeDate(query.endDate) || defaults.endDate
  };
}

async function getAccessibleGroup(groupId, access) {
  const values = [Number(groupId)];
  const where = ['g.id = $1', 'g.is_active'];
  if (!access.all) {
    values.push(access.churchIds);
    where.push(`g.church_id = ANY($${values.length}::int[])`);
  }
  const { rows } = await pool.query(
    `SELECT g.*, ch.name AS church_name
     FROM pastoral_groups g
     LEFT JOIN churches ch ON ch.id = g.church_id
     WHERE ${where.join(' AND ')}`,
    values
  );
  return rows[0] || null;
}

function applyChurchFilters(where, values, access, churchId, columnName) {
  if (churchId) {
    values.push(churchId);
    where.push(`${columnName} = $${values.length}`);
  }
  if (!access.all) {
    values.push(access.churchIds);
    where.push(`${columnName} = ANY($${values.length}::int[])`);
  }
}

function toSmallGroupStatsRow(row) {
  const memberCount = Number(row.member_count || 0);
  const totalEvents = Number(row.total_events || 0);
  const attendanceCount = Number(row.attendance_count || 0);
  const averageAttendance = totalEvents ? Math.round((attendanceCount / totalEvents) * 10) / 10 : 0;
  const attendanceRate = memberCount && totalEvents ? Math.round((attendanceCount / (memberCount * totalEvents)) * 100) : 0;
  return {
    groupId: row.group_id,
    groupName: row.group_name,
    groupPath: row.group_path || row.group_name,
    churchId: row.church_id,
    churchName: row.church_name || '',
    levelNo: row.level_no,
    memberCount,
    totalEvents,
    attendanceCount,
    averageAttendance,
    attendanceRate,
    physicalCount: Number(row.physical_count || 0),
    onlineCount: Number(row.online_count || 0),
    recentAbsentCount: Number(row.recent_absent_count || 0)
  };
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

async function getPastoralChurchAccess(user) {
  if (hasAnyRole(user, ['管理員', '超級管理者'])) {
    return { all: true, churchIds: [] };
  }
  const staffId = user && user.staffId ? String(user.staffId) : '';
  if (!staffId) return { all: false, churchIds: [] };
  const { rows } = await pool.query(
    'SELECT church_id FROM account_pastoral_church_permissions WHERE staff_id = $1 ORDER BY church_id',
    [staffId]
  );
  return { all: false, churchIds: rows.map(row => Number(row.church_id)).filter(Number.isFinite) };
}

function assertAttendanceReadable(user) {
  return assertFeatureReadable(user, 'attendance');
}

module.exports = {
  getMemberRecentAttendance,
  registerAttendanceRoutes
};
