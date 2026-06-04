const DOC_EXPORT_FOLDER_NAME = '卓越行道會專案文件';

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('卓越行道會行政系統')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function setApiConfig(apiBaseUrl, apiKey) {
  PropertiesService.getScriptProperties().setProperties({
    API_BASE_URL: String(apiBaseUrl || '').replace(/\/$/, ''),
    API_KEY: apiKey
  });
}

function setDocExportFolderId(folderId) {
  PropertiesService.getScriptProperties().setProperty('DOC_EXPORT_FOLDER_ID', folderId);
}

function login(email, deviceType) {
  return apiRequest('post', '/login', { email, deviceType });
}

function getInitialData() {
  return apiRequest('get', '/initial-data');
}

function getProjects(filters, currentUser) {
  filters = filters || {};
  return apiRequest('get', '/projects', null, {
    keyword: filters.keyword || '',
    projectType: filters.projectType || '',
    unit: filters.unit || ''
  }, currentUser);
}

function getProjectDetail(projectId, currentUser) {
  return apiRequest('post', '/projects/detail', { projectId, currentUser });
}

function getProjectMeetings(projectId, currentUser) {
  return apiRequest('get', `/projects/${encodeURIComponent(projectId)}/meetings`, null, null, currentUser);
}

function exportProjectDoc(projectId, currentUser) {
  if (!projectId) throw new Error('缺少專案編號');

  const detail = getProjectDetail(projectId, currentUser);
  const project = detail.project || {};
  const docName = `${project['計畫編號'] || projectId}_${project['專案名稱'] || '專案'}_專案文件`;
  const doc = DocumentApp.create(docName);
  const body = doc.getBody();

  body.setMarginTop(36);
  body.setMarginBottom(72);
  body.setMarginLeft(36);
  body.setMarginRight(36);

  body.appendParagraph('專案申請/執行資料')
    .setHeading(DocumentApp.ParagraphHeading.HEADING1)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph(`匯出時間：${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm')}`)
    .setAlignment(DocumentApp.HorizontalAlignment.RIGHT);

  appendSectionTitle(body, '一、基本資料');
  appendKeyValueTable(body, [
    ['計畫編號', project['計畫編號']],
    ['專案登入人', project['專案登入人']],
    ['專案名稱', project['專案名稱']],
    ['專案類型', project['專案類型']],
    ['執行期間', `${project['專案執行開始時間'] || ''} ~ ${project['專案執行結束時間'] || ''}`],
    ['執行單位', project['專案執行單位']],
    ['是否收費', project['專案是否收費']],
    ['專案狀態', project['專案狀態']],
    ['收支差額處理方式', project['收支差額處理方式']]
  ]);

  appendSectionTitle(body, '二、專案內容');
  appendHtmlLikeContent(body, project['專案內容']);

  appendSectionTitle(body, '三、專案人員');
  appendRowsTable(body, ['職責', '主責人', '主責項目', '備註'], detail.people || []);

  appendSectionTitle(body, '四、收入資料');
  appendRowsTable(body, ['會堂', '收入項目', '數量', '單價', '小計'], detail.income || []);

  appendSectionTitle(body, '五、支出資料');
  appendRowsTable(body, ['會堂', '支出項目', '數量', '單價', '小計'], detail.budget || []);

  appendSectionTitle(body, '六、收支摘要');
  appendKeyValueTable(body, [
    ['專案總收入', project['專案總收入']],
    ['專案總支出', project['專案總支出']],
    ['收支差額', Number(project['專案總收入'] || 0) - Number(project['專案總支出'] || 0)]
  ]);

  appendSectionTitle(body, '七、會議記錄');
  appendRowsTable(body, ['會議編號', '會議時間', '會議主題', '與會者', '會議狀態'], detail.meetings || []);

  appendApprovalFooter(body);

  doc.saveAndClose();
  moveDocToExportFolder(doc.getId());

  return {
    success: true,
    url: doc.getUrl(),
    documentId: doc.getId(),
    message: '已建立專案 Doc'
  };
}

