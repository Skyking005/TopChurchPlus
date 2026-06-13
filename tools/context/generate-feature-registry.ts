#!/usr/bin/env node
const { generateFeatureRegistry } = require('./build-ai-context.ts');

try {
  generateFeatureRegistry();
  console.log('Generated feature registry from Script_FeatureConfig.html.');
} catch (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
