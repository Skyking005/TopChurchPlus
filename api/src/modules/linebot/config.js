const { getConfigValues } = require('../../shared/config');

async function resolveLineChannelMetadata(channel, options = {}) {
  const metadata = channel.metadata || {};
  const values = await getConfigValues([
    'LINE_CHANNEL_SECRET',
    'LINE_CHANNEL_ACCESS_TOKEN',
    'LINE_LIFF_ID',
    'LINE_RICH_MENU_GUEST_ID',
    'LINE_RICH_MENU_MEMBER_ID',
    'LINE_RICH_MENU_LEADER_ID',
    'LINE_LOGIN_URL'
  ], { revealSecrets: true });

  return {
    ...metadata,
    channelSecret: values.LINE_CHANNEL_SECRET || metadata.channelSecret || '',
    channelAccessToken: values.LINE_CHANNEL_ACCESS_TOKEN || metadata.channelAccessToken || '',
    liffIds: {
      ...(metadata.liffIds || {}),
      portal: values.LINE_LIFF_ID || metadata.liffIds?.portal || ''
    },
    richMenuIds: {
      ...(metadata.richMenuIds || {}),
      unbound: values.LINE_RICH_MENU_GUEST_ID || metadata.richMenuIds?.unbound || '',
      bound: values.LINE_RICH_MENU_MEMBER_ID || metadata.richMenuIds?.bound || '',
      advanced: values.LINE_RICH_MENU_LEADER_ID || metadata.richMenuIds?.advanced || ''
    },
    loginUrl: values.LINE_LOGIN_URL || metadata.loginUrl || ''
  };
}

async function resolveLineChannel(channel) {
  return {
    ...channel,
    metadata: await resolveLineChannelMetadata(channel)
  };
}

module.exports = {
  resolveLineChannel,
  resolveLineChannelMetadata
};
