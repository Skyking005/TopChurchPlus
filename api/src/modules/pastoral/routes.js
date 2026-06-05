const { pool } = require('../../db');
const { FEATURE_ACCESS_RANK, SYSTEM_FEATURES } = require('../core/catalog');

function registerPastoralRoutes(app) {
  app.get('/pastoral/options', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertPastoralReadable(currentUser);
      res.json(await getPastoralOptions(currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.get('/pastoral/members', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertPastoralReadable(currentUser);
      res.json(await getPastoralMembers(req.query, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.get('/pastoral/members/:memberId', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertPastoralReadable(currentUser);
      const data = await getPastoralMemberDetail(req.params.memberId, currentUser);
      if (!data.member) throw new Error('找不到會友資料');
      res.json(data);
    } catch (err) {
      next(err);
    }
  });
}

async function getPastoralOptions(currentUser) {
  const churchAccess = await getPastoralChurchAccess(currentUser);
  const churchWhere = churchAccess.all ? '' : 'WHERE id = ANY($1::int[])';
  const churchValues = churchAccess.all ? [] : [churchAccess.churchIds];
  const groupWhere = churchAccess.all ? '' : 'WHERE g.church_id = ANY($1::int[])';
  const groupValues = churchAccess.all ? [] : [churchAccess.churchIds];

  const [churches, categories, groups] = await Promise.all([
    pool.query(`
      SELECT id, name, church_type
      FROM churches
      ${churchWhere}
      ORDER BY sort_order, id
    `, churchValues),
    pool.query(`
      SELECT code, name
      FROM membership_categories
      ORDER BY sort_order, code
    `),
    pool.query(`
      SELECT
        g.id,
        g.name,
        g.path,
        g.level_no,
        gt.name AS group_type,
        c.name AS church_name,
        count(a.member_id)::int AS member_count
      FROM pastoral_groups g
      LEFT JOIN pastoral_group_types gt ON gt.id = g.group_type_id
      LEFT JOIN churches c ON c.id = g.church_id
      LEFT JOIN pastoral_member_group_assignments a ON a.group_id = g.id AND a.is_current
      ${groupWhere}
      GROUP BY g.id, g.name, g.path, g.level_no, gt.name, c.name, g.sort_order
      ORDER BY g.level_no, g.sort_order, g.name
    `, groupValues)
  ]);

  return {
    churches: churches.rows.map(row => ({ id: row.id, name: row.name, churchType: row.church_type })),
    categories: categories.rows.map(row => ({ code: row.code, name: row.name })),
    groups: groups.rows.map(toPastoralGroupItem)
  };
}

async function getPastoralMembers(query, currentUser) {
  const churchAccess = await getPastoralChurchAccess(currentUser);
  const keyword = String(query.keyword || '').trim().toLowerCase();
  const category = String(query.category || '').trim();
  const churchId = String(query.churchId || '').trim();
  const groupId = String(query.groupId || '').trim();
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 10), 1), 100);
  const offset = (page - 1) * pageSize;
  const where = [];
  const values = [];

  if (!churchAccess.all) {
    if (!churchAccess.churchIds.length) {
      return { rows: [], total: 0, page, pageSize };
    }
    values.push(churchAccess.churchIds);
    where.push(`pm.church_id = ANY($${values.length}::int[])`);
  }

  if (keyword) {
    values.push(`%${keyword}%`);
    where.push(`(
      lower(pm.name) LIKE $${values.length}
      OR lower(coalesce(pc.mobile_phone, '')) LIKE $${values.length}
      OR lower(coalesce(pm.line_user_id, '')) LIKE $${values.length}
      OR lower(coalesce(g.path, '')) LIKE $${values.length}
    )`);
  }
  if (category) {
    values.push(category);
    where.push(`pm.membership_category_code = $${values.length}`);
  }
  if (churchId) {
    values.push(Number(churchId));
    where.push(`pm.church_id = $${values.length}`);
  }
  if (groupId) {
    values.push(Number(groupId));
    where.push(`EXISTS (
      SELECT 1
      FROM pastoral_member_group_assignments ga
      JOIN pastoral_group_closure gc ON gc.descendant_id = ga.group_id
      WHERE ga.member_id = pm.id
        AND ga.is_current
        AND gc.ancestor_id = $${values.length}
    )`);
  }

  const fromSql = `
    FROM pastoral_members pm
    LEFT JOIN churches ch ON ch.id = pm.church_id
    LEFT JOIN membership_categories mc ON mc.code = pm.membership_category_code
    LEFT JOIN pastoral_titles pt ON pt.id = pm.title_id
    LEFT JOIN marital_statuses ms ON ms.id = pm.marital_status_id
    LEFT JOIN pastoral_member_contacts pc ON pc.member_id = pm.id
    LEFT JOIN pastoral_member_addresses addr ON addr.member_id = pm.id AND addr.is_primary
    LEFT JOIN pastoral_member_faith faith ON faith.member_id = pm.id
    LEFT JOIN pastoral_member_group_assignments pga ON pga.member_id = pm.id AND pga.is_current
    LEFT JOIN pastoral_groups g ON g.id = pga.group_id
    LEFT JOIN accounts follow_account ON follow_account.staff_id = pm.followup_staff_id::text
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
  `;

  const countResult = await pool.query(`SELECT count(DISTINCT pm.id)::int AS total ${fromSql}`, values);
  const pageValues = values.slice();
  pageValues.push(pageSize);
  const limitIndex = pageValues.length;
  pageValues.push(offset);
  const offsetIndex = pageValues.length;

  const { rows } = await pool.query(
    `SELECT DISTINCT
       pm.id,
       pm.name,
       pm.gender,
       pm.created_date,
       pm.birthday,
       pm.light_status,
       pm.line_user_id,
       ch.name AS church_name,
       mc.name AS category_name,
       pt.name AS title_name,
       ms.name AS marital_status_name,
       pc.mobile_phone,
       addr.address_line,
       addr.city,
       addr.district,
       faith.is_christian,
       faith.accepted_christ,
       pm.baptized_date,
       follow_account.name AS followup_name,
       follow_account.position AS followup_position,
       g.path AS group_path
     ${fromSql}
     ORDER BY pm.id DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    pageValues
  );

  return { rows: rows.map(toPastoralMemberListItem), total: countResult.rows[0].total, page, pageSize };
}

async function getPastoralMemberDetail(memberId, currentUser) {
  const churchAccess = await getPastoralChurchAccess(currentUser);
  if (!churchAccess.all && !churchAccess.churchIds.length) return { member: null, careRecords: [] };
  const values = [memberId];
  let accessWhere = '';
  if (!churchAccess.all) {
    values.push(churchAccess.churchIds);
    accessWhere = ` AND pm.church_id = ANY($${values.length}::int[])`;
  }

  const { rows } = await pool.query(
    `SELECT
       pm.*,
       ch.name AS church_name,
       ch.church_type,
       mc.name AS category_name,
       pt.name AS title_name,
       pr.name AS profession_name,
       ms.name AS marital_status_name,
       pc.email,
       pc.home_phone,
       pc.office_phone,
       pc.mobile_phone,
       pc.preferred_contact_time,
       pc.referrer_name,
       pc.referrer_phone,
       addr.address_line,
       addr.city,
       addr.district,
       faith.is_christian,
       faith.previous_church_text,
       faith.willing_join_church,
       faith.willing_contact,
       faith.accepted_christ,
       faith.willing_continue_group,
       faith.willing_baptism,
       faith.prayer_request,
       faith.feedback,
       fam.spouse_text,
       fam.father_text,
       fam.mother_text,
       fam.children_text,
       g.path AS group_path
     FROM pastoral_members pm
     LEFT JOIN churches ch ON ch.id = pm.church_id
     LEFT JOIN membership_categories mc ON mc.code = pm.membership_category_code
     LEFT JOIN pastoral_titles pt ON pt.id = pm.title_id
     LEFT JOIN professions pr ON pr.id = pm.profession_id
     LEFT JOIN marital_statuses ms ON ms.id = pm.marital_status_id
     LEFT JOIN pastoral_member_contacts pc ON pc.member_id = pm.id
     LEFT JOIN pastoral_member_addresses addr ON addr.member_id = pm.id AND addr.is_primary
     LEFT JOIN pastoral_member_faith faith ON faith.member_id = pm.id
     LEFT JOIN pastoral_member_family_notes fam ON fam.member_id = pm.id
     LEFT JOIN pastoral_member_group_assignments pga ON pga.member_id = pm.id AND pga.is_current
     LEFT JOIN pastoral_groups g ON g.id = pga.group_id
     WHERE pm.id = $1${accessWhere}`,
    values
  );

  const member = rows[0];
  if (!member) return { member: null, careRecords: [] };

  const careRecords = await pool.query(
    `SELECT cr.id, cr.staff_id, cr.care_at, cr.content, a.name AS staff_name, a.position AS staff_position
     FROM pastoral_care_records cr
     LEFT JOIN accounts a ON a.staff_id = cr.staff_id::text
     WHERE cr.member_id = $1
     ORDER BY cr.care_at DESC NULLS LAST, cr.id DESC
     LIMIT 20`,
    [memberId]
  );

  return {
    member: toPastoralMemberDetail(member),
    careRecords: careRecords.rows.map(toPastoralCareRecord)
  };
}

function toPastoralGroupItem(row) {
  return {
    groupId: row.id,
    name: row.name,
    path: row.path,
    levelNo: row.level_no,
    groupType: row.group_type,
    churchName: row.church_name,
    memberCount: row.member_count || 0
  };
}

function toPastoralMemberListItem(row) {
  return {
    memberId: row.id,
    name: row.name,
    gender: formatGender(row.gender),
    createdDate: formatDate(row.created_date),
    birthday: formatDate(row.birthday),
    churchName: row.church_name || '',
    categoryName: row.category_name || '',
    titleName: row.title_name || '',
    maritalStatusName: row.marital_status_name || '',
    mobilePhone: row.mobile_phone || '',
    address: [row.city, row.district, row.address_line].filter(Boolean).join(' '),
    groupPath: row.group_path || '',
    lightStatus: formatLightStatus(row.light_status),
    faithStatus: formatFaithStatus(row),
    followupName: [row.followup_name, row.followup_position].filter(Boolean).join(' '),
    communityText: row.group_path || '無社區資料',
    lineBound: Boolean(row.line_user_id)
  };
}

function toPastoralMemberDetail(row) {
  return {
    memberId: row.id,
    name: row.name,
    gender: formatGender(row.gender),
    birthday: formatDate(row.birthday),
    churchName: row.church_name || '',
    churchType: row.church_type || '',
    categoryName: row.category_name || '',
    titleName: row.title_name || '',
    professionName: row.profession_name || '',
    professionNote: row.profession_note || '',
    maritalStatusName: row.marital_status_name || '',
    maritalNote: row.marital_note || '',
    sourceText: row.source_text || '',
    groupPath: row.group_path || '',
    mobilePhone: row.mobile_phone || '',
    homePhone: row.home_phone || '',
    officePhone: row.office_phone || '',
    email: row.email || '',
    preferredContactTime: row.preferred_contact_time || '',
    address: [row.city, row.district, row.address_line].filter(Boolean).join(' '),
    referrerName: row.referrer_name || '',
    referrerPhone: row.referrer_phone || '',
    lineDisplayId: row.line_display_id || '',
    lineBound: Boolean(row.line_user_id),
    lightStatus: formatLightStatus(row.light_status),
    isChristian: formatBoolean(row.is_christian),
    previousChurchText: row.previous_church_text || '',
    willingJoinChurch: formatBoolean(row.willing_join_church),
    willingContact: formatBoolean(row.willing_contact),
    acceptedChrist: formatBoolean(row.accepted_christ),
    willingContinueGroup: formatBoolean(row.willing_continue_group),
    willingBaptism: formatBoolean(row.willing_baptism),
    baptizedDate: formatDate(row.baptized_date),
    prayerRequest: row.prayer_request || '',
    feedback: row.feedback || '',
    spouseText: row.spouse_text || '',
    fatherText: row.father_text || '',
    motherText: row.mother_text || '',
    childrenText: row.children_text || '',
    note: row.note || ''
  };
}

function toPastoralCareRecord(row) {
  return {
    recordId: row.id,
    careAt: formatDateTime(row.care_at),
    staffName: [row.staff_name, row.staff_position].filter(Boolean).join(' '),
    content: row.content || ''
  };
}

function assertPastoralReadable(user) {
  return assertFeatureReadable(user, 'pastoral');
}

async function assertFeatureReadable(user, featureKey) {
  if (!user || !user.name) throw new Error('缺少登入者資訊');
  const access = await getFeatureAccess(user, featureKey);
  if (access === 'read' || access === 'edit') return access;
  throw new Error('沒有此系統功能的使用權限');
}

async function getFeatureAccess(user, featureKey) {
  if (!SYSTEM_FEATURES.includes(featureKey)) return 'none';
  if (user && user.featurePermissions && user.featurePermissions[featureKey]) {
    return user.featurePermissions[featureKey];
  }
  const access = await getEffectiveFeaturePermissions(user);
  return access[featureKey] || 'none';
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

function hasAnyRole(user, rolesToCheck) {
  const roles = normalizeRoles(user && user.roles, user && user.role);
  return rolesToCheck.some(role => roles.includes(role));
}

function normalizeRoles(roles, fallbackRole) {
  const values = Array.isArray(roles) ? roles : [];
  const normalized = values
    .concat(fallbackRole || [])
    .map(role => String(role || '').trim())
    .filter(Boolean);
  return [...new Set(normalized)];
}

function formatGender(value) {
  if (value === 1) return '男';
  if (value === 0) return '女';
  return '';
}

function formatBoolean(value) {
  if (value === true) return '是';
  if (value === false) return '否';
  return '';
}

function formatLightStatus(value) {
  const map = {
    0: '灰燈',
    1: '綠燈',
    2: '黃燈',
    3: '紅燈'
  };
  return map[value] || '';
}

function formatFaithStatus(row) {
  if (row.baptized_date) return '已受洗';
  if (row.accepted_christ === true) return '已決志';
  if (row.is_christian === true) return '基督徒';
  if (row.is_christian === false) return '未信主';
  return '';
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toISOString();
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

module.exports = { registerPastoralRoutes };