function moveDocToExportFolder(documentId) {
  const folder = getDocExportFolder();
  const file = DriveApp.getFileById(documentId);
  file.moveTo(folder);
}

function getDocExportFolder() {
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty('DOC_EXPORT_FOLDER_ID');

  if (folderId) {
    return DriveApp.getFolderById(folderId);
  }

  const folders = DriveApp.getFoldersByName(DOC_EXPORT_FOLDER_NAME);
  if (!folders.hasNext()) {
    throw new Error(`找不到 DOC 輸出資料夾：${DOC_EXPORT_FOLDER_NAME}`);
  }

  const folder = folders.next();
  if (folders.hasNext()) {
    throw new Error(`找到多個同名 DOC 輸出資料夾，請設定 DOC_EXPORT_FOLDER_ID：${DOC_EXPORT_FOLDER_NAME}`);
  }

  return folder;
}

function saveProject(payload) {
  return apiRequest('post', '/projects', payload);
}

function getPurchases(filters) {
  filters = filters || {};
  return apiRequest('get', '/purchases', null, {
    keyword: filters.keyword || ''
  });
}

function getPurchaseDetail(purchaseId, currentUser) {
  return apiRequest('post', '/purchases/detail', { purchaseId, currentUser });
}

function exportPurchaseDoc(payload) {
  const purchaseId = payload.purchaseId;
  const docType = payload.docType;
  const docId = payload.docId || '';

  if (!purchaseId) throw new Error('缺少採購編號');

  const detail = getPurchaseDetail(purchaseId, payload.currentUser);
  const purchase = detail.purchase || {};
  const spec = buildPurchaseDocSpec(docType, docId, detail);
  const docName = `${purchaseId}_${spec.title}_${docId || purchase['採購摘要'] || '採購'}`;
  const doc = DocumentApp.create(docName);
  const body = doc.getBody();

  body.setMarginTop(36);
  body.setMarginBottom(72);
  body.setMarginLeft(36);
  body.setMarginRight(36);

  body.appendParagraph(spec.title)
    .setHeading(DocumentApp.ParagraphHeading.HEADING1)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph(`匯出時間：${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm')}`)
    .setAlignment(DocumentApp.HorizontalAlignment.RIGHT);

  spec.sections.forEach(section => {
    appendSectionTitle(body, section.title);
    if (section.type === 'keyValue') appendKeyValueTable(body, section.rows);
    if (section.type === 'rows') appendRowsTable(body, section.headers, section.rows);
  });

  appendApprovalFooter(body);

  doc.saveAndClose();
  moveDocToExportFolder(doc.getId());

  return {
    success: true,
    url: doc.getUrl(),
    documentId: doc.getId(),
    message: `已建立${spec.title} Doc`
  };
}

