function sendSuccess(req, res, data = {}, message = '') {
  res.json({
    success: true,
    data,
    message,
    requestId: req.requestId || ''
  });
}

function createHttpError(status, errorCode, message) {
  const error = new Error(message);
  error.status = status;
  error.errorCode = errorCode;
  return error;
}

module.exports = {
  createHttpError,
  sendSuccess
};
