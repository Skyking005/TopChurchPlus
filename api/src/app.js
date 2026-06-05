const cors = require('cors');
const express = require('express');
const helmet = require('helmet');

function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '10mb' }));
  return app;
}

module.exports = { createApp };