function buildPurchaseDocSpec(docType, docId, detail) {
  const purchase = detail.purchase || {};

  if (docType === 'purchase') {
    return {
      title: '採購申請單',
      sections: [
        {
          title: '一、採購基本資料',
          type: 'keyValue',
          rows: [
            ['採購編號', purchase['採購編號']],
            ['會堂', purchase['會堂']],
            ['部門', purchase['部門']],
            ['申請人', purchase['申請人']],
            ['申請日期', purchase['申請日期']],
            ['採購摘要', purchase['採購摘要']],
            ['請購狀態', purchase['請購狀態']],
            ['總計金額', purchase['總計金額']]
          ]
        },
        { title: '二、申請詳細原因', type: 'keyValue', rows: [['說明', purchase['申請詳細原因']]] },
        { title: '三、請購詳情', type: 'rows', headers: ['項目', '數量', '單價', '總價', '備註'], rows: detail.items || [] }
      ]
    };
  }

  if (docType === 'advance') {
    const advance = findDocRow(detail.advances, '預借編號', docId);
    return {
      title: '預借申請單',
      sections: [
        {
          title: '一、預借基本資料',
          type: 'keyValue',
          rows: [
            ['預借編號', advance['預借編號']],
            ['請購編號', advance['請購編號']],
            ['請款會堂', advance['請款會堂']],
            ['借款人', advance['借款人']],
            ['申請日期', advance['申請日期']],
            ['預借總金額', advance['預借總金額']],
            ['預計核銷日期', advance['預計核銷日期']]
          ]
        },
        { title: '二、預借詳情', type: 'rows', headers: ['項次', '事由', '金額', '備註/說明'], rows: advance.items || [] },
        {
          title: '三、支付方式',
          type: 'keyValue',
          rows: [
            ['支付方式', advance['支付方式']],
            ['匯款銀行', advance['匯款銀行']],
            ['分行', advance['分行']],
            ['帳戶名稱', advance['帳戶名稱']],
            ['帳號', advance['帳號']]
          ]
        }
      ]
    };
  }

  if (docType === 'expenseProof') {
    const proof = findDocRow(detail.expenseProofs, '支出證明編號', docId);
    return {
      title: '支出證明申請單',
      sections: [
        {
          title: '一、支出證明基本資料',
          type: 'keyValue',
          rows: [
            ['支出證明編號', proof['支出證明編號']],
            ['請購編號', proof['請購編號']],
            ['請款會堂', proof['請款會堂']],
            ['申請日期', proof['申請日期']],
            ['實付金額', proof['實付金額']],
            ['不能取得單據原因', proof['不能取得單據原因']]
          ]
        },
        {
          title: '二、受領人資料',
          type: 'keyValue',
          rows: [
            ['姓名', proof['姓名']],
            ['身分證字號', proof['身分證字號']],
            ['地址', proof['地址']]
          ]
        },
        { title: '三、支出證明詳情', type: 'rows', headers: ['項次', '項目', '費用'], rows: proof.items || [] }
      ]
    };
  }

  if (docType === 'payment') {
    const payment = findDocRow(detail.payments, '請款編號', docId);
    return {
      title: '請款申請單',
      sections: [
        {
          title: '一、請款基本資料',
          type: 'keyValue',
          rows: [
            ['請款編號', payment['請款編號']],
            ['請購編號', payment['請購編號']],
            ['請款會堂', payment['請款會堂']],
            ['請款人', payment['請款人']],
            ['申請日期', payment['申請日期']],
            ['請款總金額', payment['請款總金額']]
          ]
        },
        { title: '二、請款詳細內容', type: 'rows', headers: ['項目', '數量', '單價', '總價', '備註'], rows: payment.items || [] },
        {
          title: '三、支付方式',
          type: 'keyValue',
          rows: [
            ['是否有預借', payment['是否有預借']],
            ['支付方式', payment['支付方式']],
            ['預借編號', payment['預借編號']],
            ['前已預借金額', payment['前已預借金額']],
            ['轉正', payment['轉正']],
            ['代支', payment['代支']],
            ['繳回', payment['繳回']],
            ['匯款銀行', payment['匯款銀行']],
            ['分行', payment['分行']],
            ['帳戶名稱', payment['帳戶名稱']],
            ['帳號', payment['帳號']]
          ]
        }
      ]
    };
  }

  throw new Error('未知的採購單據類型');
}

function findDocRow(rows, key, value) {
  const row = (rows || []).find(item => String(item[key]) === String(value));
  if (!row) throw new Error(`找不到單據資料：${value}`);
  return row;
}

function savePurchase(payload) {
  return apiRequest('post', '/purchases', payload);
}

function closePurchase(payload) {
  return apiRequest(
    'patch',
    `/purchases/${encodeURIComponent(payload.purchaseId)}/close`,
    { currentUser: payload.currentUser }
  );
}

function addPurchaseAdvance(payload) {
  return apiRequest(
    'post',
    `/purchases/${encodeURIComponent(payload.purchaseId)}/advances`,
    payload
  );
}

function addPurchaseExpenseProof(payload) {
  return apiRequest(
    'post',
    `/purchases/${encodeURIComponent(payload.purchaseId)}/expense-proofs`,
    payload
  );
}

function addPurchasePaymentRequest(payload) {
  return apiRequest(
    'post',
    `/purchases/${encodeURIComponent(payload.purchaseId)}/payment-requests`,
    payload
  );
}

