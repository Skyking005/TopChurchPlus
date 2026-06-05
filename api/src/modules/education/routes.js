const { pool, tx } = require('../../db');
const { recordDomainEvent } = require('../../shared/cross-system');
const { formatDate } = require('../../shared/format');
const { assertFeatureEditable, assertFeatureReadable } = require('../../shared/permissions');
const { parseUser } = require('../../shared/users');

function registerEducationRoutes(app) {
  app.get('/education/course-categories', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertEducationReadable(currentUser);
      res.json(await getCourseCategories());
    } catch (err) {
      next(err);
    }
  });

  app.get('/education/courses', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertEducationReadable(currentUser);
      res.json(await getCourses(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.get('/education/class-forecast', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertEducationReadable(currentUser);
      res.json(await getClassForecast());
    } catch (err) {
      next(err);
    }
  });

  app.get('/education/courses/:courseId', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertEducationReadable(currentUser);
      res.json(await getCourseDetail(req.params.courseId));
    } catch (err) {
      next(err);
    }
  });

  app.post('/education/courses', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertEducationEditable(currentUser);
      res.json(await saveCourse(null, req.body.course || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.put('/education/courses/:courseId', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertEducationEditable(currentUser);
      res.json(await saveCourse(req.params.courseId, req.body.course || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });
}

async function getCourseCategories() {
  const { rows } = await pool.query(
    `SELECT category_id, category_name, is_class, sort_order, group_code
     FROM education_course_categories
     ORDER BY sort_order, category_id`
  );
  return rows.map(row => ({
    categoryId: row.category_id,
    categoryName: row.category_name,
    isClass: row.is_class,
    sortOrder: row.sort_order,
    groupCode: row.group_code
  }));
}

async function getCourses(query) {
  const keyword = String(query.keyword || '').trim().toLowerCase();
  const categoryId = Number(query.categoryId || 0);
  const status = String(query.status || '').trim();
  const where = [];
  const values = [];

  if (keyword) {
    values.push(`%${keyword}%`);
    where.push(`(lower(c.course_name) LIKE $${values.length} OR lower(coalesce(cat.category_name, '')) LIKE $${values.length})`);
  }
  if (categoryId) {
    values.push(categoryId);
    where.push(`c.category_id = $${values.length}`);
  }
  if (status) {
    values.push(status);
    where.push(`c.status = $${values.length}`);
  } else {
    where.push(`c.status <> 'archived'`);
  }

  const { rows } = await pool.query(
    `SELECT
       c.course_id,
       c.course_name,
       c.start_date,
       c.end_date,
       c.status,
       cat.category_id,
       cat.category_name,
       count(e.enrollment_id)::int AS enrollment_count,
       count(e.enrollment_id) FILTER (WHERE e.is_completed)::int AS completed_count
     FROM education_courses c
     LEFT JOIN education_course_categories cat ON cat.category_id = c.category_id
     LEFT JOIN education_enrollments e ON e.course_id = c.course_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     GROUP BY c.course_id, cat.category_id, cat.category_name
     ORDER BY c.start_date DESC NULLS LAST, c.course_id DESC`,
    values
  );
  return rows.map(toCourseListItem);
}

async function getClassForecast() {
  const stageDefinitions = [
    { key: 'e1', label: 'E1', patterns: ['E1'] },
    { key: 'growth', label: '成長班', patterns: ['成長班'] },
    { key: 'e2', label: 'E2', patterns: ['E2'] },
    { key: 'disciple', label: '門徒班', patterns: ['門徒班'] },
    { key: 'e3', label: 'E3', patterns: ['E3'] },
    { key: 'leader', label: '領袖班', patterns: ['領袖班'] }
  ];

  const { rows } = await pool.query(
    `SELECT
       pm.id AS member_id,
       pm.name AS member_name,
       ch.name AS church_name,
       mc.name AS category_name,
       lower(coalesce(cat.category_name, '') || ' ' || coalesce(c.course_name, '')) AS course_text,
       bool_or(e.is_completed) AS is_completed,
       bool_or(NOT e.is_completed AND c.status <> 'archived') AS is_pending
     FROM pastoral_members pm
     LEFT JOIN churches ch ON ch.id = pm.church_id
     LEFT JOIN membership_categories mc ON mc.code = pm.membership_category_code
     LEFT JOIN education_enrollments e ON e.member_id = pm.id
     LEFT JOIN education_courses c ON c.course_id = e.course_id
     LEFT JOIN education_course_categories cat ON cat.category_id = c.category_id
     WHERE pm.is_active = true
     GROUP BY pm.id, pm.name, ch.name, mc.name, lower(coalesce(cat.category_name, '') || ' ' || coalesce(c.course_name, ''))`
  );

  const members = new Map();
  rows.forEach(row => {
    if (!members.has(row.member_id)) {
      members.set(row.member_id, {
        memberId: row.member_id,
        memberName: row.member_name,
        churchName: row.church_name || '',
        categoryName: row.category_name || '',
        completed: new Set(),
        pending: new Set()
      });
    }
    const member = members.get(row.member_id);
    stageDefinitions.forEach(stage => {
      if (matchesEducationStage(row.course_text, stage.patterns)) {
        if (row.is_completed) member.completed.add(stage.key);
        if (row.is_pending) member.pending.add(stage.key);
      }
    });
  });

  const sequence = stageDefinitions.map((stage, index) => ({
    ...stage,
    prerequisiteKey: index === 0 ? null : stageDefinitions[index - 1].key,
    prerequisiteLabel: index === 0 ? '尚未完成 E1' : `已完成 ${stageDefinitions[index - 1].label}`
  }));

  return sequence.map(stage => {
    const eligibleMembers = [...members.values()].filter(member => {
      const hasPrerequisite = stage.prerequisiteKey ? member.completed.has(stage.prerequisiteKey) : true;
      return hasPrerequisite && !member.completed.has(stage.key);
    });
    const pendingMembers = eligibleMembers.filter(member => member.pending.has(stage.key));
    const estimatedMembers = eligibleMembers.filter(member => !member.pending.has(stage.key));
    return {
      stageKey: stage.key,
      stageName: stage.label,
      prerequisite: stage.prerequisiteLabel,
      eligibleCount: eligibleMembers.length,
      pendingCount: pendingMembers.length,
      estimatedCount: estimatedMembers.length,
      sampleMembers: estimatedMembers.slice(0, 12).map(member => ({
        memberId: member.memberId,
        memberName: member.memberName,
        churchName: member.churchName,
        categoryName: member.categoryName
      }))
    };
  });
}

async function getCourseDetail(courseId) {
  const { rows } = await pool.query(
    `SELECT
       c.*,
       cat.category_name,
       cat.is_class
     FROM education_courses c
     LEFT JOIN education_course_categories cat ON cat.category_id = c.category_id
     WHERE c.course_id = $1`,
    [courseId]
  );
  const course = rows[0];
  if (!course) throw new Error('找不到課程資料');

  const enrollments = await pool.query(
    `SELECT
       e.enrollment_id,
       e.member_id,
       e.is_completed,
       e.note,
       pm.name AS member_name,
       ch.name AS church_name,
       mc.name AS category_name,
       pt.name AS title_name
     FROM education_enrollments e
     JOIN pastoral_members pm ON pm.id = e.member_id
     LEFT JOIN churches ch ON ch.id = pm.church_id
     LEFT JOIN membership_categories mc ON mc.code = pm.membership_category_code
     LEFT JOIN pastoral_titles pt ON pt.id = pm.title_id
     WHERE e.course_id = $1
     ORDER BY e.is_completed DESC, ch.sort_order NULLS LAST, pm.name`,
    [courseId]
  );

  return {
    course: toCourseDetail(course),
    enrollments: enrollments.rows.map(toEnrollmentItem)
  };
}

async function saveCourse(courseId, payload, currentUser) {
  const normalized = normalizeCoursePayload(payload);
  return tx(async client => {
    const isNew = !courseId;
    const id = isNew ? await generateCourseId(client) : Number(courseId);
    if (!Number.isInteger(id)) throw new Error('課程編號格式錯誤');

    const result = await client.query(
      `INSERT INTO education_courses (
         course_id, category_id, course_name, start_date, end_date, status, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,now())
       ON CONFLICT (course_id) DO UPDATE SET
         category_id = EXCLUDED.category_id,
         course_name = EXCLUDED.course_name,
         start_date = EXCLUDED.start_date,
         end_date = EXCLUDED.end_date,
         status = EXCLUDED.status,
         updated_at = now()
       RETURNING course_id`,
      [
        id,
        normalized.categoryId,
        normalized.courseName,
        normalized.startDate,
        normalized.endDate,
        normalized.status
      ]
    );

    await recordDomainEvent({
      eventType: isNew ? 'education.course_created' : 'education.course_updated',
      systemKey: 'education',
      entityType: 'education_course',
      entityId: String(result.rows[0].course_id),
      payload: { courseName: normalized.courseName },
      currentUser
    }, client);

    return { success: true, courseId: result.rows[0].course_id, message: isNew ? '課程已新增' : '課程已儲存' };
  });
}

function normalizeCoursePayload(payload) {
  const courseName = String(payload.courseName || payload.name || '').trim();
  if (!courseName) throw new Error('請填寫課程名稱');
  const categoryId = Number(payload.categoryId || 0) || null;
  const status = ['active', 'closed', 'archived'].includes(payload.status) ? payload.status : 'active';
  return {
    categoryId,
    courseName,
    startDate: normalizeDate(payload.startDate),
    endDate: normalizeDate(payload.endDate),
    status
  };
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  return text || null;
}

async function generateCourseId(client) {
  const { rows } = await client.query('SELECT COALESCE(max(course_id), 0)::int + 1 AS next_id FROM education_courses');
  return rows[0].next_id;
}

function matchesEducationStage(courseText, patterns) {
  const text = String(courseText || '').toLowerCase();
  return patterns.some(pattern => text.includes(String(pattern).toLowerCase()));
}

function toCourseListItem(row) {
  return {
    courseId: row.course_id,
    courseName: row.course_name,
    categoryId: row.category_id,
    categoryName: row.category_name,
    startDate: formatDate(row.start_date),
    endDate: formatDate(row.end_date),
    status: row.status || 'active',
    enrollmentCount: row.enrollment_count || 0,
    completedCount: row.completed_count || 0
  };
}

function toCourseDetail(row) {
  return {
    courseId: row.course_id,
    courseName: row.course_name,
    categoryId: row.category_id,
    categoryName: row.category_name,
    isClass: Boolean(row.is_class),
    startDate: formatDate(row.start_date),
    endDate: formatDate(row.end_date),
    status: row.status || 'active'
  };
}

function toEnrollmentItem(row) {
  return {
    enrollmentId: row.enrollment_id,
    memberId: row.member_id,
    memberName: row.member_name,
    churchName: row.church_name,
    categoryName: row.category_name,
    titleName: row.title_name,
    isCompleted: Boolean(row.is_completed),
    note: row.note
  };
}

function assertEducationReadable(user) {
  return assertFeatureReadable(user, 'education');
}

function assertEducationEditable(user) {
  return assertFeatureEditable(user, 'education');
}

module.exports = { registerEducationRoutes };
