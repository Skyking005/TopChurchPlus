function createApiKeyMiddleware({ publicPaths = [] } = {}) {
  const publicPathSet = new Set(publicPaths);

  return (req, res, next) => {
    if (publicPathSet.has(req.path)) return next();

    const apiKey = req.get('x-api-key');
    if (!process.env.API_KEY || apiKey !== process.env.API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
  };
}

module.exports = { createApiKeyMiddleware };
