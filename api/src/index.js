require('dotenv').config();

const { createApp } = require('./app');
const { createApiKeyMiddleware } = require('./middleware/api-key');
const { createErrorHandler } = require('./middleware/error-handler');
const { registerAdminSupplyRoutes } = require('./modules/admin-supply/routes');
const { registerAssetRoutes } = require('./modules/asset/routes');
const { registerAuthRoutes } = require('./modules/auth/routes');
const { registerCoreRoutes } = require('./modules/core/routes');
const { registerCounterRoutes } = require('./modules/counter/routes');
const { registerDocumentRoutes } = require('./modules/documents/routes');
const { registerEducationRoutes } = require('./modules/education/routes');
const { registerPastoralRoutes } = require('./modules/pastoral/routes');
const { registerFinanceRoutes } = require('./modules/finance/routes');
const { registerFormsRoutes } = require('./modules/forms/routes');
const { registerLineBotRoutes } = require('./modules/linebot/routes');
const { registerProjectRoutes } = require('./modules/project/routes');
const { registerQrcodeRoutes } = require('./modules/qrcode/routes');
const { registerQtRoutes } = require('./modules/qt/routes');
const { registerShortLinkRoutes } = require('./modules/shortlinks/routes');
const { registerSystemRoutes } = require('./modules/system/routes');
const { registerVenueRoutes } = require('./modules/venue/routes');
const { registerWorkLogRoutes } = require('./modules/worklog/routes');
const { registerZoomRoutes } = require('./modules/zoom/routes');

const app = createApp();

app.use(createApiKeyMiddleware({ publicPaths: ['/health'] }));
registerCoreRoutes(app);
registerAuthRoutes(app);
registerCounterRoutes(app);
registerDocumentRoutes(app);
registerSystemRoutes(app);
registerPastoralRoutes(app);
registerAdminSupplyRoutes(app);
registerAssetRoutes(app);
registerFinanceRoutes(app);
registerFormsRoutes(app);
registerEducationRoutes(app);
registerLineBotRoutes(app);
registerProjectRoutes(app);
registerQrcodeRoutes(app);
registerQtRoutes(app);
registerShortLinkRoutes(app);
registerVenueRoutes(app);
registerWorkLogRoutes(app);
registerZoomRoutes(app);

app.use(createErrorHandler());

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`topchurchplus API listening on ${port}`);
});
