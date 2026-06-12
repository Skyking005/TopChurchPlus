function createErrorHandler() {
  return (err, req, res, next) => {
    const status = Number(err.statusCode || err.status || 400);
    const requestId = req.requestId || '';
    const message = err.message || String(err);

    console.error(JSON.stringify({
      level: 'error',
      requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      status,
      message,
      stack: err.stack
    }));

    res.status(status).json({
      success: false,
      errorCode: err.errorCode || 'API_ERROR',
      message,
      error: message,
      requestId
    });
  };
}

module.exports = { createErrorHandler };
