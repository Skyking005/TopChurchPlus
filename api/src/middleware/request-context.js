const crypto = require('crypto');

function createRequestContextMiddleware() {
  return (req, res, next) => {
    // Keep one request id across API response and Docker logs for faster support tracing.
    const requestId = req.get('x-request-id') || crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  };
}

module.exports = { createRequestContextMiddleware };
