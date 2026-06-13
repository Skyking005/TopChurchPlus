#!/usr/bin/env node
const { generateDbRegistry } = require('./build-ai-context.ts');

generateDbRegistry()
  .then(() => console.log('Generated database registry from live PostgreSQL metadata.'))
  .catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  });
