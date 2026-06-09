BEGIN;

UPDATE line_bot_module_settings
SET module_name = seed.module_name,
    description = seed.description,
    updated_at = now()
FROM (
  VALUES
    ('line_edm', 'LINE EDM', '分眾訊息、圖文素材、回應內容與發送紀錄'),
    ('member_binding', 'LINE 會友綁定', '綁定狀態、重複綁定與未綁定名單管理'),
    ('qt_order', 'QT 下單與庫存檢查', '會友端 QT 訂購前檢查會堂月庫存'),
    ('forms', '表單入口', '活動報名、問卷填寫與付款流程連結'),
    ('qrcode', 'QR Code 報到', '會友端 QR Code 與活動報到流程'),
    ('venue', '場地借用入口', '會友端場地申請與狀態通知'),
    ('education', '教育課程查詢', '個人課程狀態與可報名課程查詢')
) AS seed(module_key, module_name, description)
WHERE line_bot_module_settings.module_key = seed.module_key;

UPDATE line_bot_rich_menus
SET audience_rule = audience_rule
  || jsonb_build_object(
    'actionType', coalesce(audience_rule->>'actionType', 'open_liff'),
    'promptTitle', coalesce(nullif(audience_rule->>'promptTitle', ''), '卓越行道會 Line App'),
    'targetUrl', coalesce(nullif(audience_rule->>'targetUrl', ''), '/liff'),
    'prompts', jsonb_build_object(
      'unbound', coalesce(audience_rule->'prompts'->>'unbound', '請先以姓名與手機號碼完成會友綁定，即可使用個人化會友服務。'),
      'bound', coalesce(audience_rule->'prompts'->>'bound', '請選擇您要使用的 Line App 會友服務。')
    )
  ),
  updated_at = now()
WHERE audience_rule ? 'type';

COMMIT;