function addProjectPermission(payload) {
  return apiRequest(
    'post',
    `/projects/${encodeURIComponent(payload.projectId)}/permissions`,
    payload
  );
}

function deleteProjectPermission(payload) {
  return apiRequest(
    'delete',
    `/projects/${encodeURIComponent(payload.projectId)}/permissions/${encodeURIComponent(payload.staffId)}`,
    null,
    null,
    payload.currentUser
  );
}

function addMeeting(payload) {
  return apiRequest('post', '/meetings', payload);
}

function updateMeeting(payload) {
  return apiRequest(
    'put',
    `/projects/${encodeURIComponent(payload.projectId)}/meetings/${encodeURIComponent(payload.meetingId)}`,
    payload
  );
}

function cancelMeeting(payload) {
  return updateMeetingStatus(payload, '取消');
}

function completeMeeting(payload) {
  return updateMeetingStatus(payload, '完成');
}

function updateMeetingStatus(payload, status) {
  return apiRequest(
    'patch',
    `/projects/${encodeURIComponent(payload.projectId)}/meetings/${encodeURIComponent(payload.meetingId)}/status`,
    { currentUser: payload.currentUser, status }
  );
}

function getParameterItems(type, currentUser) {
  return apiRequest('get', `/params/${encodeURIComponent(type)}`, null, null, currentUser);
}

function addParameterItem(payload) {
  return apiRequest('post', `/params/${encodeURIComponent(payload.type)}`, payload);
}

function updateParameterItem(payload) {
  return apiRequest('put', `/params/${encodeURIComponent(payload.type)}`, payload);
}

function deleteParameterItem(payload) {
  return apiRequest(
    'delete',
    `/params/${encodeURIComponent(payload.type)}/${encodeURIComponent(payload.value)}`,
    null,
    null,
    payload.currentUser
  );
}

function sendMeetingInvite(payload) {
  const detail = getProjectDetail(payload.projectId, payload.currentUser);
  const meeting = (detail.meetings || []).find(row => String(row['會議編號']) === String(payload.meetingId));
  if (!meeting) throw new Error('找不到會議資料');

  const accounts = getInitialData().accounts || [];
  const emails = resolveAttendeeEmailsFromAccounts(meeting['與會者'], accounts);
  if (!emails.length) throw new Error('找不到可寄送的與會者信箱');

  const projectName = detail.project ? detail.project['專案名稱'] : '';
  MailApp.sendEmail({
    to: emails.join(','),
    subject: `會議邀請：${projectName}｜${meeting['會議主題']}`,
    body:
`您好：

邀請您參加以下會議。

專案名稱：${projectName}
會議主題：${meeting['會議主題']}
會議時間：${meeting['會議時間']}

討論議題：
${meeting['討論議題'] || ''}

與會者：
${String(meeting['與會者'] || '').split(',').map(name => `- ${name.trim()}`).join('\n')}`
  });

  return { success: true, message: '會議邀請已寄送' };
}

function apiRequest(method, path, body, query, currentUser) {
  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty('API_BASE_URL');
  const apiKey = props.getProperty('API_KEY');

  if (!baseUrl || !apiKey) {
    throw new Error('尚未設定 API_BASE_URL / API_KEY，請先執行 setApiConfig。');
  }

  const url = baseUrl + path + buildQuery(query);
  const headers = {
    'x-api-key': apiKey,
    'Content-Type': 'application/json'
  };

  if (currentUser) {
    headers['x-current-user'] = Utilities.base64EncodeWebSafe(JSON.stringify(currentUser));
  }

  const options = {
    method,
    headers,
    muteHttpExceptions: true
  };

  if (body !== null && body !== undefined) {
    options.payload = JSON.stringify(body);
  }

  const response = UrlFetchApp.fetch(url, options);
  const text = response.getContentText();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch (err) {
    throw new Error(
      `API 回傳不是 JSON。請確認 API_BASE_URL 是否指向 API 根網址。URL: ${url}，HTTP: ${response.getResponseCode()}，回傳前 300 字: ${text.slice(0, 300)}`
    );
  }

  if (response.getResponseCode() >= 300) {
    throw new Error(data.error || text || `API 錯誤：${response.getResponseCode()}`);
  }

  return data;
}

