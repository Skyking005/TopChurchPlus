BEGIN;

WITH main_channel AS (
  SELECT metadata
  FROM line_bot_channels
  WHERE channel_key = 'main'
    AND is_active
  LIMIT 1
)
UPDATE system_config
SET config_value = COALESCE(NULLIF((SELECT metadata->>'channelSecret' FROM main_channel), ''), config_value),
    is_secret = true,
    updated_at = now()
WHERE config_key = 'LINE_CHANNEL_SECRET'
  AND COALESCE(config_value, '') = '';

WITH main_channel AS (
  SELECT metadata
  FROM line_bot_channels
  WHERE channel_key = 'main'
    AND is_active
  LIMIT 1
)
UPDATE system_config
SET config_value = COALESCE(NULLIF((SELECT metadata->>'channelAccessToken' FROM main_channel), ''), config_value),
    is_secret = true,
    updated_at = now()
WHERE config_key = 'LINE_CHANNEL_ACCESS_TOKEN'
  AND COALESCE(config_value, '') = '';

WITH main_channel AS (
  SELECT metadata
  FROM line_bot_channels
  WHERE channel_key = 'main'
    AND is_active
  LIMIT 1
)
UPDATE system_config
SET config_value = COALESCE(NULLIF((SELECT metadata #>> '{liffIds,portal}' FROM main_channel), ''), config_value),
    is_secret = true,
    updated_at = now()
WHERE config_key = 'LINE_LIFF_ID'
  AND COALESCE(config_value, '') = '';

COMMIT;
