function doGet(e) {
  const shortCode = e && e.parameter ? String(e.parameter.s || e.parameter.short || '') : '';
  if (shortCode) {
    return renderShortLinkRedirect_(shortCode);
  }
  return renderIndex_(e && e.parameter ? e.parameter : {});
}

function renderIndex_(params) {
  const template = HtmlService.createTemplateFromFile('Index');
  template.publicFormId = String(params.form || params.publicForm || '');
  template.publicResponseId = String(params.response || '');
  template.publicEditToken = String(params.token || '');
  return template
    .evaluate()
    .setTitle('卓越行道會行政系統')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function renderShortLinkRedirect_(shortCode) {
  try {
    const result = resolveShortLink(shortCode);
    const targetUrl = result.targetUrl || '';
    if (!targetUrl) throw new Error('短連結沒有目的網址');
    const publicParams = extractPublicFormParamsFromUrl_(targetUrl);
    if (publicParams.form || publicParams.publicForm) {
      return renderIndex_(publicParams);
    }
    return HtmlService.createHtmlOutput(
      `<!DOCTYPE html><html><head><base target="_top"><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="0;url=${escapeHtmlForOutput_(targetUrl)}"><title>正在開啟連結</title><style>body{font-family:Arial,"Microsoft JhengHei",sans-serif;padding:32px;color:#1f2937}.box{max-width:640px;margin:auto;border:1px solid #e5e7eb;border-radius:8px;padding:24px;background:#fff}.btn{display:inline-block;margin-top:12px;padding:10px 14px;border-radius:6px;background:#2563eb;color:#fff;text-decoration:none}</style></head><body><div class="box"><p>正在開啟連結...</p><a class="btn" href="${escapeHtmlForOutput_(targetUrl)}" target="_top">如果沒有自動開啟，請點此進入</a></div><script>try{window.top.location.href=${JSON.stringify(targetUrl)};}catch(e){window.location.href=${JSON.stringify(targetUrl)};}</script></body></html>`
    ).setTitle('正在開啟連結');
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    const isExpired = message.indexOf('已過期') >= 0 || message.indexOf('過期') >= 0;
    const title = isExpired ? '短連結已過期' : '短連結無法開啟';
    return HtmlService.createHtmlOutput(
      `<!DOCTYPE html><html><head><base target="_top"><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtmlForOutput_(title)}</title><style>body{font-family:Arial,"Microsoft JhengHei",sans-serif;padding:32px;color:#1f2937}.box{max-width:640px;margin:auto;border:1px solid #e5e7eb;border-radius:8px;padding:24px;background:#fff}.hint{color:#6b7280}</style></head><body><div class="box"><h3>${escapeHtmlForOutput_(title)}</h3><p>${escapeHtmlForOutput_(message)}</p><p class="hint">如需重新開啟，請洽表單或系統管理同工。</p></div></body></html>`
    ).setTitle(title);
  }
}

function extractPublicFormParamsFromUrl_(targetUrl) {
  const result = {};
  String(targetUrl || '').replace(/[?&]([^=&#]+)=([^&#]*)/g, (_, key, value) => {
    result[decodeURIComponent(key)] = decodeURIComponent(String(value || '').replace(/\+/g, ' '));
    return '';
  });
  return result;
}

function escapeHtmlForOutput_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

function login(email, deviceType, deviceInfo) {
  const payload = Object.assign({ email, deviceType }, deviceInfo || {});
  const result = apiRequest('post', '/login', payload);
  if (result.requiresVerification && result.verificationCode) {
    sendLoginVerificationEmail(result.email || email, result.verificationCode, result.expiresAt);
    delete result.verificationCode;
  }
  return result;
}

function verifyLogin(payload) {
  return apiRequest('post', '/login/verify', payload);
}

function loginCounterPin(pinCode, operatorName, deviceInfo) {
  const payload = Object.assign({ pinCode, operatorName }, deviceInfo || {});
  return apiRequest('post', '/counter/pin-login', payload);
}

function sendLoginVerificationEmail(email, code, expiresAt) {
  const expiresText = expiresAt
    ? Utilities.formatDate(new Date(expiresAt), Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm')
    : '10 分鐘內';
  MailApp.sendEmail({
    to: email,
    subject: '卓越行道會行政系統登入驗證碼',
    body:
`您好：

系統偵測到陌生裝置登入卓越行道會行政系統。

本次登入驗證碼：${code}
有效期限：${expiresText}

如果這不是您本人操作，請立即通知系統管理員。`
  });
}

function getInitialData() {
  return apiRequest('get', '/initial-data');
}

function getPastoralOptions(currentUser) {
  return apiRequest('get', '/pastoral/options', null, null, currentUser);
}

function getPastoralMembers(filters, currentUser) {
  filters = filters || {};
  return apiRequest('get', '/pastoral/members', null, {
    keyword: filters.keyword || '',
    category: filters.category || '',
    churchId: filters.churchId || '',
    groupId: filters.groupId || '',
    page: filters.page || 1,
    pageSize: filters.pageSize || 20
  }, currentUser);
}

function getPastoralMemberDetail(memberId, currentUser) {
  return apiRequest('get', `/pastoral/members/${encodeURIComponent(memberId)}`, null, null, currentUser);
}

function checkPastoralMemberDuplicateName(payload) {
  return apiRequest('get', '/pastoral/members/duplicate-name', null, {
    name: payload.name || '',
    excludeMemberId: payload.excludeMemberId || ''
  }, payload.currentUser);
}

function savePastoralMember(payload) {
  const memberId = payload.memberId || payload.member?.memberId || '';
  if (memberId) {
    return apiRequest(
      'put',
      `/pastoral/members/${encodeURIComponent(memberId)}`,
      { currentUser: payload.currentUser, member: payload.member }
    );
  }
  return apiRequest('post', '/pastoral/members', {
    currentUser: payload.currentUser,
    member: payload.member
  });
}

function deletePastoralMember(payload) {
  return apiRequest(
    'delete',
    `/pastoral/members/${encodeURIComponent(payload.memberId)}`,
    null,
    null,
    payload.currentUser
  );
}

function getForms(filters, currentUser) {
  filters = filters || {};
  return apiRequest('get', '/forms', null, {
    keyword: filters.keyword || '',
    status: filters.status || ''
  }, currentUser);
}

function getFormDetail(formId, currentUser) {
  return apiRequest('get', `/forms/${encodeURIComponent(formId)}`, null, null, currentUser);
}

function getPublicFormDetail(formId) {
  return apiRequest('get', `/public/forms/${encodeURIComponent(formId)}`);
}

function saveForm(payload) {
  const formId = payload.formId || payload.form?.formId || '';
  if (formId) {
    return apiRequest(
      'put',
      `/forms/${encodeURIComponent(formId)}`,
      { currentUser: payload.currentUser, form: payload.form }
    );
  }
  return apiRequest('post', '/forms', {
    currentUser: payload.currentUser,
    form: payload.form
  });
}

function deleteForm(payload) {
  return apiRequest(
    'delete',
    `/forms/${encodeURIComponent(payload.formId)}`,
    null,
    null,
    payload.currentUser
  );
}

function submitFormResponse(payload) {
  return apiRequest(
    'post',
    `/forms/${encodeURIComponent(payload.formId)}/responses`,
    {
      currentUser: payload.currentUser,
      response: payload.response
    }
  );
}

function submitPublicFormResponse(payload) {
  const result = apiRequest(
    'post',
    `/public/forms/${encodeURIComponent(payload.formId)}/responses`,
    {
      response: payload.response
    }
  );
  sendPublicFormEditLinkEmail_(payload.formId, result);
  return result;
}

function getPublicFormResponseForEdit(payload) {
  return apiRequest(
    'get',
    `/public/forms/${encodeURIComponent(payload.formId)}/responses/${encodeURIComponent(payload.responseId)}`,
    null,
    { token: payload.token || '' }
  );
}

function updatePublicFormResponse(payload) {
  const result = apiRequest(
    'put',
    `/public/forms/${encodeURIComponent(payload.formId)}/responses/${encodeURIComponent(payload.responseId)}`,
    {
      token: payload.token || '',
      response: payload.response
    }
  );
  sendPublicFormEditLinkEmail_(payload.formId, result);
  return result;
}

function getPublicFormUrl(formId, currentUser) {
  const url = ScriptApp.getService().getUrl();
  const targetUrl = `${url}?form=${encodeURIComponent(formId)}`;
  try {
    const result = ensureShortLink({
      currentUser,
      link: {
        targetUrl,
        title: '公開表單連結',
        sourceSystem: 'forms',
        sourceType: 'public_form',
        sourceId: formId,
        status: 'active'
      }
    });
    return `${url}?s=${encodeURIComponent(result.link.shortCode)}`;
  } catch (err) {
    return targetUrl;
  }
}

function getPublicFormEditUrl(formId, responseId, token) {
  const url = ScriptApp.getService().getUrl();
  return `${url}?form=${encodeURIComponent(formId)}&response=${encodeURIComponent(responseId)}&token=${encodeURIComponent(token)}`;
}

function getShortLinks(filters, currentUser) {
  filters = filters || {};
  const result = apiRequest('get', '/short-links', null, {
    keyword: filters.keyword || '',
    status: filters.status || '',
    sourceSystem: filters.sourceSystem || ''
  }, currentUser);
  return appendShortLinkUrls_(result);
}

function saveShortLink(payload) {
  const linkId = payload.linkId || payload.link?.linkId || '';
  if (linkId) {
    return appendShortLinkUrl_(apiRequest(
      'put',
      `/short-links/${encodeURIComponent(linkId)}`,
      { currentUser: payload.currentUser, link: payload.link }
    ));
  }
  return appendShortLinkUrl_(apiRequest('post', '/short-links', {
    currentUser: payload.currentUser,
    link: payload.link
  }));
}

function ensureShortLink(payload) {
  return appendShortLinkUrl_(apiRequest('post', '/short-links/ensure', {
    currentUser: payload.currentUser,
    link: payload.link
  }));
}

function resolveShortLink(shortCode) {
  return apiRequest('get', `/short-links/${encodeURIComponent(shortCode)}/resolve`);
}

function appendShortLinkUrls_(result) {
  const rows = result && Array.isArray(result.rows) ? result.rows : [];
  rows.forEach(row => {
    row.shortUrl = buildShortUrl_(row.shortCode);
  });
  return result;
}

function appendShortLinkUrl_(result) {
  if (result && result.link) {
    result.link.shortUrl = buildShortUrl_(result.link.shortCode);
  }
  return result;
}

function buildShortUrl_(shortCode) {
  const url = ScriptApp.getService().getUrl();
  return `${url}?s=${encodeURIComponent(shortCode || '')}`;
}

function sendPublicFormEditLinkEmail_(formId, result) {
  if (!result || !result.respondentEmail || !result.editToken || !result.responseId) return;
  const editUrl = getPublicFormEditUrl(formId, result.responseId, result.editToken);
  MailApp.sendEmail({
    to: result.respondentEmail,
    subject: `表單填寫完成：${result.formTitle || '卓越行道會表單'}`,
    body:
`您好：

我們已收到您填寫的表單「${result.formTitle || ''}」。

如需修改填寫內容，請使用以下連結重新開啟：
${editUrl}

此連結可用來修改您的表單回覆，請勿轉傳給他人。

卓越行道會`
  });
}

function getFormResponses(formId, currentUser) {
  return apiRequest('get', `/forms/${encodeURIComponent(formId)}/responses`, null, null, currentUser);
}

function getFormStatistics(formId, currentUser) {
  return apiRequest('get', `/forms/${encodeURIComponent(formId)}/statistics`, null, null, currentUser);
}

function getFormResponseAttachmentData(payload, currentUser) {
  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty('API_BASE_URL');
  const apiKey = props.getProperty('API_KEY');
  if (!baseUrl || !apiKey) {
    throw new Error('尚未設定 API_BASE_URL / API_KEY，請先執行 setApiConfig。');
  }

  const url = `${baseUrl}/forms/responses/${encodeURIComponent(payload.responseId)}/attachments/${encodeURIComponent(payload.attachmentId)}`;
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      'x-api-key': apiKey,
      'x-current-user': Utilities.base64EncodeWebSafe(JSON.stringify(currentUser))
    },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() >= 300) {
    throw new Error(response.getContentText() || `API 錯誤：${response.getResponseCode()}`);
  }
  const blob = response.getBlob();
  return {
    fileName: blob.getName() || 'image',
    mimeType: blob.getContentType(),
    dataUrl: `data:${blob.getContentType()};base64,${Utilities.base64Encode(blob.getBytes())}`
  };
}

function getEducationCourseCategories(currentUser) {
  return apiRequest('get', '/education/course-categories', null, null, currentUser);
}

function getEducationCourses(filters, currentUser) {
  filters = filters || {};
  return apiRequest('get', '/education/courses', null, {
    keyword: filters.keyword || '',
    categoryId: filters.categoryId || '',
    status: filters.status || ''
  }, currentUser);
}

function getEducationClassForecast(currentUser) {
  return apiRequest('get', '/education/class-forecast', null, null, currentUser);
}

function getEducationCourseDetail(courseId, currentUser) {
  return apiRequest('get', `/education/courses/${encodeURIComponent(courseId)}`, null, null, currentUser);
}

function getAttendanceOptions(currentUser) {
  return apiRequest('get', '/attendance/options', null, null, currentUser);
}

function getAttendanceSmallGroups(filters, currentUser) {
  filters = filters || {};
  return apiRequest('get', '/attendance/small-groups', null, {
    startDate: filters.startDate || '',
    endDate: filters.endDate || '',
    typeId: filters.typeId || '',
    churchId: filters.churchId || '',
    groupId: filters.groupId || ''
  }, currentUser);
}

function getAttendanceSmallGroupMembers(groupId, filters, currentUser) {
  filters = filters || {};
  return apiRequest(
    'get',
    `/attendance/small-groups/${encodeURIComponent(groupId)}/members`,
    null,
    {
      startDate: filters.startDate || '',
      endDate: filters.endDate || '',
      typeId: filters.typeId || ''
    },
    currentUser
  );
}

function getAttendanceMeetings(filters, currentUser) {
  filters = filters || {};
  return apiRequest('get', '/attendance/meetings', null, {
    startDate: filters.startDate || '',
    endDate: filters.endDate || '',
    typeId: filters.typeId || '',
    churchId: filters.churchId || ''
  }, currentUser);
}

function saveEducationCourse(payload) {
  const courseId = payload.courseId || payload.course?.courseId || '';
  if (courseId) {
    return apiRequest(
      'put',
      `/education/courses/${encodeURIComponent(courseId)}`,
      { currentUser: payload.currentUser, course: payload.course }
    );
  }
  return apiRequest('post', '/education/courses', {
    currentUser: payload.currentUser,
    course: payload.course
  });
}

function getCounterTransactions(filters, currentUser) {
  filters = filters || {};
  return apiRequest('get', '/counter/transactions', null, {
    status: filters.status || ''
  }, currentUser);
}

function getQtOptions(currentUser) {
  return apiRequest('get', '/qt/options', null, null, currentUser);
}

function getQtInventory(filters, currentUser) {
  filters = filters || {};
  return apiRequest('get', '/qt/inventory', null, {
    issueMonth: filters.issueMonth || '',
    churchId: filters.churchId || '',
    productType: filters.productType || ''
  }, currentUser);
}

function getQtOrders(filters, currentUser) {
  filters = filters || {};
  return apiRequest('get', '/qt/orders', null, {
    keyword: filters.keyword || '',
    page: filters.page || 1,
    pageSize: filters.pageSize || 20
  }, currentUser);
}

function getQtOrderDetail(orderId, currentUser) {
  return apiRequest('get', '/qt/orders/' + encodeURIComponent(orderId), null, null, currentUser);
}

function getQtReport(type, filters, currentUser) {
  filters = filters || {};
  return apiRequest('get', '/qt/reports/' + encodeURIComponent(type), null, {
    issueMonth: filters.issueMonth || ''
  }, currentUser);
}

function getLineBotDashboard(currentUser) {
  return apiRequest('get', '/linebot/dashboard', null, null, currentUser);
}

function getLineBotUsers(filters, currentUser) {
  filters = filters || {};
  return apiRequest('get', '/linebot/users', null, {
    keyword: filters.keyword || '',
    binding: filters.binding || '',
    page: filters.page || 1,
    pageSize: filters.pageSize || 20
  }, currentUser);
}

function getLineBotChannels(currentUser) {
  return apiRequest('get', '/linebot/channels', null, null, currentUser);
}

function saveLineBotChannel(payload) {
  const channelId = payload.channelId || payload.channel?.channelId || '';
  if (channelId) {
    return apiRequest(
      'put',
      `/linebot/channels/${encodeURIComponent(channelId)}`,
      { currentUser: payload.currentUser, channel: payload.channel }
    );
  }
  return apiRequest('post', '/linebot/channels', {
    currentUser: payload.currentUser,
    channel: payload.channel
  });
}

function getLineBotLinks(filters, currentUser) {
  filters = filters || {};
  return apiRequest('get', '/linebot/links', null, {
    keyword: filters.keyword || '',
    page: filters.page || 1,
    pageSize: filters.pageSize || 20
  }, currentUser);
}

function saveLineBotLink(payload) {
  const linkId = payload.linkId || payload.link?.linkId || '';
  if (linkId) {
    return apiRequest(
      'put',
      `/linebot/links/${encodeURIComponent(linkId)}`,
      { currentUser: payload.currentUser, link: payload.link }
    );
  }
  return apiRequest('post', '/linebot/links', {
    currentUser: payload.currentUser,
    link: payload.link
  });
}

function deleteLineBotLink(payload) {
  return apiRequest(
    'delete',
    `/linebot/links/${encodeURIComponent(payload.linkId)}`,
    null,
    null,
    payload.currentUser
  );
}

function getLineBotModules(currentUser) {
  return apiRequest('get', '/linebot/modules', null, null, currentUser);
}

function updateLineBotModule(payload) {
  return apiRequest(
    'put',
    `/linebot/modules/${encodeURIComponent(payload.moduleKey)}`,
    { currentUser: payload.currentUser, module: payload.module }
  );
}

function getLineBotEvents(filters, currentUser) {
  filters = filters || {};
  return apiRequest('get', '/linebot/events', null, {
    keyword: filters.keyword || '',
    page: filters.page || 1,
    pageSize: filters.pageSize || 20
  }, currentUser);
}

function getLineBotRichMenus(currentUser) {
  return apiRequest('get', '/linebot/rich-menus', null, null, currentUser);
}

function saveLineBotRichMenu(payload) {
  const richMenuId = payload.richMenuId || payload.richMenu?.richMenuId || '';
  if (richMenuId) {
    return apiRequest(
      'put',
      `/linebot/rich-menus/${encodeURIComponent(richMenuId)}`,
      { currentUser: payload.currentUser, richMenu: payload.richMenu }
    );
  }
  return apiRequest('post', '/linebot/rich-menus', {
    currentUser: payload.currentUser,
    richMenu: payload.richMenu
  });
}

function getQtInventoryMovements(filters, currentUser) {
  filters = filters || {};
  return apiRequest('get', '/qt/inventory/movements', null, {
    issueMonth: filters.issueMonth || '',
    churchId: filters.churchId || '',
    productType: filters.productType || ''
  }, currentUser);
}

function addQtInventoryMovement(payload) {
  return apiRequest('post', '/qt/inventory/movements', payload);
}

function transferQtInventory(payload) {
  return apiRequest('post', '/qt/inventory/transfers', payload);
}

function markCounterTransactionPaid(payload) {
  return apiRequest(
    'patch',
    `/counter/transactions/${encodeURIComponent(payload.transactionId)}/paid`,
    { currentUser: payload.currentUser }
  );
}

function getCurrentCounterPinCode(currentUser) {
  return apiRequest('get', '/counter/pin-code/current', null, null, currentUser);
}

function getCounterPinCodes(currentUser) {
  return apiRequest('get', '/counter/pin-codes', null, null, currentUser);
}

function createCounterPinCode(payload) {
  return apiRequest('post', '/counter/pin-codes', {
    currentUser: payload.currentUser,
    displayName: payload.displayName
  });
}

function deactivateCounterPinCode(payload) {
  return apiRequest(
    'patch',
    `/counter/pin-codes/${encodeURIComponent(payload.pinId)}/deactivate`,
    { currentUser: payload.currentUser }
  );
}

function resetCurrentWeekCounterPinCodes(payload) {
  return apiRequest('post', '/counter/pin-codes/reset-current-week', {
    currentUser: payload.currentUser,
    displayName: payload.displayName
  });
}

function getQrcodeEvents(filters, currentUser) {
  filters = filters || {};
  return apiRequest('get', '/qrcode/events', null, {
    keyword: filters.keyword || '',
    status: filters.status || ''
  }, currentUser);
}

function getQrcodeOptions(currentUser) {
  return apiRequest('get', '/qrcode/options', null, null, currentUser);
}

function getActiveQrcodeEvents(currentUser) {
  return apiRequest('get', '/qrcode/events/active', null, null, currentUser);
}

function getQrcodeEventDetail(eventId, currentUser) {
  return apiRequest('get', `/qrcode/events/${encodeURIComponent(eventId)}`, null, null, currentUser);
}

function saveQrcodeEvent(payload) {
  const eventId = payload.eventId || payload.event?.eventId || '';
  if (eventId) {
    return apiRequest(
      'put',
      `/qrcode/events/${encodeURIComponent(eventId)}`,
      { currentUser: payload.currentUser, event: payload.event }
    );
  }
  return apiRequest('post', '/qrcode/events', {
    currentUser: payload.currentUser,
    event: payload.event
  });
}

function checkInQrcodeEvent(payload) {
  return apiRequest(
    'post',
    `/qrcode/events/${encodeURIComponent(payload.eventId)}/checkins`,
    {
      currentUser: payload.currentUser,
      qrPayload: payload.qrPayload
    }
  );
}

function getVenueResources(filters, currentUser) {
  filters = filters || {};
  return apiRequest('get', '/venues/resources', null, {
    hall: filters.hall || ''
  }, currentUser);
}

function saveVenueResourceCalendar(payload) {
  return apiRequest('put', '/venues/resources/calendar', {
    currentUser: payload.currentUser,
    resource: payload.resource
  });
}

function saveVenueResourceBookable(payload) {
  return apiRequest('put', '/venues/resources/bookable', {
    currentUser: payload.currentUser,
    resource: payload.resource
  });
}

function saveVenueReservation(payload) {
  return apiRequest('post', '/venues/reservations', {
    currentUser: payload.currentUser,
    reservation: payload.reservation
  });
}

function cancelVenueReservation(payload) {
  return apiRequest(
    'patch',
    `/venues/reservations/${encodeURIComponent(payload.reservationId)}/cancel`,
    { currentUser: payload.currentUser }
  );
}

function getVenueAvailability(filters, currentUser) {
  filters = filters || {};
  const startAt = filters.startAt || new Date().toISOString();
  const endAt = filters.endAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const data = apiRequest('get', '/venues/availability', null, {
    hall: filters.hall || '',
    mainLocation: filters.mainLocation || '',
    startAt,
    endAt
  }, currentUser);

  const resources = (data.resources || []).filter(resource => {
    if (filters.mainLocation && resource.mainLocation !== filters.mainLocation) return false;
    return true;
  });
  const databaseReservations = data.reservations || [];
  const calendarEvents = [];
  const calendarErrors = [];

  resources.forEach(resource => {
    if (!resource.calendarId) return;
    try {
      const calendar = CalendarApp.getCalendarById(resource.calendarId);
      if (!calendar) {
        calendarErrors.push({
          hall: resource.hall,
          mainLocation: resource.mainLocation,
          calendarId: resource.calendarId,
          message: '找不到此 Google 行事曆'
        });
        return;
      }
      calendar.getEvents(new Date(startAt), new Date(endAt)).forEach(event => {
        calendarEvents.push({
          source: 'google_calendar',
          hall: resource.hall,
          mainLocation: resource.mainLocation,
          title: event.getTitle(),
          startAt: event.getStartTime().toISOString(),
          endAt: event.getEndTime().toISOString(),
          calendarId: resource.calendarId,
          calendarEventId: event.getId()
        });
      });
    } catch (err) {
      calendarErrors.push({
        hall: resource.hall,
        mainLocation: resource.mainLocation,
        calendarId: resource.calendarId,
        message: err.message || String(err)
      });
    }
  });

  const events = databaseReservations
    .map(item => Object.assign({ source: 'database' }, item))
    .concat(calendarEvents);

  return {
    resources: resources.map(resource => {
      const resourceEvents = events.filter(event =>
        event.hall === resource.hall && event.mainLocation === resource.mainLocation
      );
      return Object.assign({}, resource, {
        status: resourceEvents.length ? '使用中' : '可使用',
        events: resourceEvents
      });
    }),
    reservations: databaseReservations,
    calendarEvents,
    calendarErrors,
    startAt,
    endAt
  };
}

function getZoomAvailability(filters, currentUser) {
  filters = filters || {};
  return apiRequest('get', '/zoom/availability', null, {
    startAt: filters.startAt || new Date().toISOString(),
    endAt: filters.endAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    zoomAccountId: filters.zoomAccountId || ''
  }, currentUser);
}

function saveZoomReservation(payload) {
  return apiRequest('post', '/zoom/reservations', {
    currentUser: payload.currentUser,
    reservation: payload.reservation
  });
}

function cancelZoomReservation(payload) {
  return apiRequest(
    'patch',
    `/zoom/reservations/${encodeURIComponent(payload.reservationId)}/cancel`,
    { currentUser: payload.currentUser }
  );
}

function getProjects(filters, currentUser) {
  filters = filters || {};
  currentUser = currentUser || filters.currentUser;
  return apiRequest('get', '/projects', null, {
    keyword: filters.keyword || '',
    projectType: filters.projectType || '',
    unit: filters.unit || '',
    currentUser: currentUser ? Utilities.base64EncodeWebSafe(JSON.stringify(currentUser)) : ''
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

  return fetchNasDocx_(
    `/documents/projects/${encodeURIComponent(projectId)}.docx`,
    currentUser,
    `${projectId}_專案文件.docx`,
    '已建立專案 DOCX'
  );
}

function saveProject(payload) {
  return apiRequest('post', '/projects', payload);
}

function getPurchases(filters, currentUser) {
  filters = filters || {};
  currentUser = currentUser || filters.currentUser;
  return apiRequest('get', '/purchases', null, {
    keyword: filters.keyword || ''
  }, currentUser);
}

function getPurchaseDetail(purchaseId, currentUser) {
  return apiRequest('post', '/purchases/detail', { purchaseId, currentUser });
}

function getAssets(filters, currentUser) {
  filters = filters || {};
  return apiRequest('get', '/assets', null, {
    keyword: filters.keyword || '',
    assetType: filters.assetType || '',
    hall: filters.hall || '',
    status: filters.status || '',
    page: filters.page || 1,
    pageSize: filters.pageSize || 20,
    sortBy: filters.sortBy || 'assetId',
    sortDirection: filters.sortDirection || 'asc'
  }, currentUser);
}

function getAssetDetail(assetId, currentUser) {
  return apiRequest('get', `/assets/${encodeURIComponent(assetId)}`, null, null, currentUser);
}

function getAdminSupplyOptions(currentUser) {
  return apiRequest('get', '/admin-supplies/options', null, null, currentUser);
}

function getAdminSupplyItems(filters, currentUser) {
  filters = filters || {};
  return apiRequest('get', '/admin-supplies/items', null, {
    keyword: filters.keyword || '',
    category: filters.category || '',
    status: filters.status || '',
    page: filters.page || 1,
    pageSize: filters.pageSize || 20
  }, currentUser);
}

function saveAdminSupplyItem(payload) {
  const item = payload.item || {};
  if (item.supplyId) {
    return apiRequest(
      'put',
      `/admin-supplies/items/${encodeURIComponent(item.supplyId)}`,
      { currentUser: payload.currentUser, item }
    );
  }
  return apiRequest('post', '/admin-supplies/items', {
    currentUser: payload.currentUser,
    item
  });
}

function getAdminSupplyMovements(filters, currentUser) {
  filters = filters || {};
  return apiRequest('get', '/admin-supplies/movements', null, {
    supplyId: filters.supplyId || '',
    movementType: filters.movementType || '',
    limit: filters.limit || 100
  }, currentUser);
}

function createAdminSupplyMovement(payload) {
  return apiRequest('post', '/admin-supplies/movements', {
    currentUser: payload.currentUser,
    movement: payload.movement
  });
}

function saveAsset(payload) {
  const assetId = payload.asset && payload.asset.assetId;
  if (assetId) {
    return apiRequest('put', `/assets/${encodeURIComponent(assetId)}`, payload);
  }
  return apiRequest('post', '/assets', payload);
}

function getAssetLocations(currentUser) {
  return apiRequest('get', '/locations', null, null, currentUser);
}

function addLocationItem(payload) {
  return apiRequest('post', '/locations', payload);
}

function updateLocationItem(payload) {
  return apiRequest('put', `/locations/${encodeURIComponent(payload.locationId)}`, payload);
}

function deleteLocationItem(payload) {
  return apiRequest(
    'delete',
    `/locations/${encodeURIComponent(payload.locationId)}`,
    null,
    null,
    payload.currentUser
  );
}

function getSystemUsers(currentUser) {
  return apiRequest('get', '/system/users', null, null, currentUser);
}

function saveSystemUser(payload) {
  return apiRequest('post', '/system/users', payload);
}

function saveSystemUserRoles(payload) {
  return apiRequest(
    'put',
    `/system/users/${encodeURIComponent(payload.staffId)}/roles`,
    payload
  );
}

function savePastoralChurchPermissions(payload) {
  return apiRequest(
    'put',
    `/system/users/${encodeURIComponent(payload.staffId)}/pastoral-churches`,
    payload
  );
}

function recordSystemUsage(payload) {
  return apiRequest('post', '/usage', payload);
}

function getWorkLogs(currentUser) {
  return apiRequest('get', '/work-logs', null, { limit: 20 }, currentUser);
}

function addWorkLog(payload) {
  return apiRequest('post', '/work-logs', {
    currentUser: payload.currentUser,
    workLog: payload.workLog
  });
}

function deleteWorkLog(workLogId, currentUser) {
  return apiRequest('delete', `/work-logs/${encodeURIComponent(workLogId)}`, null, null, currentUser);
}

function getFeaturePermissions(currentUser) {
  return apiRequest('get', '/system/feature-permissions', null, null, currentUser);
}

function saveFeaturePermissions(payload) {
  return apiRequest('put', '/system/feature-permissions', payload);
}

function getSystemLogs(filters, currentUser) {
  filters = filters || {};
  return apiRequest('get', '/system/logs', null, {
    type: filters.type || 'audit',
    keyword: filters.keyword || '',
    systemKey: filters.systemKey || '',
    staffId: filters.staffId || '',
    limit: filters.limit || 100
  }, currentUser);
}

function getSundayMessageOptions(currentUser) {
  return apiRequest('get', '/sunday-messages/options', null, null, currentUser);
}

function getSundayMessages(filters, currentUser) {
  filters = filters || {};
  return apiRequest('get', '/sunday-messages', null, {
    keyword: filters.keyword || '',
    status: filters.status || 'active'
  }, currentUser);
}

function getSundayMessage(messageId, currentUser) {
  return apiRequest('get', `/sunday-messages/${encodeURIComponent(messageId)}`, null, null, currentUser);
}

function saveSundayMessage(payload) {
  const message = payload.message || {};
  const currentUser = payload.currentUser || {};
  if (message.messageId) {
    return apiRequest(
      'put',
      `/sunday-messages/${encodeURIComponent(message.messageId)}`,
      { currentUser, message }
    );
  }
  return apiRequest('post', '/sunday-messages', { currentUser, message });
}

function saveSundayMessageShares(payload) {
  return apiRequest(
    'put',
    `/sunday-messages/${encodeURIComponent(payload.messageId)}/shares`,
    {
      currentUser: payload.currentUser || {},
      shares: payload.shares || {}
    }
  );
}

function archiveSundayMessage(messageId, currentUser) {
  return apiRequest(
    'delete',
    `/sunday-messages/${encodeURIComponent(messageId)}`,
    null,
    null,
    currentUser
  );
}

function exportPurchaseDoc(payload) {
  const purchaseId = payload.purchaseId;
  const docType = payload.docType;
  const docId = payload.docId || '';

  if (!purchaseId) throw new Error('缺少採購編號');

  const docPath = docId
    ? `/documents/finance/purchases/${encodeURIComponent(purchaseId)}/${encodeURIComponent(docType)}/${encodeURIComponent(docId)}.docx`
    : `/documents/finance/purchases/${encodeURIComponent(purchaseId)}/${encodeURIComponent(docType)}.docx`;
  return fetchNasDocx_(
    docPath,
    payload.currentUser,
    `${purchaseId}_${docType}${docId ? `_${docId}` : ''}.docx`,
    '已建立財務單據 DOCX'
  );
}

function exportPaymentRequestDoc(payload) {
  const paymentId = payload.paymentId;
  const docType = payload.docType;
  const proofId = payload.proofId || '';

  if (!paymentId) throw new Error('缺少請款編號');
  if (docType !== 'payment' && docType !== 'expenseProof') throw new Error('未知的請款單據類型');
  if (docType === 'expenseProof' && !proofId) throw new Error('缺少支出證明編號');

  const docPath = docType === 'payment'
    ? `/documents/finance/payment-requests/${encodeURIComponent(paymentId)}.docx`
    : `/documents/finance/payment-requests/${encodeURIComponent(paymentId)}/expense-proofs/${encodeURIComponent(proofId)}.docx`;
  return fetchNasDocx_(
    docPath,
    payload.currentUser,
    `${paymentId}_${docType === 'payment' ? '請款申請單' : `支出證明申請單_${proofId}`}.docx`,
    '已建立財務單據 DOCX'
  );
}

function exportPaymentRequestDocx(payload) {
  return exportPaymentRequestDoc(Object.assign({}, payload, { docType: 'payment' }));
}

function fetchNasDocx_(path, currentUser, fallbackFileName, message) {
  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty('API_BASE_URL');
  const apiKey = props.getProperty('API_KEY');
  if (!baseUrl || !apiKey) {
    throw new Error('尚未設定 API_BASE_URL / API_KEY，請先執行 setApiConfig。');
  }

  const response = UrlFetchApp.fetch(`${baseUrl}${path}`, {
    method: 'get',
    headers: {
      'x-api-key': apiKey,
      'x-current-user': Utilities.base64EncodeWebSafe(JSON.stringify(currentUser || {}))
    },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() >= 300) {
    throw new Error(response.getContentText() || `API 錯誤：${response.getResponseCode()}`);
  }

  const blob = response.getBlob();
  return {
    success: true,
    fileName: fallbackFileName || 'document.docx',
    mimeType: blob.getContentType(),
    dataUrl: `data:${blob.getContentType()};base64,${Utilities.base64Encode(blob.getBytes())}`,
    message: message || '已建立 DOCX'
  };
}

function savePurchase(payload) {
  return apiRequest('post', '/purchases', payload);
}

function getPurchaseQuotePdfData(payload) {
  return apiRequest(
    'get',
    `/purchases/${encodeURIComponent(payload.purchaseId)}/quote-pdfs/${encodeURIComponent(payload.fileId)}`,
    null,
    null,
    payload.currentUser
  );
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

function getPaymentRequests(filters, currentUser) {
  filters = filters || {};
  return apiRequest('get', '/payment-requests', null, {
    keyword: filters.keyword || ''
  }, currentUser);
}

function getPaymentRequestDetail(paymentId, currentUser) {
  return apiRequest('get', `/payment-requests/${encodeURIComponent(paymentId)}`, null, null, currentUser);
}

function addIndependentPaymentRequest(payload) {
  return apiRequest('post', '/payment-requests', payload);
}

function updatePaymentRequest(payload) {
  return apiRequest(
    'put',
    `/payment-requests/${encodeURIComponent(payload.paymentId)}`,
    payload
  );
}

function addPaymentExpenseProof(payload) {
  return apiRequest(
    'post',
    `/payment-requests/${encodeURIComponent(payload.paymentId)}/expense-proofs`,
    payload
  );
}

function updateExpenseProof(payload) {
  return apiRequest(
    'put',
    `/expense-proofs/${encodeURIComponent(payload.proofId)}`,
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

function importMeetingWordRecord(payload) {
  payload = payload || {};
  const file = payload.file || {};
  const fileName = String(file.fileName || '會議紀錄.docx').trim();
  const mimeType = String(file.mimeType || '').trim();
  const data = String(file.data || '').trim();
  if (!data) throw new Error('請選擇要匯入的 Word 會議紀錄');
  if (!isSupportedMeetingWordMime(fileName, mimeType)) {
    throw new Error('會議紀錄僅支援 Word 檔（.doc 或 .docx）');
  }

  const bytes = Utilities.base64Decode(data.indexOf(',') >= 0 ? data.split(',').pop() : data);
  if (bytes.length > 10 * 1024 * 1024) throw new Error('Word 會議紀錄不可超過 10MB');

  const uploadBlob = Utilities.newBlob(bytes, mimeType || MimeType.MICROSOFT_WORD, fileName);
  let sourceFile = null;
  let convertedFile = null;

  try {
    sourceFile = DriveApp.createFile(uploadBlob);
    const resource = {
      title: `${fileName.replace(/\.[^.]+$/, '')}_${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss')}`
    };
    convertedFile = Drive.Files.insert(resource, uploadBlob, { convert: true });
    const doc = DocumentApp.openById(convertedFile.id);
    const decisionText = doc.getBody().getText().trim();
    doc.saveAndClose();

    const pdfResponse = UrlFetchApp.fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(convertedFile.id)}/export?mimeType=application/pdf`,
      {
        headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
        muteHttpExceptions: true
      }
    );
    if (pdfResponse.getResponseCode() >= 300) {
      throw new Error(`Word 轉 PDF 失敗：${pdfResponse.getContentText()}`);
    }

    const pdfName = `${fileName.replace(/\.[^.]+$/, '')}.pdf`;
    return {
      success: true,
      decisionText,
      pdfFile: {
        fileName: pdfName,
        mimeType: 'application/pdf',
        fileSize: pdfResponse.getBlob().getBytes().length,
        data: `data:application/pdf;base64,${Utilities.base64Encode(pdfResponse.getBlob().getBytes())}`
      },
      message: '已匯入 Word 會議紀錄'
    };
  } finally {
    if (sourceFile) {
      try { sourceFile.setTrashed(true); } catch (err) {}
    }
    if (convertedFile && convertedFile.id) {
      try { DriveApp.getFileById(convertedFile.id).setTrashed(true); } catch (err) {}
    }
  }
}

function isSupportedMeetingWordMime(fileName, mimeType) {
  const lowerName = String(fileName || '').toLowerCase();
  return lowerName.endsWith('.docx') ||
    lowerName.endsWith('.doc') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword';
}

function getMeetingRecordPdfData(payload) {
  return apiRequest(
    'get',
    `/projects/${encodeURIComponent(payload.projectId)}/meetings/${encodeURIComponent(payload.meetingId)}/record-pdfs/${encodeURIComponent(payload.fileId)}`,
    null,
    null,
    payload.currentUser
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
