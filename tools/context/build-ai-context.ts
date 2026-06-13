#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const API_MODULES_DIR = path.join(ROOT, 'api', 'src', 'modules');
const ARCH_DIR = path.join(ROOT, 'docs', 'architecture');
const DB_DOC_DIR = path.join(ROOT, 'docs', 'database');
const AI_CONTEXT_DIR = path.join(ROOT, 'ai-context');

function readText(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function writeText(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.replace(/\r\n/g, '\n'), 'utf8');
}

function listFiles(dir, predicate = () => true) {
  if (!fs.existsSync(dir)) return [];
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...listFiles(full, predicate));
    else if (predicate(full)) result.push(full);
  }
  return result.sort((a, b) => a.localeCompare(b));
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function safeGitHead() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'UNKNOWN';
  }
}

function today() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function tableEscape(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function codeList(values) {
  return values && values.length ? values.map((value) => '`' + value + '`').join(', ') : 'None found';
}

function readEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line) || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function moduleRules() {
  return [
    ['auth', [/^login_/, /^trusted_login_/, /^counter_pin_codes$/]],
    ['system', [/^accounts$/, /^account_roles$/, /^departments$/, /^role_feature_permissions$/, /^params$/, /^param_/, /^id_rules$/, /^system_/, /^audit_logs$/]],
    ['pastoral', [/^pastoral_/, /^churches$/, /^countries$/, /^regions$/, /^professions$/, /^membership_/, /^marital_/, /^relationship_/, /^baptism_/, /^account_pastoral_/]],
    ['linebot_liff', [/^line_/, /^member_accounts$/, /^identity_providers$/, /^notification_/, /^menu_items$/, /^attendance_summary$/, /^course_summary$/]],
    ['project_meeting', [/^projects$/, /^project_/, /^meetings$/]],
    ['finance', [/^purchases$/, /^purchase_/]],
    ['forms_counter', [/^forms$/, /^form_/, /^counter_transactions$/]],
    ['shortlinks', [/^short_link/]],
    ['qt', [/^qt_/]],
    ['asset', [/^asset/, /^assets$/]],
    ['admin_supply', [/^admin_supply/]],
    ['venue_zoom', [/^venue_/, /^zoom_/]],
    ['attendance', [/^attendance_/]],
    ['education', [/^education_/]],
    ['qrcode', [/^qrcode_/]],
    ['sunday_message', [/^sunday_/]],
    ['workflow', [/^bpm_/]],
    ['mail', [/^mail_/]],
    ['dev_management', [/^development_/]],
    ['worklog', [/^work_logs$/]],
    ['files_core', [/^files$/, /^file_links$/, /^entity_links$/, /^domain_events$/]]
  ];
}

function moduleFor(name) {
  for (const [mod, rules] of moduleRules()) {
    if (rules.some((rule) => rule.test(name))) return mod;
  }
  return 'unknown';
}

