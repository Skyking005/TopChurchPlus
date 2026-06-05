const { pool, tx } = require('../../db');
const { recordDomainEvent } = require('../../shared/cross-system');
const { assertFeatureEditable, assertFeatureReadable } = require('../../shared/permissions');
const { parseUser } = require('../../shared/users');

const QUESTION_TYPES_WITH_OPTIONS = new Set(['single_choice', 'multiple_choice', 'dropdown']);

function registerFormsRoutes(app) {
  app.get('/forms', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'forms');
      res.json(await getForms(req.query));
    } catch (err) {
      next(err);
    }
  });

  app.get('/forms/:formId', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'forms');
      res.json(await getFormDetail(req.params.formId));
    } catch (err) {
      next(err);
    }
  });

  app.post('/forms', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'forms');
      res.json(await saveForm(null, req.body.form || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.put('/forms/:formId', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureEditable(currentUser, 'forms');
      res.json(await saveForm(req.params.formId, req.body.form || {}, currentUser));
    } catch (err) {
      next(err);
    }
  });

  app.delete('/forms/:formId', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureEditable(currentUser, 'forms');
      const result = await pool.query('UPDATE forms SET status = $1, updated_at = now() WHERE form_id = $2', ['archived', req.params.formId]);
      if (!result.rowCount) throw new Error('找不到表單資料');
      await recordDomainEvent({
        eventType: 'forms.form_archived',
        systemKey: 'forms',
        entityType: 'form',
        entityId: req.params.formId,
        currentUser
      });
      res.json({ success: true, message: '表單已封存' });
    } catch (err) {
      next(err);
    }
  });
}

async function getForms(query) {
  const keyword = String(query.keyword || '').trim().toLowerCase();
  const status = String(query.status || '').trim();
  const where = [];
  const values = [];

  if (keyword) {
    values.push(`%${keyword}%`);
    where.push(`(lower(f.title) LIKE $${values.length} OR lower(coalesce(f.description, '')) LIKE $${values.length})`);
  }
  if (status) {
    values.push(status);
    where.push(`f.status = $${values.length}`);
  } else {
    where.push(`f.status <> 'archived'`);
  }

  const { rows } = await pool.query(
    `SELECT f.*, a.name AS created_by_name, a.position AS created_by_position,
            count(q.question_id)::int AS question_count
     FROM forms f
     LEFT JOIN accounts a ON a.staff_id = f.created_by_staff_id
     LEFT JOIN form_questions q ON q.form_id = f.form_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     GROUP BY f.form_id, a.name, a.position
     ORDER BY f.updated_at DESC, f.created_at DESC`,
    values
  );

  return rows.map(toFormListItem);
}

async function getFormDetail(formId) {
  const { rows } = await pool.query('SELECT * FROM forms WHERE form_id = $1', [formId]);
  const form = rows[0];
  if (!form) throw new Error('找不到表單資料');

  const questionsResult = await pool.query(
    `SELECT *
     FROM form_questions
     WHERE form_id = $1
     ORDER BY sort_order, question_id`,
    [formId]
  );
  const questionIds = questionsResult.rows.map(row => row.question_id);
  const options = questionIds.length
    ? await pool.query(
        `SELECT *
         FROM form_question_options
         WHERE question_id = ANY($1::uuid[])
         ORDER BY question_id, sort_order, option_id`,
        [questionIds]
      )
    : { rows: [] };

  return {
    form: toFormDetail(form),
    questions: questionsResult.rows.map(row => toQuestion(row, options.rows.filter(option => option.question_id === row.question_id)))
  };
}

async function saveForm(formId, payload, currentUser) {
  const normalized = normalizeFormPayload(payload);

  return tx(async client => {
    const isNew = !formId;
    const result = await client.query(
      `INSERT INTO forms (
         form_id, form_code, title, description, status, visibility,
         allow_multiple_responses, require_login, created_by_staff_id, updated_by_staff_id, updated_at
       ) VALUES (COALESCE($1::uuid, gen_random_uuid()), $2,$3,$4,$5,$6,$7,$8,$9,$9,now())
       ON CONFLICT (form_id) DO UPDATE SET
         form_code = EXCLUDED.form_code,
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         status = EXCLUDED.status,
         visibility = EXCLUDED.visibility,
         allow_multiple_responses = EXCLUDED.allow_multiple_responses,
         require_login = EXCLUDED.require_login,
         updated_by_staff_id = EXCLUDED.updated_by_staff_id,
         updated_at = now()
       RETURNING form_id`,
      [
        formId || null,
        normalized.formCode,
        normalized.title,
        normalized.description,
        normalized.status,
        normalized.visibility,
        normalized.allowMultipleResponses,
        normalized.requireLogin,
        currentUser.staffId ? String(currentUser.staffId) : null
      ]
    );

    const savedFormId = result.rows[0].form_id;
    await replaceQuestions(client, savedFormId, normalized.questions);
    await recordDomainEvent({
      eventType: isNew ? 'forms.form_created' : 'forms.form_updated',
      systemKey: 'forms',
      entityType: 'form',
      entityId: savedFormId,
      payload: { title: normalized.title, questionCount: normalized.questions.length },
      currentUser
    }, client);

    return { success: true, formId: savedFormId, message: isNew ? '表單已建立' : '表單已儲存' };
  });
}

