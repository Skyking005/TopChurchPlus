const LINE_API_BASE_URL = 'https://api.line.me/v2/bot';

const LINE_API_MODES = new Set(['prepare', 'dry_run', 'live']);
const WEBHOOK_SIGNATURE_MODES = new Set(['off', 'log_only', 'enforce']);

function normalizeLineApiConfig(value = {}) {
  const mode = LINE_API_MODES.has(value.mode) ? value.mode : 'prepare';
  const webhookSignatureMode = WEBHOOK_SIGNATURE_MODES.has(value.webhookSignatureMode)
    ? value.webhookSignatureMode
    : 'log_only';

  return {
    enabled: value.enabled === true,
    mode,
    autoRichMenuSwitch: value.autoRichMenuSwitch === true,
    webhookSignatureMode
  };
}

function getLineApiReadiness(metadata = {}) {
  const config = normalizeLineApiConfig(metadata.lineApi || {});
  const hasChannelAccessToken = Boolean(metadata.channelAccessToken);
  const hasChannelSecret = Boolean(metadata.channelSecret);
  const canCallLineApi = config.enabled && config.mode === 'live' && hasChannelAccessToken;
  const canVerifyWebhook = config.webhookSignatureMode === 'enforce' && hasChannelSecret;
  const warnings = [];

  if (!config.enabled) warnings.push('LINE API 串接尚未啟用，系統只會保存設定。');
  if (config.enabled && config.mode !== 'live') warnings.push('目前不是正式呼叫模式，不會呼叫 LINE API。');
  if (config.enabled && !hasChannelAccessToken) warnings.push('尚未設定 Channel Access Token。');
  if (config.webhookSignatureMode === 'enforce' && !hasChannelSecret) warnings.push('強制驗證 Webhook 簽章需要 Channel Secret。');
  if (config.autoRichMenuSwitch && !canCallLineApi) warnings.push('自動切換 Rich Menu 需要啟用正式 LINE API 呼叫。');

  return {
    ...config,
    hasChannelAccessToken,
    hasChannelSecret,
    canCallLineApi,
    canVerifyWebhook,
    warnings
  };
}

function createLineApiClient(metadata = {}, fetchImpl = globalThis.fetch) {
  const readiness = getLineApiReadiness(metadata);

  async function request(path, options = {}) {
    if (!readiness.canCallLineApi) {
      if (readiness.enabled && readiness.mode === 'dry_run') {
        return {
          dryRun: true,
          method: options.method || 'GET',
          path,
          warnings: readiness.warnings
        };
      }
      throw new Error('LINE API 尚未啟用正式呼叫模式');
    }
    if (typeof fetchImpl !== 'function') throw new Error('目前執行環境不支援 fetch，無法呼叫 LINE API');
    const response = await fetchImpl(`${LINE_API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${metadata.channelAccessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch (err) {
        body = { raw: text };
      }
    }
    if (!response.ok) {
      const message = body && (body.message || body.error) ? body.message || body.error : `LINE API 回應錯誤 ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body || { success: true };
  }

  return {
    readiness,
    getBotInfo: () => request('/info'),
    linkRichMenuToUser: (lineUserId, richMenuId) => request(`/user/${encodeURIComponent(lineUserId)}/richmenu/${encodeURIComponent(richMenuId)}`, { method: 'POST' }),
    unlinkRichMenuFromUser: lineUserId => request(`/user/${encodeURIComponent(lineUserId)}/richmenu`, { method: 'DELETE' })
  };
}

module.exports = {
  createLineApiClient,
  getLineApiReadiness,
  normalizeLineApiConfig
};