function purposeFor(name) {
  const exact = {
    accounts: 'Administrative account master records.',
    account_roles: 'Administrative account role mapping.',
    departments: 'Department master data.',
    role_feature_permissions: 'Feature access permission mapping by role.',
    params: 'Legacy parameter records.',
    param_categories: 'Parameter category master data.',
    param_items: 'Parameter item master data.',
    id_rules: 'Configurable entity ID generation rules.',
    system_config: 'Legacy flat system configuration.',
    system_config_keys: 'Centralized configurable key/value settings.',
    audit_logs: 'Cross-module audit log.',
    system_usage_logs: 'System usage tracking.',
    pastoral_members: 'Formal pastoral member master records.',
    churches: 'Church/campus master data.',
    member_accounts: 'Bridge between pastoral members and account identities.',
    line_users: 'LINE user identity records.',
    line_liff_sessions: 'LIFF session records.',
    line_binding_requests: 'LINE-to-member binding approval workflow.',
    projects: 'Project master records.',
    meetings: 'Project-linked and independent meeting records.',
    purchases: 'Finance purchase/request master records.',
    forms: 'Form definition master records.',
    form_responses: 'Submitted form response master records.',
    counter_transactions: 'Counter transaction records.',
    qt_orders: 'QT order master records.',
    qt_order_items: 'QT order item records.',
    qt_payment_types: 'QT payment type options.',
    qt_price_plans: 'QT price plans.',
    qt_product_types: 'QT product type master data.',
    qt_inventory_monthly: 'QT monthly physical/reserved/retail inventory records.',
    qt_inventory_reservations: 'QT inventory reservation records.',
    qt_inventory_movements: 'QT inventory movement and log records.',
    mail_queue: 'Queued email delivery records.',
    mail_quota_snapshots: 'Mail quota monitoring snapshots.',
    bpm_definitions: 'Workflow/BPM definition records.',
    bpm_instances: 'Workflow/BPM instance records.',
    bpm_history: 'Workflow/BPM history events.',
    files: 'Uploaded/generated file metadata.',
    file_links: 'Entity-to-file link records.',
    entity_links: 'Cross-system entity links.',
    domain_events: 'Cross-system domain event records.'
  };
  if (exact[name]) return exact[name];
  if (name.startsWith('pastoral_member_')) return 'Pastoral member sub-records.';
  if (name.startsWith('pastoral_group')) return 'Pastoral group structure records.';
  if (name.startsWith('line_bot_')) return 'LINE Bot administration and runtime records.';
  if (name.startsWith('purchase_')) return 'Finance purchase detail records.';
  if (name.startsWith('project_')) return 'Project detail or permission records.';
  if (name.startsWith('form_')) return 'Form question, answer, response, or attachment records.';
  if (name.startsWith('asset_') || name === 'assets') return 'Asset management records.';
  if (name.startsWith('admin_supply_')) return 'Administrative supply inventory records.';
  if (name.startsWith('venue_')) return 'Venue reservation records.';
  if (name.startsWith('zoom_')) return 'Zoom account reservation records.';
  if (name.startsWith('attendance_')) return 'Attendance statistics records.';
  if (name.startsWith('education_')) return 'Education/course records.';
  if (name.startsWith('qrcode_')) return 'QRCode event/check-in records.';
  if (name.startsWith('sunday_')) return 'Sunday message records.';
  if (name.startsWith('development_')) return 'Development management records.';
  return 'Purpose not inferred from naming; verify application usage before changes.';
}

function scanApiRoutes() {
  const files = listFiles(API_MODULES_DIR, (file) => /routes\.js$|webhook\.js$/.test(file));
  const routes = [];
  const pattern = /\b(?:app|router)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
  for (const file of files) {
    const text = readText(file);
    let match;
    while ((match = pattern.exec(text))) {
      routes.push({
        module: rel(file).split('/')[3] || 'unknown',
        method: match[1].toUpperCase(),
        path: match[2],
        source: rel(file)
      });
    }
  }
  return routes.sort((a, b) => `${a.module} ${a.path} ${a.method}`.localeCompare(`${b.module} ${b.path} ${b.method}`));
}

function scanFeatures() {
  const text = readText(path.join(ROOT, 'Script_FeatureConfig.html'));
  const features = [];
  const objectPattern = /\{[^{}]*key:\s*'([^']+)'[^{}]*title:\s*'([^']+)'[^{}]*(?:desc|description):\s*'([^']*)'[^{}]*action:\s*'([^']+)'[^{}]*\}/g;
  let match;
  while ((match = objectPattern.exec(text))) {
    features.push({ key: match[1], title: match[2], description: match[3], action: match[4] });
  }
  return features;
}