async function replaceQuestions(client, formId, questions) {
  await client.query('DELETE FROM form_questions WHERE form_id = $1', [formId]);
  for (let i = 0; i < questions.length; i += 1) {
    const question = questions[i];
    const questionResult = await client.query(
      `INSERT INTO form_questions (
         form_id, question_type, title, description, is_required, sort_order, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       RETURNING question_id`,
      [
        formId,
        question.questionType,
        question.title,
        question.description,
        question.isRequired,
        i + 1,
        JSON.stringify(question.metadata || {})
      ]
    );
    const questionId = questionResult.rows[0].question_id;
    if (QUESTION_TYPES_WITH_OPTIONS.has(question.questionType)) {
      for (let j = 0; j < question.options.length; j += 1) {
        await client.query(
          `INSERT INTO form_question_options (question_id, option_label, option_value, sort_order)
           VALUES ($1,$2,$3,$4)`,
          [questionId, question.options[j], question.options[j], j + 1]
        );
      }
    }
  }
}

function normalizeFormPayload(payload) {
  const title = normalizeText(payload.title);
  if (!title) throw new Error('請填寫表單標題');
  const questions = Array.isArray(payload.questions) ? payload.questions.map(normalizeQuestion).filter(Boolean) : [];
  if (!questions.length) throw new Error('請至少新增一題');

  return {
    formCode: normalizeText(payload.formCode),
    title,
    description: normalizeText(payload.description),
    status: ['draft', 'published', 'closed'].includes(payload.status) ? payload.status : 'draft',
    visibility: ['internal', 'public', 'members'].includes(payload.visibility) ? payload.visibility : 'internal',
    allowMultipleResponses: payload.allowMultipleResponses !== false,
    requireLogin: payload.requireLogin !== false,
    questions
  };
}

function normalizeQuestion(question) {
  const title = normalizeText(question.title);
  if (!title) return null;
  const questionType = normalizeQuestionType(question.questionType || question.type);
  let options = Array.isArray(question.options)
    ? question.options.map(normalizeText).filter(Boolean)
    : [];
  if (QUESTION_TYPES_WITH_OPTIONS.has(questionType) && !options.length) {
    options = ['選項 1'];
  }
  return {
    questionType,
    title,
    description: normalizeText(question.description),
    isRequired: Boolean(question.isRequired || question.required),
    options,
    metadata: question.metadata && typeof question.metadata === 'object' ? question.metadata : {}
  };
}

function normalizeQuestionType(value) {
  const allowed = ['short_text', 'paragraph', 'single_choice', 'multiple_choice', 'dropdown', 'date', 'number'];
  return allowed.includes(value) ? value : 'short_text';
}

function toFormListItem(row) {
  return {
    formId: row.form_id,
    formCode: row.form_code,
    title: row.title,
    description: row.description,
    status: row.status,
    visibility: row.visibility,
    questionCount: row.question_count || 0,
    createdBy: [row.created_by_name, row.created_by_position].filter(Boolean).join(' '),
    updatedAt: row.updated_at
  };
}

function toFormDetail(row) {
  return {
    formId: row.form_id,
    formCode: row.form_code,
    title: row.title,
    description: row.description,
    status: row.status,
    visibility: row.visibility,
    allowMultipleResponses: row.allow_multiple_responses,
    requireLogin: row.require_login
  };
}

function toQuestion(row, options) {
  return {
    questionId: row.question_id,
    questionType: row.question_type,
    title: row.title,
    description: row.description,
    isRequired: row.is_required,
    sortOrder: row.sort_order,
    metadata: row.metadata || {},
    options: options.map(option => option.option_label)
  };
}

function normalizeText(value) {
  const text = String(value || '').trim();
  return text || null;
}

module.exports = { registerFormsRoutes };
