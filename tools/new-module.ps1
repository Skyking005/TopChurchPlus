param(
  [Parameter(Mandatory = $true)]
  [string]$ModuleName,

  [Parameter(Mandatory = $true)]
  [string]$FeatureKey,

  [string]$Title = '',
  [string]$Description = ''
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\setup-utf8.ps1"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)

function Convert-ToPascalName([string]$Value) {
  return (($Value -split '[-_\s]+' | Where-Object { $_ }) | ForEach-Object {
    $_.Substring(0, 1).ToUpperInvariant() + $_.Substring(1)
  }) -join ''
}

function Convert-ToCamelName([string]$Value) {
  $pascal = Convert-ToPascalName $Value
  return $pascal.Substring(0, 1).ToLowerInvariant() + $pascal.Substring(1)
}

function Decode-Utf8([string]$Base64) {
  return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Base64))
}

function Write-NewUtf8File([string]$Path, [string]$Content) {
  if (Test-Path -LiteralPath $Path) {
    Write-Host "Skip existing file: $Path"
    return
  }

  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }

  [System.IO.File]::WriteAllText($Path, $Content, $Utf8NoBom)
  Write-Host "Created: $Path"
}

$PascalName = Convert-ToPascalName $ModuleName
$CamelName = Convert-ToCamelName $ModuleName
$RouteDirName = ($FeatureKey -replace '_', '-').ToLowerInvariant()
$Today = Get-Date -Format 'yyyyMMdd'
$LabelModule = Decode-Utf8 'IOaooee1hA=='
$LabelDescription = Decode-Utf8 '6KuL5aGr5a+r5q2k5qih57WE55qE5L2/55So55uu55qE6IiH5Li76KaB5pON5L2c44CC'
$LabelRefresh = Decode-Utf8 '6YeN5paw5pW055CG'
$LabelItem = Decode-Utf8 '6aCF55uu'
$LabelStatus = Decode-Utf8 '54uA5oWL'
$LabelLoading = Decode-Utf8 '6LOH5paZ6LyJ5YWl5LitLi4u'
$LabelNoData = Decode-Utf8 '55uu5YmN5rKS5pyJ6LOH5paZ'
$RoleSuperAdmin = Decode-Utf8 '6LaF57Sa566h55CG6ICF'
$RoleAdmin = Decode-Utf8 '566h55CG5ZOh'
$DisplayTitle = if ($Title) { $Title } else { "$PascalName$LabelModule" }
$DisplayDescription = if ($Description) { $Description } else { $LabelDescription }

$html = @"
<section id="${CamelName}View" class="d-none">
  <div class="d-flex justify-content-between align-items-center mb-3">
    <div>
      <h5 class="mb-1">$DisplayTitle</h5>
      <div class="text-muted small">$DisplayDescription</div>
    </div>
    <button type="button" class="btn btn-outline-primary" onclick="load${PascalName}List()">$LabelRefresh</button>
  </div>

  <div id="${CamelName}Error" class="text-danger small mb-2"></div>
  <div class="table-responsive">
    <table class="table table-sm table-hover align-middle">
      <thead>
        <tr>
          <th>$LabelItem</th>
          <th>$LabelStatus</th>
        </tr>
      </thead>
      <tbody id="${CamelName}TableBody"></tbody>
    </table>
  </div>
</section>
"@

$script = @"
<script>
let ${CamelName}Rows = [];

function open${PascalName}System() {
  recordFeatureUsage('$FeatureKey');
  document.getElementById('mainTitle').textContent = '$DisplayTitle';
  hideAllMainViews();
  document.getElementById('${CamelName}View').classList.remove('d-none');
  load${PascalName}List();
}

function load${PascalName}List() {
  setListLoading('${CamelName}TableBody', true, '$LabelLoading');
  document.getElementById('${CamelName}Error').textContent = '';
  google.script.run
    .withSuccessHandler(rows => {
      ${CamelName}Rows = rows || [];
      render${PascalName}List();
    })
    .withFailureHandler(err => {
      document.getElementById('${CamelName}Error').textContent = err.message || err;
      ${CamelName}Rows = [];
      render${PascalName}List();
    })
    .get${PascalName}Rows(currentUser);
}

function render${PascalName}List() {
  const body = document.getElementById('${CamelName}TableBody');
  body.innerHTML = '';
  if (!${CamelName}Rows.length) {
    body.innerHTML = '<tr><td colspan="2" class="text-center text-muted py-4">$LabelNoData</td></tr>';
    return;
  }
  ${CamelName}Rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + escapeHtml(row.name || '') + '</td>' +
      '<td>' + escapeHtml(row.status || '') + '</td>';
    body.appendChild(tr);
  });
}
</script>
"@

$routes = @"
const { pool } = require('../../db');
const { assertFeatureReadable } = require('../../shared/permissions');
const { parseUser } = require('../../shared/users');

function register${PascalName}Routes(app) {
  app.get('/$RouteDirName', async (req, res, next) => {
    try {
      await assertFeatureReadable(parseUser(req), '$FeatureKey');
      res.json(await getRows());
    } catch (err) {
      next(err);
    }
  });
}

async function getRows() {
  return [];
}

module.exports = { register${PascalName}Routes };
"@

$migration = @"
BEGIN;

-- TODO: Add tables, indexes, grants, and role_feature_permissions for $FeatureKey.
-- Keep this migration idempotent with IF NOT EXISTS / ON CONFLICT where possible.

INSERT INTO role_feature_permissions (role, feature_key, access_level)
VALUES
  ('$RoleSuperAdmin', '$FeatureKey', 'edit'),
  ('$RoleAdmin', '$FeatureKey', 'edit')
ON CONFLICT (role, feature_key) DO UPDATE SET access_level = EXCLUDED.access_level;

COMMIT;
"@

$bridge = @"
function get${PascalName}Rows(currentUser) {
  return apiRequest('get', '/$RouteDirName', null, null, currentUser);
}
"@

Write-NewUtf8File (Join-Path $ProjectRoot "$PascalName.html") $html
Write-NewUtf8File (Join-Path $ProjectRoot "Script_$PascalName.html") $script
Write-NewUtf8File (Join-Path $ProjectRoot "api\src\modules\$RouteDirName\routes.js") $routes
Write-NewUtf8File (Join-Path $ProjectRoot "database\${Today}_${RouteDirName}.sql") $migration
Write-NewUtf8File (Join-Path $ProjectRoot "tmp\${PascalName}_bridge.gs.txt") $bridge

Write-Host ''
Write-Host 'Next manual steps:'
Write-Host "1. Add include('$PascalName') and include('Script_$PascalName') in Index.html."
Write-Host "2. Add $FeatureKey to api/src/modules/core/catalog.js and Script_Login.html."
Write-Host "3. Register register${PascalName}Routes(app) in api/src/index.js."
Write-Host "4. Move tmp/${PascalName}_bridge.gs.txt into the Apps Script bridge file after reviewing the bridge function."
Write-Host "5. Review the migration, back up PostgreSQL, then execute it."
