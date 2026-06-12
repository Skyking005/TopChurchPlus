(function () {
  const state = {
    config: null,
    sessionToken: localStorage.getItem('topchurchplus_liff_session') || ''
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('bindSubmitBtn').addEventListener('click', submitBinding);
    startLiffApp().catch(showFatalError);
  });

  async function startLiffApp() {
    setStatus('正在讀取 Line App 設定...');
    state.config = await apiGet('/liff/config' + buildChannelQuery());
    if (!state.config.liffId) {
      document.getElementById('configWarning').classList.remove('d-none');
      setStatus('Line App 尚未完成設定');
      renderModuleList(state.config.modules || []);
      return;
    }

    setStatus('正在初始化 LINE 登入...');
    await waitForLiffSdk();
    await liff.init({ liffId: state.config.liffId });
    if (!liff.isLoggedIn()) {
      setStatus('正在開啟 LINE 登入...');
      liff.login({ redirectUri: window.location.href });
      return;
    }

    const profile = await liff.getProfile().catch(() => null);
    if (profile && profile.pictureUrl) {
      const image = document.getElementById('liffProfileImage');
      image.src = profile.pictureUrl;
      image.classList.remove('d-none');
    }

    if (!state.sessionToken) {
      await createSession();
    }
    await loadMeAndPortal();
  }

  async function createSession() {
    const idToken = liff.getIDToken();
    if (!idToken) throw new Error('無法取得 LINE ID Token，請重新開啟 Line App');
    const result = await apiPost('/liff/session', {
      channelKey: getChannelKey(),
      idToken
    });
    state.sessionToken = result.sessionToken;
    localStorage.setItem('topchurchplus_liff_session', state.sessionToken);
  }

  async function loadMeAndPortal() {
    setStatus('正在讀取會友資料...');
    let me;
    try {
      me = await apiGet('/liff/me', true);
    } catch (err) {
      localStorage.removeItem('topchurchplus_liff_session');
      state.sessionToken = '';
      await createSession();
      me = await apiGet('/liff/me', true);
    }

    renderMember(me);
    const portal = await apiGet('/liff/portal-links', true);
    renderPortal(portal);
    if ((portal.menuItems || []).some(item => item.menuCode === 'LEADER_CENTER')) {
      await loadLeaderCenter();
    } else {
      document.getElementById('leaderPanel').classList.add('d-none');
    }
    setStatus(me.member ? '已完成會友綁定' : '尚未綁定會友資料');
  }

  async function submitBinding() {
    const button = document.getElementById('bindSubmitBtn');
    const message = document.getElementById('bindMessage');
    message.textContent = '';
    button.disabled = true;
    button.textContent = '綁定中...';

    try {
      const result = await apiPost('/liff/bind-member', {
        name: document.getElementById('bindName').value,
        mobilePhone: document.getElementById('bindMobilePhone').value
      }, true);
      message.textContent = result.message || '綁定完成';
      await loadMeAndPortal();
    } catch (err) {
      message.textContent = err.message || String(err);
    } finally {
      button.disabled = false;
      button.textContent = '完成綁定';
    }
  }

  function renderMember(data) {
    document.getElementById('memberCard').classList.remove('d-none');
    const member = data.member;
    const lineUser = data.lineUser || {};
    document.getElementById('memberSummary').innerHTML = member
      ? [
          `<div>姓名：${escapeHtml(member.name)}</div>`,
          `<div>會堂：${escapeHtml(member.churchName || '未設定')}</div>`,
          `<div>LINE：${escapeHtml(lineUser.displayName || '已登入')}</div>`
        ].join('')
      : [
          `<div>LINE：${escapeHtml(lineUser.displayName || '已登入')}</div>`,
          '<div>尚未綁定會友資料</div>'
        ].join('');
    document.getElementById('bindPanel').classList.toggle('d-none', Boolean(member));
  }

  function renderPortal(portal) {
    document.getElementById('portalPanel').classList.remove('d-none');
    renderMenuItems(portal.menuItems || []);
    const links = portal.links || [];
    const box = document.getElementById('portalLinks');
    if (!links.length) {
      box.innerHTML = '<div class="module-item">目前尚未設定可用連結。</div>';
    } else {
      box.innerHTML = links.map(link => `
        <a class="portal-link" href="${escapeAttr(link.url)}" target="_top">
          <span class="portal-link-title">${escapeHtml(link.title)}</span>
          <span class="portal-link-note">${escapeHtml(link.note || formatLinkType(link.type))}</span>
        </a>
      `).join('');
    }
    renderModuleList(portal.modules || state.config.modules || []);
  }

  async function loadLeaderCenter() {
    try {
      const leader = await apiGet('/liff/leader-center', true);
      renderLeaderCenter(leader);
    } catch (err) {
      document.getElementById('leaderPanel').classList.add('d-none');
    }
  }

  function renderMenuItems(items) {
    const box = document.getElementById('menuItems');
    if (!items.length) {
      box.innerHTML = '';
      return;
    }
    box.innerHTML = items.map(item => `
      <a class="portal-link" href="${escapeAttr(resolveMenuUrl(item))}" target="_top">
        <span class="portal-link-title">${escapeHtml(item.menuName)}</span>
        <span class="portal-link-note">${escapeHtml(formatOpenType(item.openType))}</span>
      </a>
    `).join('');
  }

  function renderLeaderCenter(leader) {
    document.getElementById('leaderPanel').classList.remove('d-none');
    const scope = leader.scope || {};
    document.getElementById('leaderScope').innerHTML = [
      `<div>職分：${escapeHtml(scope.titleName || '領袖')}</div>`,
      `<div>範圍：${escapeHtml(formatScopeType(scope.scopeType))}${scope.groupName ? ` / ${escapeHtml(scope.groupName)}` : ''}</div>`
    ].join('');
    const attendance = leader.attendanceSummary || [];
    const courses = leader.courseSummary || [];
    const latestAttendance = attendance[0];
    document.getElementById('leaderSummary').innerHTML = [
      latestAttendance ? `
        <div class="module-item">
          <strong>最近出席摘要</strong><br>
          ${escapeHtml(formatDateMonth(latestAttendance.month))}：
          ${escapeHtml(latestAttendance.attendedCount)} / ${escapeHtml(latestAttendance.totalMeetings)}
          (${escapeHtml(latestAttendance.attendanceRate)}%)
        </div>
      ` : '<div class="module-item">目前尚未建立出席摘要快取。</div>',
      courses.length ? courses.map(course => `
        <div class="module-item">
          <strong>${escapeHtml(course.courseStage || '課程摘要')}</strong><br>
          完成 ${escapeHtml(course.completedCount)} / ${escapeHtml(course.requiredCount)}
          (${escapeHtml(course.completionRate)}%)
        </div>
      `).join('') : '<div class="module-item">目前尚未建立課程摘要快取。</div>'
    ].join('');
  }

  function renderModuleList(modules) {
    const box = document.getElementById('moduleList');
    box.innerHTML = (modules || []).map(module => `
      <div class="module-item">
        <strong>${escapeHtml(module.name)}</strong><br>
        ${escapeHtml(module.description || '功能規劃中')}
      </div>
    `).join('');
  }

  async function apiGet(path, withSession) {
    return apiRequest(path, { method: 'GET' }, withSession);
  }

  async function apiPost(path, body, withSession) {
    return apiRequest(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body || {})
    }, withSession);
  }

  async function apiRequest(path, options, withSession) {
    const headers = new Headers(options.headers || {});
    if (withSession && state.sessionToken) {
      headers.set('authorization', `Bearer ${state.sessionToken}`);
    }
    const response = await fetch(path, { ...options, headers });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(data.error || '系統暫時無法回應');
    return data;
  }

  function buildChannelQuery() {
    const key = getChannelKey();
    return key ? `?channelKey=${encodeURIComponent(key)}` : '';
  }

  function getChannelKey() {
    return new URLSearchParams(window.location.search).get('channelKey') || 'main';
  }

  function setStatus(text) {
    document.getElementById('liffStatusText').textContent = text;
  }

  function waitForLiffSdk() {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const timer = setInterval(() => {
        if (window.liff) {
          clearInterval(timer);
          resolve();
          return;
        }
        if (Date.now() - startedAt > 10000) {
          clearInterval(timer);
          reject(new Error('LIFF SDK 載入失敗，請確認網路連線'));
        }
      }, 100);
    });
  }

  function showFatalError(err) {
    setStatus(err.message || String(err));
  }

  function formatLinkType(type) {
    const labels = {
      form: '表單',
      event: '活動',
      qt: 'QT',
      donation: '奉獻',
      custom: '連結'
    };
    return labels[type] || '連結';
  }

  function formatOpenType(type) {
    const labels = {
      LIFF_ROUTE: 'Line App',
      EXTERNAL_URL: '外部連結',
      INTERNAL_MODULE: '系統功能'
    };
    return labels[type] || '功能入口';
  }

  function formatScopeType(type) {
    const labels = {
      SELF: '個人',
      CELL_GROUP: '小家',
      BIG_GROUP: '大家',
      ZONE: '牧區',
      GLOBAL: '全域'
    };
    return labels[type] || type || '';
  }

  function formatDateMonth(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 7);
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function resolveMenuUrl(item) {
    const url = item.targetUrl || '';
    if (!url) return '#';
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('/liff/leader')) return '#leaderPanel';
    return url;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }
})();
