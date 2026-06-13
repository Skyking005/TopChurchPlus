#!/usr/bin/env node
const { generateSystemMap, generateModuleRegistry, generateDependencyRegistry } = require('./build-ai-context.ts');

try {
  generateSystemMap();
  generateModuleRegistry();
  generateDependencyRegistry();
  console.log('Generated system map, module registry, and dependency registry.');
} catch (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
