const { pool } = require('../../db');
const { assertFeatureReadable } = require('../../shared/permissions');
const { parseUser } = require('../../shared/users');

function registerLineBotRoutes(app) {
  app.get('/linebot/dashboard', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      await assertFeatureReadable(currentUser, 'linebot');
      res.json(await getLineBotDashboard());
    } catch (err) {
      next(err);
    }
  });
}

async function getLineBotDashboard() {
  const [summary, churchStats] = await Promise.all([
    pool.query(
      `SELECT
         (SELECT count(*)::int FROM line_users) AS line_user_count,
         (SELECT count(*)::int FROM pastoral_members WHERE coalesce(line_user_id, '') <> '') AS bound_member_count,
         (SELECT max(last_interaction_at) FROM line_users) AS last_interaction_at`
    ),
    pool.query(
      `SELECT c.id AS church_id, c.name AS church_name,
         count(pm.id)::int AS member_count,
         count(pm.id) FILTER (WHERE coalesce(pm.line_user_id, '') <> '')::int AS bound_count
       FROM churches c
       LEFT JOIN pastoral_members pm ON pm.church_id = c.id AND pm.is_active
       WHERE c.is_active
       GROUP BY c.id, c.name, c.sort_order
       ORDER BY c.sort_order, c.id`
    )
  ]);

  const row = summary.rows[0] || {};
  return {
    lineUserCount: Number(row.line_user_count || 0),
    boundMemberCount: Number(row.bound_member_count || 0),
    lastInteractionAt: row.last_interaction_at,
    churchStats: churchStats.rows.map(item => ({
      churchId: item.church_id,
      churchName: item.church_name,
      memberCount: Number(item.member_count || 0),
      boundCount: Number(item.bound_count || 0)
    })),
    features: [
      { key: 'line_edm', title: 'LINE EDM', description: '分眾推播、訊息範本、排程與發送紀錄', enabled: true },
      { key: 'member_binding', title: 'LINE 會友綁定', description: '綁定狀態、重複綁定與未綁定名單管理', enabled: true },
      { key: 'qt_order', title: 'QT 下單與庫存檢查', description: 'LINE BOT 下單前檢查會堂月庫存', enabled: true },
      { key: 'forms', title: '表單入口', description: '活動報名、問卷填寫與付款流程連結', enabled: true },
      { key: 'venue', title: '場地借用入口', description: '會友端場地申請與狀態通知', enabled: false }
    ]
  };
}

module.exports = { registerLineBotRoutes };
