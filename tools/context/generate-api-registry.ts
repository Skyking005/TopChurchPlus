#!/usr/bin/env node
const { generateApiRegistry } = require('./build-ai-context.ts');

try {
  generateApiRegistry();
  console.log('Generated API registry from route files.');
} catch (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