function buildQuery(query) {
  if (!query) return '';
  const parts = Object.keys(query)
    .filter(key => query[key] !== null && query[key] !== undefined && query[key] !== '')
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

function resolveAttendeeEmailsFromAccounts(attendeesText, accounts) {
  const names = String(attendeesText || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);

  const emails = [];
  names.forEach(name => {
    if (name.indexOf('@') >= 0) {
      emails.push(name);
      return;
    }

    const account = accounts.find(a => String(a.name).trim() === name);
    if (account && account.email) emails.push(account.email);
  });

  return [...new Set(emails)];
}

function appendSectionTitle(body, text) {
  body.appendParagraph(text)
    .setHeading(DocumentApp.ParagraphHeading.HEADING2)
    .setSpacingBefore(12)
    .setSpacingAfter(6);
}

function appendKeyValueTable(body, rows) {
  const table = body.appendTable(rows.map(row => [
    toDocText(row[0]),
    toDocText(row[1])
  ]));

  for (let i = 0; i < table.getNumRows(); i += 1) {
    const row = table.getRow(i);
    row.getCell(0).setBackgroundColor('#f1f3f5').setWidth(120);
    row.getCell(0).editAsText().setBold(true);
  }

  body.appendParagraph('');
}

function appendRowsTable(body, headers, rows) {
  const values = [headers].concat(
    rows.length
      ? rows.map(row => headers.map(header => toDocText(row[header])))
      : [headers.map(() => '')]
  );

  const table = body.appendTable(values);
  const headerRow = table.getRow(0);

  for (let i = 0; i < headerRow.getNumCells(); i += 1) {
    headerRow.getCell(i).setBackgroundColor('#f1f3f5');
    headerRow.getCell(i).editAsText().setBold(true);
  }

  body.appendParagraph('');
}

function appendHtmlLikeContent(body, html) {
  const content = String(html || '').trim();
  if (!content) {
    body.appendParagraph(' ');
    return;
  }

  const tableRegex = /<table[\s\S]*?<\/table>/gi;
  let lastIndex = 0;
  let matched = false;
  let match;

  while ((match = tableRegex.exec(content)) !== null) {
    appendHtmlTextBlock(body, content.slice(lastIndex, match.index));
    appendHtmlTable(body, match[0]);
    lastIndex = match.index + match[0].length;
    matched = true;
  }

  appendHtmlTextBlock(body, content.slice(lastIndex));

  if (!matched && !stripHtmlForDoc(content)) {
    body.appendParagraph(' ');
  }

  body.appendParagraph('');
}

function appendHtmlTextBlock(body, html) {
  const lines = htmlToLines(html);
  lines.forEach(line => body.appendParagraph(line || ' '));
}

function appendHtmlTable(body, tableHtml) {
  const rows = [];
  const rowMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  rowMatches.forEach(rowHtml => {
    const cells = [];
    const cellMatches = rowHtml.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || [];
    cellMatches.forEach(cellHtml => {
      cells.push(stripHtmlForDoc(cellHtml));
    });
    if (cells.length) rows.push(cells);
  });

  if (!rows.length) return;

  body.appendTable(rows);
  body.appendParagraph('');
}

function htmlToLines(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .split(/\n+/)
    .map(line => stripHtmlForDoc(line))
    .filter(line => line !== '');
}

function stripHtmlForDoc(value) {
  return decodeDocEntities(String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim());
}

function decodeDocEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function appendApprovalFooter(body) {
  body.appendParagraph('');
  body.appendParagraph('');

  const table = body.appendTable([
    ['主任牧師/決行', '複核', '財務', '部門主管/申請人'],
    ['', '', '', '']
  ]);

  for (let i = 0; i < 4; i += 1) {
    table.getRow(0).getCell(i).setBackgroundColor('#f1f3f5');
    table.getRow(0).getCell(i).editAsText().setBold(true);
    table.getRow(1).getCell(i).setText('\n\n');
  }
}

function toDocText(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}
