function createErrorHandler() {
  return (err, req, res, next) => {
    console.error(err);
    res.status(400).json({ error: err.message || String(err) });
  };
}

module.exports = { createErrorHandler };
