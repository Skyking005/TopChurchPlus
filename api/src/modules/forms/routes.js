const { pool, tx } = require('../../db');
const { recordDomainEvent } = require('../../shared/cross-system');
const { assertFeatureEditable, assertFeatureReadable } = require('../../shared/permissions');
const { parseUser } = require('../../shared/users');

const QUESTION_TYPES_WITH_OPTIONS = new Set(['single_choice', 'multiple_choice', 'dropdown']);
const FORM_TYPES = new Set(['survey', 'event_registration', 'general']);

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

  app.get('/forms/:formId/responses', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'forms');
      res.json(await getFormResponses(req.params.formId));
    } catch (err) {
      next(err);
    }
  });

  app.post('/forms/:formId/responses', async (req, res, next) => {
    try {
      const currentUser = req.body.currentUser || {};
      await assertFeatureReadable(currentUser, 'forms');
      res.json(await submitFormResponse(req.params.formId, req.body.response || {}, currentUser));
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
            count(DISTINCT q.question_id)::int AS question_count,
            count(DISTINCT r.response_id)::int AS response_count
     FROM forms f
     LEFT JOIN accounts a ON a.staff_id = f.created_by_staff_id
     LEFT JOIN form_questions q ON q.form_id = f.form_id
     LEFT JOIN form_responses r ON r.form_id = f.form_id
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

async function getFormResponses(formId) {
  const { rows } = await pool.query(
    `SELECT r.*, ct.transaction_code, ct.status AS counter_status, ct.payment_method,
            ct.received_at, ct.received_by_staff_id
     FROM form_responses r
     LEFT JOIN counter_transactions ct ON ct.transaction_id = r.counter_transaction_id
     WHERE r.form_id = $1
     ORDER BY r.submitted_at DESC`,
    [formId]
  );
  if (!rows.length) return [];

  const responseIds = rows.map(row => row.response_id);
  const answers = await pool.query(
    `SELECT a.*, q.title AS question_title, q.question_type
     FROM form_response_answers a
     JOIN form_questions q ON q.question_id = a.question_id
     WHERE a.response_id = ANY($1::uuid[])
     ORDER BY q.sort_order, q.question_id`,
    [responseIds]
  );

  return rows.map(row => ({
    responseId: row.response_id,
    respondentName: row.respondent_name,
    submittedAt: row.submitted_at,
    paymentStatus: row.payment_status,
    paymentAmount: Number(row.payment_amount || 0),
    counterTransactionId: row.counter_transaction_id,
    counterTransactionCode: row.transaction_code,
    counterStatus: row.counter_status,
    answers: answers.rows
      .filter(answer => answer.response_id === row.response_id)
      .map(answer => ({
        questionId: answer.question_id,
        questionTitle: answer.question_title,
        questionType: answer.question_type,
        value: answer.answer_json || answer.answer_text || ''
      }))
  }));
}

async function saveForm(formId, payload, currentUser) {
  const normalized = normalizeFormPayload(payload);

  return tx(async client => {
    const isNew = !formId;
    const result = await client.query(
      `INSERT INTO forms (
         form_id, form_code, title, description, form_type, status, visibility,
         allow_multiple_responses, require_login, has_fee, fee_title, fee_amount,
         payment_description, counter_service_type, created_by_staff_id, updated_by_staff_id, updated_at
       ) VALUES (COALESCE($1::uuid, gen_random_uuid()), $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15,now())
       ON CONFLICT (form_id) DO UPDATE SET
         form_code = EXCLUDED.form_code,
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         form_type = EXCLUDED.form_type,
         status = EXCLUDED.status,
         visibility = EXCLUDED.visibility,
         allow_multiple_responses = EXCLUDED.allow_multiple_responses,
         require_login = EXCLUDED.require_login,
         has_fee = EXCLUDED.has_fee,
         fee_title = EXCLUDED.fee_title,
         fee_amount = EXCLUDED.fee_amount,
         payment_description = EXCLUDED.payment_description,
         counter_service_type = EXCLUDED.counter_service_type,
         updated_by_staff_id = EXCLUDED.updated_by_staff_id,
         updated_at = now()
       RETURNING form_id`,
      [
        formId || null,
        normalized.formCode,
        normalized.title,
        normalized.description,
        normalized.formType,
        normalized.status,
        normalized.visibility,
        normalized.allowMultipleResponses,
        normalized.requireLogin,
        normalized.hasFee,
        normalized.feeTitle,
        normalized.feeAmount,
        normalized.paymentDescription,
        normalized.counterServiceType,
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

async function submitFormResponse(formId, payload, currentUser) {
  const detail = await getFormDetail(formId);
  const form = detail.form;
  if (form.status === 'closed' || form.status === 'archived') throw new Error('此表單已關閉，無法填寫');
  if (form.requireLogin && (!currentUser || !currentUser.name)) throw new Error('此表單需要登入後才能填寫');

  const answers = normalizeResponseAnswers(payload.answers || [], detail.questions);
  const respondentName = normalizeText(payload.respondentName) || currentUser.name || '';

  return tx(async client => {
    let counterTransactionId = null;
    const paymentStatus = form.hasFee ? 'pending' : 'none';
    const paymentAmount = form.hasFee ? Number(form.feeAmount || 0) : 0;

    const responseResult = await client.query(
      `INSERT INTO form_responses (
         form_id, respondent_staff_id, respondent_name, payment_status, payment_amount, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb)
       RETURNING response_id`,
      [
        formId,
        currentUser && currentUser.staffId ? String(currentUser.staffId) : null,
        respondentName,
        paymentStatus,
        paymentAmount,
        JSON.stringify(payload.metadata || {})
      ]
    );
    const responseId = responseResult.rows[0].response_id;

    for (const answer of answers) {
      await client.query(
        `INSERT INTO form_response_answers (response_id, question_id, answer_text, answer_json)
         VALUES ($1,$2,$3,$4::jsonb)`,
        [
          responseId,
          answer.questionId,
          answer.answerText,
          answer.answerJson ? JSON.stringify(answer.answerJson) : null
        ]
      );
    }

    if (form.hasFee) {
      const transactionCode = await generateCounterTransactionCode(client);
      const transaction = await client.query(
        `INSERT INTO counter_transactions (
           transaction_code, business_type, source_system, source_type, source_id,
           payer_name, payer_staff_id, amount, status, note, metadata
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
         RETURNING transaction_id`,
        [
          transactionCode,
          form.counterServiceType || 'payment',
          'forms',
          'form_response',
          responseId,
          respondentName,
          currentUser && currentUser.staffId ? String(currentUser.staffId) : null,
          paymentAmount,
          'pending',
          form.paymentDescription || form.feeTitle || form.title,
          JSON.stringify({ formId, formTitle: form.title, feeTitle: form.feeTitle })
        ]
      );
      counterTransactionId = transaction.rows[0].transaction_id;
      await client.query(
        'UPDATE form_responses SET counter_transaction_id = $1 WHERE response_id = $2',
        [counterTransactionId, responseId]
      );
    }

    await recordDomainEvent({
      eventType: 'forms.response_submitted',
      systemKey: 'forms',
      entityType: 'form_response',
      entityId: responseId,
      payload: { formId, hasFee: form.hasFee, paymentAmount },
      currentUser
    }, client);

    return {
      success: true,
      responseId,
      counterTransactionId,
      paymentStatus,
      paymentAmount,
      message: form.hasFee ? '表單已送出，已建立櫃台待繳費紀錄' : '表單已送出'
    };
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

function normalizeResponseAnswers(rawAnswers, questions) {
  const byQuestionId = new Map();
  rawAnswers.forEach(answer => {
    if (answer && answer.questionId) byQuestionId.set(String(answer.questionId), answer.value);
  });

  return questions.map(question => {
    const value = byQuestionId.get(String(question.questionId));
    const isEmpty = Array.isArray(value) ? !value.length : !String(value || '').trim();
    if (question.isRequired && isEmpty) throw new Error(`請填寫必填題：${question.title}`);
    if (isEmpty) return null;
    const isJson = Array.isArray(value) || (value && typeof value === 'object');
    return {
      questionId: question.questionId,
      answerText: isJson ? null : String(value),
      answerJson: isJson ? value : null
    };
  }).filter(Boolean);
}

async function generateCounterTransactionCode(client) {
  const now = new Date();
  const prefix = `CT${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const { rows } = await client.query(
    `SELECT transaction_code
     FROM counter_transactions
     WHERE transaction_code LIKE $1
     ORDER BY transaction_code DESC
     LIMIT 1`,
    [`${prefix}%`]
  );
  const next = rows[0] ? Number(String(rows[0].transaction_code).slice(-4)) + 1 : 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

function normalizeFormPayload(payload) {
  const title = normalizeText(payload.title);
  if (!title) throw new Error('請填寫表單標題');
  const questions = Array.isArray(payload.questions) ? payload.questions.map(normalizeQuestion).filter(Boolean) : [];
  if (!questions.length) throw new Error('請至少新增一題');
  const hasFee = Boolean(payload.hasFee);
  const feeAmount = hasFee ? Number(payload.feeAmount || 0) : 0;
  if (hasFee && feeAmount <= 0) throw new Error('收費表單請填寫大於 0 的金額');

  return {
    formCode: normalizeText(payload.formCode),
    title,
    description: normalizeText(payload.description),
    formType: FORM_TYPES.has(payload.formType) ? payload.formType : 'survey',
    status: ['draft', 'published', 'closed'].includes(payload.status) ? payload.status : 'draft',
    visibility: ['internal', 'public', 'members'].includes(payload.visibility) ? payload.visibility : 'internal',
    allowMultipleResponses: payload.allowMultipleResponses !== false,
    requireLogin: payload.requireLogin !== false,
    hasFee,
    feeTitle: normalizeText(payload.feeTitle),
    feeAmount,
    paymentDescription: normalizeText(payload.paymentDescription),
    counterServiceType: 'payment',
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
    formType: row.form_type || 'survey',
    status: row.status,
    visibility: row.visibility,
    hasFee: Boolean(row.has_fee),
    feeTitle: row.fee_title,
    feeAmount: Number(row.fee_amount || 0),
    paymentDescription: row.payment_description,
    counterServiceType: row.counter_service_type || 'payment',
    questionCount: row.question_count || 0,
    responseCount: row.response_count || 0,
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
    formType: row.form_type || 'survey',
    status: row.status,
    visibility: row.visibility,
    allowMultipleResponses: row.allow_multiple_responses,
    requireLogin: row.require_login,
    hasFee: Boolean(row.has_fee),
    feeTitle: row.fee_title,
    feeAmount: Number(row.fee_amount || 0),
    paymentDescription: row.payment_description,
    counterServiceType: row.counter_service_type || 'payment'
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
