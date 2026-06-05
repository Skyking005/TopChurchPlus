const { getEntityLinks } = require('../../shared/cross-system');
const { parseUser } = require('../../shared/users');

function registerCoreRoutes(app) {
  app.get('/health', (req, res) => {
    res.json({ ok: true });
  });

  app.get('/entity-links', async (req, res, next) => {
    try {
      const currentUser = parseUser(req);
      if (!currentUser || !currentUser.name) throw new Error('缺少登入者資訊');
      res.json(await getEntityLinks({
        system: req.query.system,
        type: req.query.type,
        id: req.query.id
      }));
    } catch (err) {
      next(err);
    }
  });
}

module.exports = { registerCoreRoutes };