function scanModuleFiles() {
  const htmlFiles = listFiles(ROOT, (file) => path.dirname(file) === ROOT && /\.html$/.test(file)).map((file) => path.basename(file));
  const apiModules = fs.existsSync(API_MODULES_DIR)
    ? fs.readdirSync(API_MODULES_DIR, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
    : [];
  return { htmlFiles, apiModules };
}

async function scanDatabase() {
  const env = readEnvFile(path.join(ROOT, 'api', '.env'));
  const databaseUrl = process.env.DATABASE_URL || env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL not found in environment or api/.env');
  const { Pool } = require(path.join(ROOT, 'api', 'node_modules', 'pg'));
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const client = await pool.connect();
  try {
    const db = await client.query('select current_database() as db, current_schema() as schema');
    const tables = (await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog','information_schema') AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name`)).rows;
    const views = (await client.query(`
      SELECT table_schema, table_name AS view_name, view_definition
      FROM information_schema.views
      WHERE table_schema NOT IN ('pg_catalog','information_schema')
      ORDER BY table_schema, table_name`)).rows;
    const pks = (await client.query(`
      SELECT tc.table_schema, tc.table_name, kcu.column_name, kcu.ordinal_position
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
      WHERE tc.constraint_type='PRIMARY KEY' AND tc.table_schema NOT IN ('pg_catalog','information_schema')
      ORDER BY tc.table_schema, tc.table_name, kcu.ordinal_position`)).rows;
    const fks = (await client.query(`
      SELECT tc.constraint_schema, tc.constraint_name, tc.table_schema, tc.table_name,
             kcu.column_name, ccu.table_schema AS foreign_table_schema,
             ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name,
             rc.update_rule, rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name AND ccu.constraint_schema=tc.constraint_schema
      JOIN information_schema.referential_constraints rc ON rc.constraint_name=tc.constraint_name AND rc.constraint_schema=tc.constraint_schema
      WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema NOT IN ('pg_catalog','information_schema')
      ORDER BY tc.table_schema, tc.table_name, tc.constraint_name, kcu.ordinal_position`)).rows;
    const indexes = (await client.query(`
      SELECT schemaname, tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname NOT IN ('pg_catalog','information_schema')
      ORDER BY schemaname, tablename, indexname`)).rows;
    const funcs = (await client.query(`
      SELECT n.nspname AS schema_name, p.proname AS function_name,
             pg_get_function_identity_arguments(p.oid) AS arguments,
             pg_get_function_result(p.oid) AS result_type,
             l.lanname AS language,
             p.prokind
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_language l ON l.oid = p.prolang
      WHERE n.nspname NOT IN ('pg_catalog','information_schema')
      ORDER BY n.nspname, p.proname, arguments`)).rows;
    return { database: db.rows[0].db, tables, views, pks, fks, indexes, funcs };
  } finally {
    client.release();
    await pool.end();
  }
}

function makeMaps(db) {
  const pkMap = new Map();
  for (const row of db.pks) {
    const key = `${row.table_schema}.${row.table_name}`;
    if (!pkMap.has(key)) pkMap.set(key, []);
    pkMap.get(key).push(row.column_name);
  }
  const fkMap = new Map();
  for (const row of db.fks) {
    const key = `${row.table_schema}.${row.table_name}`;
    if (!fkMap.has(key)) fkMap.set(key, []);
    fkMap.get(key).push(`${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name}`);
  }
  const indexMap = new Map();
  for (const row of db.indexes) {
    const key = `${row.schemaname}.${row.tablename}`;
    if (!indexMap.has(key)) indexMap.set(key, []);
    indexMap.get(key).push(row.indexname);
  }
  return { pkMap, fkMap, indexMap };
}

function generatedHeader(title, source = 'Generated from repository inspection') {
  return `# TopChurchPlus ${title}\n\nStatus: Auto-generated\nSource: ${source}\nGenerated by: tools/context/build-ai-context.ts\n\nDo not edit by hand. Regenerate with tools/context/build-ai-context.ts.\n\n`;
}

async function generateDbRegistry() {
  const db = await scanDatabase();
  const { pkMap, fkMap, indexMap } = makeMaps(db);
  let tableMd = generatedHeader('Table Catalog', 'live PostgreSQL metadata via pg_catalog / information_schema');
  tableMd += `Database: ${db.database}\nSchema scope: non-system PostgreSQL schemas\n\n## Table Inventory\n\n| Schema | Table | Module | Purpose | Primary Key | Foreign Keys | Indexes |\n| --- | --- | --- | --- | --- | --- | --- |\n`;
  for (const table of db.tables) {
    const key = `${table.table_schema}.${table.table_name}`;
    tableMd += `| ${tableEscape(table.table_schema)} | \`${tableEscape(table.table_name)}\` | ${tableEscape(moduleFor(table.table_name))} | ${tableEscape(purposeFor(table.table_name))} | ${codeList(pkMap.get(key))} | ${codeList(fkMap.get(key))} | ${codeList(indexMap.get(key))} |\n`;
  }
  writeText(path.join(DB_DOC_DIR, 'TABLE_CATALOG.md'), tableMd);

  let viewMd = generatedHeader('View Catalog', 'live PostgreSQL metadata via information_schema.views');
  viewMd += `Database: ${db.database}\nSchema scope: non-system PostgreSQL schemas\n\n`;
  if (!db.views.length) viewMd += 'No user-defined views were found in non-system schemas.\n';
  else {
    viewMd += '| Schema | View | Module | Definition Preview |\n| --- | --- | --- | --- |\n';
    for (const view of db.views) {
      viewMd += `| ${tableEscape(view.table_schema)} | \`${tableEscape(view.view_name)}\` | ${tableEscape(moduleFor(view.view_name))} | ${tableEscape((view.view_definition || '').slice(0, 300))} |\n`;
    }
  }
  writeText(path.join(DB_DOC_DIR, 'VIEW_CATALOG.md'), viewMd);

  let funcMd = generatedHeader('Function Catalog', 'live PostgreSQL metadata via pg_proc');
  funcMd += `Database: ${db.database}\nSchema scope: non-system PostgreSQL schemas\n\n`;
  if (!db.funcs.length) funcMd += 'No user-defined functions or procedures were found in non-system schemas.\n';
  else {
    funcMd += 'Note: functions in `public` may include PostgreSQL extension functions. Verify before treating them as business logic.\n\n';
    funcMd += '| Schema | Name | Type | Arguments | Result | Language | Module |\n| --- | --- | --- | --- | --- | --- | --- |\n';
    for (const fn of db.funcs) {
      const type = fn.prokind === 'p' ? 'procedure' : fn.prokind === 'a' ? 'aggregate' : fn.prokind === 'w' ? 'window' : 'function';
      funcMd += `| ${tableEscape(fn.schema_name)} | \`${tableEscape(fn.function_name)}\` | ${type} | ${tableEscape(fn.arguments)} | ${tableEscape(fn.result_type)} | ${tableEscape(fn.language)} | ${tableEscape(moduleFor(fn.function_name))} |\n`;
    }
  }
  writeText(path.join(DB_DOC_DIR, 'FUNCTION_CATALOG.md'), funcMd);

  let indexMd = generatedHeader('Index Catalog', 'live PostgreSQL metadata via pg_indexes');
  indexMd += `Database: ${db.database}\nSchema scope: non-system PostgreSQL schemas\n\n| Schema | Table | Index | Module | Definition |\n| --- | --- | --- | --- | --- |\n`;
  for (const index of db.indexes) {
    indexMd += `| ${tableEscape(index.schemaname)} | \`${tableEscape(index.tablename)}\` | \`${tableEscape(index.indexname)}\` | ${tableEscape(moduleFor(index.tablename))} | ${tableEscape(index.indexdef)} |\n`;
  }
  writeText(path.join(DB_DOC_DIR, 'INDEX_CATALOG.md'), indexMd);

  let relMd = generatedHeader('Relationship Catalog', 'live PostgreSQL metadata via information_schema constraints');
  relMd += `Database: ${db.database}\nSchema scope: non-system PostgreSQL schemas\n\n`;
  if (!db.fks.length) relMd += 'No foreign key relationships were found in non-system schemas.\n';
  else {
    relMd += '## Foreign Keys\n\n| Constraint | From | Column | To | Referenced Column | On Update | On Delete | Module |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n';
    for (const fk of db.fks) {
      relMd += `| \`${tableEscape(fk.constraint_name)}\` | \`${tableEscape(fk.table_name)}\` | \`${tableEscape(fk.column_name)}\` | \`${tableEscape(fk.foreign_table_name)}\` | \`${tableEscape(fk.foreign_column_name)}\` | ${tableEscape(fk.update_rule)} | ${tableEscape(fk.delete_rule)} | ${tableEscape(moduleFor(fk.table_name))} |\n`;
    }
  }
  relMd += '\n## Relationship Notes\n\n* This catalog lists PostgreSQL-enforced foreign keys only. Application-level relationships may exist without FK constraints.\n* Identity Boundary v2 still applies: Pastoral Domain relationships must not be inferred from administrative roles alone.\n';
  writeText(path.join(DB_DOC_DIR, 'RELATIONSHIP_CATALOG.md'), relMd);

  const moduleCounts = new Map();
  for (const table of db.tables) {
    const owner = moduleFor(table.table_name);
    moduleCounts.set(owner, (moduleCounts.get(owner) || 0) + 1);
  }
  let archDbMd = generatedHeader('Database Registry', 'live PostgreSQL metadata summarized from docs/database catalogs');
  archDbMd += `Database: ${db.database}\n\n## Summary\n\n| Object Type | Count |\n| --- | --- |\n| Tables | ${db.tables.length} |\n| Views | ${db.views.length} |\n| Functions | ${db.funcs.length} |\n| Indexes | ${db.indexes.length} |\n| Foreign Keys | ${db.fks.length} |\n\n`;
  archDbMd += '## Table Ownership Summary\n\n| Module | Table Count |\n| --- | --- |\n';
  for (const [owner, count] of [...moduleCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    archDbMd += `| ${tableEscape(owner)} | ${count} |\n`;
  }
  archDbMd += '\n## Authoritative Catalogs\n\n* `docs/database/TABLE_CATALOG.md`\n* `docs/database/VIEW_CATALOG.md`\n* `docs/database/FUNCTION_CATALOG.md`\n* `docs/database/INDEX_CATALOG.md`\n* `docs/database/RELATIONSHIP_CATALOG.md`\n\n## Safety Notes\n\n* This file is an index. Use the database catalogs for table, index, and FK details.\n* No schema changes are performed by the generator.\n* Live DB metadata may include extension functions; verify before treating functions as business logic.\n';
  writeText(path.join(ARCH_DIR, 'DATABASE_REGISTRY.md'), archDbMd);
  return db;
}

function generateApiRegistry() {
  const routes = scanApiRoutes();
  const byModule = new Map();
  for (const route of routes) {
    if (!byModule.has(route.module)) byModule.set(route.module, []);
    byModule.get(route.module).push(route);
  }
  let md = generatedHeader('API Registry', 'api/src/modules route scan');
  md += '## Public Boundary\n\n`api/src/index.js` configures public paths `/health`, `/linebot/webhook`, and public prefix `/liff`.\n\n## API Inventory\n\n';
  for (const moduleName of [...byModule.keys()].sort()) {
    md += `### ${moduleName}\n\n| Method | Path | Source |\n| --- | --- | --- |\n`;
    for (const route of byModule.get(moduleName)) {
      md += `| ${route.method} | \`${tableEscape(route.path)}\` | \`${route.source}\` |\n`;
    }
    md += '\n';
  }
  writeText(path.join(ARCH_DIR, 'API_REGISTRY.md'), md);
  return routes;
}

function inferUiPartial(featureKey) {
  const map = {
    project: 'ProjectDetail.html',
    meeting: 'Meetings.html',
    finance: 'Purchase.html',
    admin_supply: 'AdminSupply.html',
    asset: 'Asset.html',
    system: 'ParameterModal.html',
    dev_management: 'DevManagement.html',
    venue: 'Venue.html',
    zoom: 'Zoom.html',
    sunday_message: 'SundayMessage.html',
    forms: 'Forms.html',
    counter: 'Counter.html',
    qrcode: 'Qrcode.html',
    qt: 'Qt.html',
    linebot: 'LineBot.html',
    email_service: 'EmailService.html',
    pastoral: 'Pastoral.html',
    education: 'Education.html',
    attendance: 'Attendance.html'
  };
  return map[featureKey] || 'Not found';
}

function inferApiModule(featureKey) {
  const map = {
    project: 'project, documents',
    meeting: 'project',
    finance: 'finance, documents',
    admin_supply: 'admin-supply',
    asset: 'asset',
    system: 'system',
    dev_management: 'dev-management',
    venue: 'venue',
    zoom: 'zoom',
    sunday_message: 'sunday-message',
    forms: 'forms, shortlinks',
    counter: 'counter, auth',
    qrcode: 'qrcode',
    qt: 'qt',
    linebot: 'linebot, liff',
    email_service: 'mail',
    pastoral: 'pastoral',
    education: 'education',
    attendance: 'attendance'
  };
  return map[featureKey] || 'Not found';
}

function generateFeatureRegistry() {
  const features = scanFeatures();
  let md = generatedHeader('Feature Registry', 'Script_FeatureConfig.html and module file scan');
  md += '## Feature-to-Module Mapping\n\n| Feature Key | Display Name | Action | UI Partial | API Module | Status |\n| --- | --- | --- | --- | --- | --- |\n';
  for (const feature of features) {
    const ui = inferUiPartial(feature.key);
    const api = inferApiModule(feature.key);
    const status = api === 'Not found' ? 'Coming soon / configured only' : 'Active';
    md += `| \`${tableEscape(feature.key)}\` | ${tableEscape(feature.title)} | \`${tableEscape(feature.action)}\` | \`${tableEscape(ui)}\` | ${tableEscape(api)} | ${status} |\n`;
  }
  md += '\n## Notes\n\n* Feature visibility is configured in `Script_FeatureConfig.html`.\n* API permission checks must still be verified in backend routes; do not rely only on frontend hiding.\n* `media`, `worship`, and `serving` are configured as coming-soon entries if no API module is found.\n';
  writeText(path.join(ARCH_DIR, 'FEATURE_REGISTRY.md'), md);
  return features;
}

function generateSystemMap() {
  const modules = scanModuleFiles();
  let md = generatedHeader('System Map', 'repository structure and entrypoint scan');
  md += `## Architecture\n\n\`\`\`text\nBrowser\n  -> Google Apps Script Web App\n    -> Index.html + HTML partials\n    -> Script_*.html controllers\n      -> Apps Script bridge\n        -> NAS Node.js Express API\n          -> PostgreSQL\n\`\`\`\n\n`;
  md += '## Runtime Layers\n\n| Layer | Evidence | Status |\n| --- | --- | --- |\n';
  md += '| Apps Script shell | `Index.html` | Active |\n';
  md += '| UI partials | root `*.html`, `Script_*.html` | Active |\n';
  md += '| API server | `api/src/index.js`, `api/src/app.js` | Active |\n';
  md += '| API modules | `api/src/modules/*` | Active |\n';
  md += '| Shared services | `api/src/shared/*` | Active |\n';
  md += '| Database | `database/*.sql`, live PostgreSQL | Active |\n\n';
  md += '## API Modules\n\n' + modules.apiModules.map((name) => `* \`${name}\``).join('\n') + '\n\n';
  md += '## Frontend Partials\n\n' + modules.htmlFiles.map((name) => `* \`${name}\``).join('\n') + '\n\n';
  md += '## Guardrails\n\n* Preserve Identity Boundary v2.\n* Do not test external direct port `59.120.6.172:3000`.\n* Use `https://api.topchurchplus.com/health` for official external health checks.\n* Do not deploy unless explicitly requested.\n';
  writeText(path.join(ARCH_DIR, 'SYSTEM_MAP.md'), md);
}

function generateModuleRegistry() {
  const modules = scanModuleFiles();
  const features = scanFeatures();
  let md = generatedHeader('Module Registry', 'feature config, frontend files, and API module scan');
  md += '## Module Ownership Table\n\n| Feature Key | Display Name | UI Partial | API Module | Status |\n| --- | --- | --- | --- | --- |\n';
  for (const feature of features) {
    const ui = inferUiPartial(feature.key);
    const api = inferApiModule(feature.key);
    const status = api === 'Not found' ? 'Coming soon / configured only' : 'Active';
    md += `| \`${tableEscape(feature.key)}\` | ${tableEscape(feature.title)} | \`${tableEscape(ui)}\` | ${tableEscape(api)} | ${status} |\n`;
  }
  md += '\n## API Module Directories\n\n' + modules.apiModules.map((name) => `* \`${name}\``).join('\n') + '\n';
  writeText(path.join(ARCH_DIR, 'MODULE_REGISTRY.md'), md);
}

function generateDependencyRegistry() {
  const rootPkg = JSON.parse(readText(path.join(ROOT, 'package.json')) || '{}');
  const apiPkg = JSON.parse(readText(path.join(ROOT, 'api', 'package.json')) || '{}');
  let md = generatedHeader('Dependency Registry', 'package manifests and source inspection');
  md += '## API Runtime Dependencies\n\n| Package | Version |\n| --- | --- |\n';
  for (const [name, version] of Object.entries(apiPkg.dependencies || {})) md += `| \`${name}\` | ${version} |\n`;
  md += '\n## Root Development Dependencies\n\n| Package | Version |\n| --- | --- |\n';
  for (const [name, version] of Object.entries(rootPkg.devDependencies || {})) md += `| \`${name}\` | ${version} |\n`;
  md += '\n## Internal Shared Dependencies\n\n* `api/src/shared/audit.js`\n* `api/src/shared/config-service.js`\n* `api/src/shared/permissions.js`\n* `api/src/shared/users.js`\n* `api/src/shared/files.js`\n* `api/src/shared/id-rules.js`\n* `api/src/shared/params.js`\n* `api/src/shared/cross-system.js`\n';
  writeText(path.join(ARCH_DIR, 'DEPENDENCY_REGISTRY.md'), md);
}

async function generateArchitectureRegistry() {
  generateSystemMap();
  generateModuleRegistry();
  generateApiRegistry();
  generateFeatureRegistry();
  generateDependencyRegistry();
}

function generateAiContext(db) {
  const routes = scanApiRoutes();
  const features = scanFeatures();
  const modules = scanModuleFiles();
  writeText(path.join(AI_CONTEXT_DIR, 'CURRENT_SYSTEM_STATE.md'), `# TopChurchPlus Current System State

Mode: Auto-generated AI-readable snapshot
Generated by: tools/context/build-ai-context.ts

## Architecture

\`\`\`text
Browser -> Google Apps Script Web App -> Apps Script bridge -> NAS Node.js Express API -> PostgreSQL
LINE / LIFF -> https://api.topchurchplus.com -> Express public routes -> PostgreSQL
\`\`\`

## Runtime Layers

* Frontend shell: \`Index.html\`
* Frontend modules: root HTML partials and \`Script_*.html\`
* API server: \`api/src/index.js\`
* API modules: ${modules.apiModules.length}
* Database tables: ${db ? db.tables.length : 'UNKNOWN'}
* API routes scanned: ${routes.length}

## Guardrails

* Preserve Identity Boundary v2.
* Do not modify schema, payment, fulfillment, Line Bot webhook, transfer, forecast, or infrastructure without explicit scope.
* Official external health: \`https://api.topchurchplus.com/health\`.
* Do not test \`59.120.6.172:3000\`.
`);
  writeText(path.join(AI_CONTEXT_DIR, 'CURRENT_DATABASE_STATE.md'), `# TopChurchPlus Current Database State

Mode: Auto-generated from live PostgreSQL metadata
Generated by: tools/context/build-ai-context.ts

## Summary

* Database: ${db ? db.database : 'UNKNOWN'}
* Tables: ${db ? db.tables.length : 'UNKNOWN'}
* Views: ${db ? db.views.length : 'UNKNOWN'}
* Functions: ${db ? db.funcs.length : 'UNKNOWN'}
* Indexes: ${db ? db.indexes.length : 'UNKNOWN'}
* Foreign keys: ${db ? db.fks.length : 'UNKNOWN'}

## Primary Catalogs

* \`docs/database/TABLE_CATALOG.md\`
* \`docs/database/VIEW_CATALOG.md\`
* \`docs/database/FUNCTION_CATALOG.md\`
* \`docs/database/INDEX_CATALOG.md\`
* \`docs/database/RELATIONSHIP_CATALOG.md\`

## Safety

Do not run migrations or schema changes without explicit authorization. Verify live DB before changes.
`);
  writeText(path.join(AI_CONTEXT_DIR, 'CURRENT_FEATURE_STATUS.md'), `# TopChurchPlus Current Feature Status

Mode: Auto-generated from feature config and module scan
Generated by: tools/context/build-ai-context.ts

## Feature Count

Configured features: ${features.length}

## Features

| Key | Title | Action | API Module |
| --- | --- | --- | --- |
${features.map((feature) => `| \`${tableEscape(feature.key)}\` | ${tableEscape(feature.title)} | \`${tableEscape(feature.action)}\` | ${tableEscape(inferApiModule(feature.key))} |`).join('\n')}

## Notes

Use \`docs/architecture/FEATURE_REGISTRY.md\` for the generated feature-to-module catalog.
`);
  writeText(path.join(AI_CONTEXT_DIR, 'CURRENT_ACTIVE_PHASE.md'), `# TopChurchPlus Current Active Phase

Mode: Auto-generated from repo state and known active planning files
Generated by: tools/context/build-ai-context.ts

## Current Macro Phase

Phase 2: Core system build-out, data migration readiness, and module hardening.

## Active Focus

* Keep AI context synchronized with source code.
* Maintain Architecture Registry and Database Catalog as generated artifacts.
* Continue QT work only with explicit scoped requests.
* Maintain Mail Queue and Config Key Management boundaries.

## QT Boundary

Current code has QT inventory monthly records, reservations, payment approval route, and same-church fulfillment route. Do not assume cross-church transfer, Line Bot QT selling, forecast, or legacy backfill are complete.

## Automation Entry Point

Run:

\`\`\`powershell
node tools/context/build-ai-context.ts
\`\`\`
`);
}

async function buildAll() {
  await generateArchitectureRegistry();
  const db = await generateDbRegistry();
  generateAiContext(db);
  return {
    architectureDir: rel(ARCH_DIR),
    databaseDir: rel(DB_DOC_DIR),
    aiContextDir: rel(AI_CONTEXT_DIR)
  };
}

async function main() {
  const result = await buildAll();
  console.log(JSON.stringify(result, null, 2));
}

module.exports = {
  scanApiRoutes,
  scanFeatures,
  scanModuleFiles,
  scanDatabase,
  generateSystemMap,
  generateModuleRegistry,
  generateApiRegistry,
  generateFeatureRegistry,
  generateDependencyRegistry,
  generateArchitectureRegistry,
  generateDbRegistry,
  generateAiContext,
  buildAll
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  });
}
