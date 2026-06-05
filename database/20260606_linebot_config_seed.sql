INSERT INTO line_bot_channels (
  channel_key, channel_name, channel_type, webhook_url, liff_base_url, is_active, metadata
) VALUES (
  'main',
  '卓越小幫手',
  'official',
  '',
  '',
  true,
  jsonb_build_object(
    'channelAccessToken', '',
    'channelSecret', '',
    'loginClientId', '',
    'loginClientSecret', '',
    'loginRedirectUri', '',
    'liffIds', jsonb_build_object(
      'rollcall', '',
      'spiritualLife', '',
      'selfCheckIn', '',
      'qtOrder', ''
    ),
    'richMenuIds', jsonb_build_object(
      'unbound', '',
      'bound', '',
      'advanced', ''
    ),
    'notifyTokens', jsonb_build_object(
      'administrative', '',
      'checkInOut', ''
    )
  )
) ON CONFLICT (channel_key) DO NOTHING;

INSERT INTO line_bot_rich_menus (
  menu_name, line_rich_menu_id, audience_rule, status, sort_order
)
SELECT seed.menu_name, seed.line_rich_menu_id, seed.audience_rule, seed.status, seed.sort_order
FROM (
  VALUES
    ('未綁定選單', '', jsonb_build_object('type', 'unbound', 'note', '尚未完成會友綁定的 LINE 使用者'), 'draft', 10),
    ('已綁定選單', '', jsonb_build_object('type', 'bound', 'note', '已完成會友綁定的一般會友'), 'draft', 20),
    ('進階選單', '', jsonb_build_object('type', 'advanced', 'note', '具牧養或同工功能入口的會友'), 'draft', 30)
) AS seed(menu_name, line_rich_menu_id, audience_rule, status, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM line_bot_rich_menus existing
  WHERE existing.menu_name = seed.menu_name
    AND existing.audience_rule->>'type' = seed.audience_rule->>'type'
);
