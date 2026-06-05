BEGIN;

INSERT INTO role_feature_permissions (role, feature_key, access_level)
VALUES
  (U&'\8D85\7D1A\7BA1\7406\8005', 'linebot', 'edit'),
  (U&'\7BA1\7406\54E1', 'linebot', 'edit'),
  (U&'\5168\8077\540C\5DE5', 'linebot', 'read')
ON CONFLICT (role, feature_key) DO UPDATE SET
  access_level = EXCLUDED.access_level,
  updated_at = now();

COMMIT;
