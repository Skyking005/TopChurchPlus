const cors = require('cors');
const express = require('express');
const helmet = require('helmet');

function createApp() {
  const app = express();
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://static.line-scdn.net'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://api.line.me'],
        frameAncestors: ["'self'", 'https://liff.line.me', 'https://*.line.me']
      }
    }
  }));
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '15mb' }));
  return app;
}

module.exports = { createApp };
