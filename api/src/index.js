require('dotenv').config();

const { createApp } = require('./app');
const { createApiKeyMiddleware } = require('./middleware/api-key');
const { createErrorHandler } = require('./middleware/error-handler');
const { registerAssetRoutes } = require('./modules/asset/routes');
const { registerAuthRoutes } = require('./modules/auth/routes');
const { registerCoreRoutes } = require('./modules/core/routes');
const { registerPastoralRoutes } = require('./modules/pastoral/routes');
const { registerFinanceRoutes } = require('./modules/finance/routes');
const { registerFormsRoutes } = require('./modules/forms/routes');
const { registerProjectRoutes } = require('./modules/project/routes');
const { registerSystemRoutes } = require('./modules/system/routes');
const { registerVenueRoutes } = require('./modules/venue/routes');

const app = createApp();

app.use(createApiKeyMiddleware({ publicPaths: ['/health'] }));
registerCoreRoutes(app);
registerAuthRoutes(app);
registerSystemRoutes(app);
registerPastoralRoutes(app);
registerAssetRoutes(app);
registerFinanceRoutes(app);
registerFormsRoutes(app);
registerProjectRoutes(app);
registerVenueRoutes(app);

app.use(createErrorHandler());

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`topchurchplus API listening on ${port}`);
});
