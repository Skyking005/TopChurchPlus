const { pool, tx } = require('../../db');
const { getMemberRecentAttendance } = require('../attendance/routes');
const { recordDomainEvent } = require('../../shared/cross-system');
const { normalizeFileInput, saveFileWithLink, toDataUrl } = require('../../shared/files');
const { recordAuditLog } = require('../../shared/audit');
const { formatDate, formatDateTime } = require('../../shared/format');
const { assertFeatureEditable, assertFeatureReadable } = require('../../shared/permissions');
const { hasAnyRole, parseUser } = require('../../shared/users');

const PASTORAL_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const PASTORAL_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

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

  app.get('/pastoral/members/duplicate-name', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertPastoralReadable(currentUser);
      res.json(await findDuplicatePastoralMemberNames(req.query, currentUser));
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

  app.post('/pastoral/members', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertPastoralEditable(currentUser);
      res.json(await savePastoralMember(null, req.body.member || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.put('/pastoral/members/:memberId', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertPastoralEditable(currentUser);
      res.json(await savePastoralMember(req.params.memberId, req.body.member || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.delete('/pastoral/members/:memberId', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertPastoralEditable(currentUser);
      res.json(await softDeletePastoralMember(req.params.memberId, currentUser));
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

  const [churches, categories, groups, titles, professions, maritalStatuses, regions, accounts] = await Promise.all([
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
    `, groupValues),
    pool.query('SELECT id, name FROM pastoral_titles ORDER BY sort_order, id'),
    pool.query('SELECT id, name FROM professions ORDER BY sort_order, id'),
    pool.query('SELECT id, name FROM marital_statuses ORDER BY sort_order, id'),
    pool.query('SELECT id, city, district, postal_code FROM regions ORDER BY city, district, postal_code'),
    pool.query(`
      SELECT staff_id, name, position
      FROM accounts
      ORDER BY
        CASE WHEN staff_id ~ '^[0-9]+$' THEN staff_id::int END NULLS LAST,
        staff_id
    `)
  ]);

  return {
    churches: churches.rows.map(row => ({ id: row.id, name: row.name, churchType: row.church_type })),
    categories: categories.rows.map(row => ({ code: row.code, name: row.name })),
    groups: groups.rows.map(toPastoralGroupItem),
    titles: titles.rows.map(row => ({ id: row.id, name: row.name })),
    professions: professions.rows.map(row => ({ id: row.id, name: row.name })),
    maritalStatuses: maritalStatuses.rows.map(row => ({ id: row.id, name: row.name })),
    regions: regions.rows.map(row => ({
      id: row.id,
      city: row.city,
      district: row.district,
      postalCode: row.postal_code,
      label: [row.city, row.district].filter(Boolean).join(' ')
    })),
    accounts: accounts.rows.map(row => ({
      staffId: row.staff_id,
      name: [row.name, row.position].filter(Boolean).join(' ')
    }))
  };
}

async function getPastoralMembers(query, currentUser) {
  const churchAccess = await getPastoralChurchAccess(currentUser);
  const keyword = String(query.keyword || '').trim().toLowerCase();
  const category = String(query.category || '').trim();
  const churchId = String(query.churchId || '').trim();
  const groupId = String(query.groupId || '').trim();
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const offset = (page - 1) * pageSize;
  const where = [];
  const values = [];
  where.push('pm.is_active');

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
       g.name AS group_name,
       g.path AS group_path
     ${fromSql}
     ORDER BY pm.id DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    pageValues
  );

  return { rows: rows.map(toPastoralMemberListItem), total: countResult.rows[0].total, page, pageSize };
}

async function findDuplicatePastoralMemberNames(query, currentUser) {
  const name = String(query.name || '').trim();
  const excludeMemberId = String(query.excludeMemberId || '').trim();
  if (!name) return { duplicates: [] };

  const churchAccess = await getPastoralChurchAccess(currentUser);
  if (!churchAccess.all && !churchAccess.churchIds.length) return { duplicates: [] };

  const values = [name];
  const where = [
    'pm.is_active',
    'lower(trim(pm.name)) = lower(trim($1))'
  ];

  if (excludeMemberId) {
    values.push(Number(excludeMemberId));
    where.push(`pm.id <> $${values.length}`);
  }
  if (!churchAccess.all) {
    values.push(churchAccess.churchIds);
    where.push(`pm.church_id = ANY($${values.length}::int[])`);
  }

  const { rows } = await pool.query(
    `SELECT
       pm.id,
       pm.name,
       pm.gender,
       pm.birthday,
       pm.light_status,
       ch.name AS church_name,
       mc.name AS category_name,
       pc.mobile_phone,
       g.path AS group_path
     FROM pastoral_members pm
     LEFT JOIN churches ch ON ch.id = pm.church_id
     LEFT JOIN membership_categories mc ON mc.code = pm.membership_category_code
     LEFT JOIN pastoral_member_contacts pc ON pc.member_id = pm.id
     LEFT JOIN pastoral_member_group_assignments pga ON pga.member_id = pm.id AND pga.is_current
     LEFT JOIN pastoral_groups g ON g.id = pga.group_id
     WHERE ${where.join(' AND ')}
     ORDER BY pm.id DESC
     LIMIT 10`,
    values
  );

  return {
    duplicates: rows.map(row => ({
      memberId: row.id,
      name: row.name,
      gender: row.gender,
      birthday: formatDate(row.birthday),
      lightStatus: row.light_status,
      churchName: row.church_name,
      categoryName: row.category_name,
      mobilePhone: row.mobile_phone,
      groupPath: row.group_path
    }))
  };
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
       faith.previous_church_id,
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
       addr.country_id,
       addr.region_id,
       addr.postal_code,
       pga.group_id,
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

  const educationEnrollments = await pool.query(
    `SELECT
       e.enrollment_id,
       e.is_completed,
       e.note,
       c.course_id,
       c.course_name,
       c.start_date,
       c.end_date,
       cat.category_name,
       cat.sort_order
     FROM education_enrollments e
     JOIN education_courses c ON c.course_id = e.course_id
     LEFT JOIN education_course_categories cat ON cat.category_id = c.category_id
     WHERE e.member_id = $1
     ORDER BY cat.sort_order, c.start_date DESC NULLS LAST, c.course_id DESC`,
    [memberId]
  );

  const files = await getPastoralMemberFiles(memberId);
  const recentAttendance = await getMemberRecentAttendance(memberId);

  return {
    member: toPastoralMemberDetail(member),
    careRecords: careRecords.rows.map(toPastoralCareRecord),
    educationEnrollments: educationEnrollments.rows.map(toPastoralEducationEnrollment),
    recentAttendance,
    files
  };
}

async function savePastoralMember(memberId, payload, currentUser) {
  const normalized = normalizePastoralMemberPayload(payload);
  await assertChurchWritable(normalized.base.churchId, currentUser);

  return tx(async client => {
    const isNew = !memberId;
    const id = isNew ? await generatePastoralMemberId(client) : Number(memberId);
    if (!Number.isInteger(id)) throw new Error('會友編號格式錯誤');

    if (!isNew) {
      const existing = await client.query('SELECT church_id FROM pastoral_members WHERE id = $1 AND is_active', [id]);
      if (!existing.rows[0]) throw new Error('找不到會友資料');
      await assertChurchWritable(existing.rows[0].church_id, currentUser);
    }

    await client.query(
      `INSERT INTO pastoral_members (
         id, church_id, name, gender, birthday, membership_category_code, title_id,
         profession_id, profession_note, source_text, marital_status_id, marital_note,
         line_display_id, line_user_id, light_status, followup_staff_id, created_date,
         baptized_date, note, is_active, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,true,now())
       ON CONFLICT (id) DO UPDATE SET
         church_id = EXCLUDED.church_id,
         name = EXCLUDED.name,
         gender = EXCLUDED.gender,
         birthday = EXCLUDED.birthday,
         membership_category_code = EXCLUDED.membership_category_code,
         title_id = EXCLUDED.title_id,
         profession_id = EXCLUDED.profession_id,
         profession_note = EXCLUDED.profession_note,
         source_text = EXCLUDED.source_text,
         marital_status_id = EXCLUDED.marital_status_id,
         marital_note = EXCLUDED.marital_note,
         line_display_id = EXCLUDED.line_display_id,
         line_user_id = EXCLUDED.line_user_id,
         light_status = EXCLUDED.light_status,
         followup_staff_id = EXCLUDED.followup_staff_id,
         created_date = EXCLUDED.created_date,
         baptized_date = EXCLUDED.baptized_date,
         note = EXCLUDED.note,
         is_active = true,
         updated_at = now()`,
      [
        id,
        normalized.base.churchId,
        normalized.base.name,
        normalized.base.gender,
        normalized.base.birthday,
        normalized.base.categoryCode,
        normalized.base.titleId,
        normalized.base.professionId,
        normalized.base.professionNote,
        normalized.base.sourceText,
        normalized.base.maritalStatusId,
        normalized.base.maritalNote,
        normalized.base.lineDisplayId,
        normalized.base.lineUserId,
        normalized.base.lightStatus,
        normalized.base.followupStaffId,
        normalized.base.createdDate,
        normalized.base.baptizedDate,
        normalized.base.note
      ]
    );

    await upsertPastoralContact(client, id, normalized.contact);
    await upsertPastoralAddress(client, id, normalized.address);
    await upsertPastoralFaith(client, id, normalized.faith);
    await upsertPastoralFamily(client, id, normalized.family);
    await replaceCurrentPastoralGroup(client, id, normalized.groupId);
    await savePastoralMemberImages(client, id, normalized.files, currentUser);

    await recordDomainEvent({
      eventType: isNew ? 'pastoral.member_created' : 'pastoral.member_updated',
      systemKey: 'pastoral',
      entityType: 'pastoral_member',
      entityId: String(id),
      payload: { churchId: normalized.base.churchId, name: normalized.base.name },
      currentUser
    }, client);
    await recordAuditLog({
      systemKey: 'pastoral',
      entityType: 'pastoral_member',
      entityId: String(id),
      action: isNew ? 'create' : 'update',
      memberId: id,
      afterData: {
        churchId: normalized.base.churchId,
        name: normalized.base.name,
        categoryCode: normalized.base.categoryCode,
        groupId: normalized.groupId
      },
      metadata: {
        hasFiles: Boolean(normalized.files.memberPhoto || normalized.files.newcomerFormImage)
      },
      currentUser
    }, client);

    return { success: true, memberId: id, message: isNew ? '會友資料已建立' : '會友資料已儲存' };
  });
}

async function softDeletePastoralMember(memberId, currentUser) {
  const id = Number(memberId);
  if (!Number.isInteger(id)) throw new Error('會友編號格式錯誤');

  return tx(async client => {
    const existing = await client.query('SELECT church_id, name FROM pastoral_members WHERE id = $1 AND is_active', [id]);
    if (!existing.rows[0]) throw new Error('找不到會友資料');
    await assertChurchWritable(existing.rows[0].church_id, currentUser);

    await client.query('UPDATE pastoral_members SET is_active = false, updated_at = now() WHERE id = $1', [id]);
    await retireCurrentPastoralGroup(client, id);

    await recordDomainEvent({
      eventType: 'pastoral.member_deleted',
      systemKey: 'pastoral',
      entityType: 'pastoral_member',
      entityId: String(id),
      payload: { churchId: existing.rows[0].church_id, name: existing.rows[0].name },
      currentUser
    }, client);
    await recordAuditLog({
      systemKey: 'pastoral',
      entityType: 'pastoral_member',
      entityId: String(id),
      action: 'soft_delete',
      memberId: id,
      beforeData: {
        churchId: existing.rows[0].church_id,
        name: existing.rows[0].name
      },
      currentUser
    }, client);

    return { success: true, message: '會友資料已停用' };
  });
}

function normalizePastoralMemberPayload(payload) {
  const base = payload.base || payload.member || payload;
  const name = normalizeText(base.name);
  if (!name) throw new Error('請填寫姓名');
  const churchId = toNullableInteger(base.churchId);
  if (churchId === null) throw new Error('請選擇會堂');

  return {
    base: {
      name,
      churchId,
      gender: toNullableInteger(base.gender),
      birthday: normalizeDate(base.birthday),
      categoryCode: normalizeText(base.categoryCode || base.membershipCategoryCode),
      titleId: toNullableInteger(base.titleId),
      professionId: toNullableInteger(base.professionId),
      professionNote: normalizeText(base.professionNote),
      sourceText: normalizeText(base.sourceText),
      maritalStatusId: toNullableInteger(base.maritalStatusId),
      maritalNote: normalizeText(base.maritalNote),
      lineDisplayId: normalizeText(base.lineDisplayId),
      lineUserId: normalizeText(base.lineUserId),
      lightStatus: toNullableInteger(base.lightStatus),
      followupStaffId: toNullableInteger(base.followupStaffId),
      createdDate: normalizeDate(base.createdDate) || new Date(),
      baptizedDate: normalizeDate(base.baptizedDate),
      note: normalizeText(base.note)
    },
    contact: payload.contact || {},
    address: payload.address || {},
    faith: payload.faith || {},
    family: payload.family || {},
    files: payload.files || {},
    groupId: toNullableInteger(payload.groupId || base.groupId)
  };
}

async function upsertPastoralContact(client, memberId, contact) {
  await client.query(
    `INSERT INTO pastoral_member_contacts (
       member_id, email, home_phone, office_phone, mobile_phone,
       preferred_contact_time, referrer_name, referrer_phone, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
     ON CONFLICT (member_id) DO UPDATE SET
       email = EXCLUDED.email,
       home_phone = EXCLUDED.home_phone,
       office_phone = EXCLUDED.office_phone,
       mobile_phone = EXCLUDED.mobile_phone,
       preferred_contact_time = EXCLUDED.preferred_contact_time,
       referrer_name = EXCLUDED.referrer_name,
       referrer_phone = EXCLUDED.referrer_phone,
       updated_at = now()`,
    [
      memberId,
      normalizeText(contact.email),
      normalizeText(contact.homePhone),
      normalizeText(contact.officePhone),
      normalizeText(contact.mobilePhone),
      normalizeText(contact.preferredContactTime),
      normalizeText(contact.referrerName),
      normalizeText(contact.referrerPhone)
    ]
  );
}

async function upsertPastoralAddress(client, memberId, address) {
  const regionId = toNullableInteger(address.regionId);
  let region = null;
  if (regionId) {
    const found = await client.query('SELECT country_id, city, district, postal_code FROM regions WHERE id = $1', [regionId]);
    region = found.rows[0] || null;
  }

  const row = {
    countryId: toNullableInteger(address.countryId) || region?.country_id || null,
    regionId,
    postalCode: normalizeText(address.postalCode) || region?.postal_code || null,
    city: normalizeText(address.city) || region?.city || null,
    district: normalizeText(address.district) || region?.district || null,
    addressLine: normalizeText(address.addressLine)
  };

  await client.query('DELETE FROM pastoral_member_addresses WHERE member_id = $1 AND is_primary', [memberId]);
  if (!row.countryId && !row.regionId && !row.postalCode && !row.city && !row.district && !row.addressLine) return;

  await client.query(
    `INSERT INTO pastoral_member_addresses (
       member_id, country_id, region_id, postal_code, city, district, address_line, is_primary
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
    [memberId, row.countryId, row.regionId, row.postalCode, row.city, row.district, row.addressLine]
  );
}

async function upsertPastoralFaith(client, memberId, faith) {
  await client.query(
    `INSERT INTO pastoral_member_faith (
       member_id, is_christian, previous_church_id, previous_church_text,
       willing_join_church, willing_contact, accepted_christ,
       willing_continue_group, willing_baptism, prayer_request, feedback, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
     ON CONFLICT (member_id) DO UPDATE SET
       is_christian = EXCLUDED.is_christian,
       previous_church_id = EXCLUDED.previous_church_id,
       previous_church_text = EXCLUDED.previous_church_text,
       willing_join_church = EXCLUDED.willing_join_church,
       willing_contact = EXCLUDED.willing_contact,
       accepted_christ = EXCLUDED.accepted_christ,
       willing_continue_group = EXCLUDED.willing_continue_group,
       willing_baptism = EXCLUDED.willing_baptism,
       prayer_request = EXCLUDED.prayer_request,
       feedback = EXCLUDED.feedback,
       updated_at = now()`,
    [
      memberId,
      toNullableBoolean(faith.isChristian),
      toNullableInteger(faith.previousChurchId),
      normalizeText(faith.previousChurchText),
      toNullableBoolean(faith.willingJoinChurch),
      toNullableBoolean(faith.willingContact),
      toNullableBoolean(faith.acceptedChrist),
      toNullableBoolean(faith.willingContinueGroup),
      toNullableBoolean(faith.willingBaptism),
      normalizeText(faith.prayerRequest),
      normalizeText(faith.feedback)
    ]
  );
}

async function upsertPastoralFamily(client, memberId, family) {
  await client.query(
    `INSERT INTO pastoral_member_family_notes (
       member_id, spouse_text, father_text, mother_text, children_text, updated_at
     ) VALUES ($1,$2,$3,$4,$5,now())
     ON CONFLICT (member_id) DO UPDATE SET
       spouse_text = EXCLUDED.spouse_text,
       father_text = EXCLUDED.father_text,
       mother_text = EXCLUDED.mother_text,
       children_text = EXCLUDED.children_text,
       updated_at = now()`,
    [
      memberId,
      normalizeText(family.spouseText),
      normalizeText(family.fatherText),
      normalizeText(family.motherText),
      normalizeText(family.childrenText)
    ]
  );
}

async function replaceCurrentPastoralGroup(client, memberId, groupId) {
  const current = await client.query(
    'SELECT group_id FROM pastoral_member_group_assignments WHERE member_id = $1 AND is_current LIMIT 1',
    [memberId]
  );
  if (current.rows[0] && Number(current.rows[0].group_id) === Number(groupId)) return;

  await retireCurrentPastoralGroup(client, memberId);
  if (!groupId) return;
  await client.query(
    `INSERT INTO pastoral_member_group_assignments (member_id, group_id, started_at, is_current)
     VALUES ($1, $2, CURRENT_DATE, true)
     ON CONFLICT (member_id, group_id, is_current) DO UPDATE SET
       ended_at = NULL,
       updated_at = now()`,
    [memberId, groupId]
  );
}

async function retireCurrentPastoralGroup(client, memberId) {
  const current = await client.query(
    'SELECT group_id FROM pastoral_member_group_assignments WHERE member_id = $1 AND is_current LIMIT 1',
    [memberId]
  );
  if (!current.rows[0]) return;
  const groupId = current.rows[0].group_id;

  await client.query(
    'DELETE FROM pastoral_member_group_assignments WHERE member_id = $1 AND group_id = $2 AND NOT is_current',
    [memberId, groupId]
  );
  await client.query(
    `UPDATE pastoral_member_group_assignments
     SET is_current = false, ended_at = COALESCE(ended_at, CURRENT_DATE), updated_at = now()
     WHERE member_id = $1 AND is_current`,
    [memberId]
  );
}

async function getPastoralMemberFiles(memberId) {
  const { rows } = await pool.query(
    `SELECT
       pmf.id,
       pmf.member_id,
       pmf.file_type,
       COALESCE(f.original_name, pmf.file_name) AS file_name,
       COALESCE(f.storage_path, pmf.storage_path) AS storage_path,
       COALESCE(f.mime_type, pmf.mime_type) AS mime_type,
       COALESCE(f.file_size, pmf.file_size)::bigint AS file_size,
       COALESCE(f.file_data, pmf.file_data) AS file_data,
       COALESCE(f.uploaded_at, pmf.uploaded_at) AS uploaded_at,
       pmf.file_id
     FROM pastoral_member_files pmf
     LEFT JOIN files f ON f.file_id = pmf.file_id AND NOT f.is_deleted
     WHERE pmf.member_id = $1
       AND pmf.file_type IN ('member_photo', 'newcomer_form_image')
     ORDER BY
       CASE pmf.file_type WHEN 'member_photo' THEN 1 ELSE 2 END,
       COALESCE(f.uploaded_at, pmf.uploaded_at) DESC`,
    [memberId]
  );
  return rows.map(toPastoralMemberFile);
}

async function savePastoralMemberImages(client, memberId, files, currentUser) {
  const entries = [
    ['member_photo', files.memberPhoto],
    ['newcomer_form_image', files.newcomerFormImage]
  ];

  for (const [fileType, value] of entries) {
    const image = normalizePastoralImage(value);
    if (!image) continue;
    const storagePath = `pastoral/members/${memberId}/${fileType}/${Date.now()}_${image.fileName}`;
    const fileId = await saveFileWithLink(client, {
      file: image,
      entityType: 'pastoral_member',
      entityId: String(memberId),
      fileType,
      storedName: `${memberId}_${fileType}_${Date.now()}_${image.fileName}`,
      storagePath,
      currentUser,
      uploadedByMemberId: memberId
    });
    await client.query(
      `INSERT INTO pastoral_member_files (
         member_id, file_type, file_name, storage_path, mime_type, file_size, file_data, file_id, uploaded_by_staff_id
       ) VALUES ($1,$2,$3,$4,$5,$6,NULL,$7,$8)`,
      [
        memberId,
        fileType,
        image.fileName,
        storagePath,
        image.mimeType,
        image.fileSize,
        fileId,
        currentUser && currentUser.staffId ? String(currentUser.staffId) : null
      ]
    );
  }
}

function normalizePastoralImage(value) {
  return normalizeFileInput(value, {
    defaultName: 'member-image',
    allowedMimeTypes: PASTORAL_IMAGE_MIME_TYPES,
    invalidMimeMessage: '會友圖片僅支援 JPG、PNG、WEBP、GIF',
    maxBytes: PASTORAL_IMAGE_MAX_BYTES,
    maxBytesMessage: '會友圖片不可超過 5MB'
  });
}

async function generatePastoralMemberId(client) {
  const { rows } = await client.query('SELECT COALESCE(max(id), 0)::int + 1 AS next_id FROM pastoral_members');
  return rows[0].next_id;
}

async function assertChurchWritable(churchId, currentUser) {
  if (hasAnyRole(currentUser, ['管理員', '超級管理者'])) return;
  const access = await getPastoralChurchAccess(currentUser);
  if (!access.churchIds.includes(Number(churchId))) {
    throw new Error('您沒有此會堂的牧養資料操作權限');
  }
}

function normalizeText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function normalizeDate(value) {
  const text = normalizeText(value);
  if (!text) return null;
  return text.slice(0, 10);
}

function toNullableInteger(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function toNullableBoolean(value) {
  if (value === true || value === 'true' || value === '是' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === '否' || value === 0 || value === '0') return false;
  return null;
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
    groupName: row.group_name || '',
    groupPath: row.group_path || '',
    lightStatus: formatLightStatus(row.light_status),
    faithStatus: formatFaithStatus(row),
    followupName: [row.followup_name, row.followup_position].filter(Boolean).join(' '),
    lineBound: Boolean(row.line_user_id)
  };
}

function toPastoralMemberDetail(row) {
  return {
    memberId: row.id,
    name: row.name,
    churchId: row.church_id,
    gender: formatGender(row.gender),
    genderValue: row.gender,
    birthday: formatDate(row.birthday),
    churchName: row.church_name || '',
    churchType: row.church_type || '',
    categoryCode: row.membership_category_code || '',
    categoryName: row.category_name || '',
    titleId: row.title_id,
    titleName: row.title_name || '',
    professionId: row.profession_id,
    professionName: row.profession_name || '',
    professionNote: row.profession_note || '',
    maritalStatusId: row.marital_status_id,
    maritalStatusName: row.marital_status_name || '',
    maritalNote: row.marital_note || '',
    sourceText: row.source_text || '',
    groupId: row.group_id,
    groupPath: row.group_path || '',
    mobilePhone: row.mobile_phone || '',
    homePhone: row.home_phone || '',
    officePhone: row.office_phone || '',
    email: row.email || '',
    preferredContactTime: row.preferred_contact_time || '',
    countryId: row.country_id,
    regionId: row.region_id,
    postalCode: row.postal_code || '',
    city: row.city || '',
    district: row.district || '',
    addressLine: row.address_line || '',
    address: [row.city, row.district, row.address_line].filter(Boolean).join(' '),
    referrerName: row.referrer_name || '',
    referrerPhone: row.referrer_phone || '',
    lineDisplayId: row.line_display_id || '',
    lineUserId: row.line_user_id || '',
    lineBound: Boolean(row.line_user_id),
    lightStatus: formatLightStatus(row.light_status),
    lightStatusValue: row.light_status,
    followupStaffId: row.followup_staff_id,
    createdDate: formatDate(row.created_date),
    isChristian: formatBoolean(row.is_christian),
    previousChurchId: row.previous_church_id,
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

function toPastoralEducationEnrollment(row) {
  return {
    enrollmentId: row.enrollment_id,
    courseId: row.course_id,
    courseName: row.course_name,
    categoryName: row.category_name,
    startDate: formatDate(row.start_date),
    endDate: formatDate(row.end_date),
    isCompleted: Boolean(row.is_completed),
    note: row.note || ''
  };
}

function toPastoralMemberFile(row) {
  return {
    fileId: row.id,
    sharedFileId: row.file_id || '',
    memberId: row.member_id,
    fileType: row.file_type,
    fileName: row.file_name,
    mimeType: row.mime_type || '',
    fileSize: Number(row.file_size || 0),
    uploadedAt: row.uploaded_at,
    dataUrl: toDataUrl(row)
  };
}

function assertPastoralReadable(user) {
  return assertFeatureReadable(user, 'pastoral');
}

function assertPastoralEditable(user) {
  return assertFeatureEditable(user, 'pastoral');
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

module.exports = { registerPastoralRoutes };
