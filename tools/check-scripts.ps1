param(
  [switch]$SkipGasCheck
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\setup-utf8.ps1"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

function Resolve-Node {
  $BundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
  if (Test-Path -LiteralPath $BundledNode) {
    return $BundledNode
  }

  $NodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if ($NodeCommand) {
    return $NodeCommand.Source
  }

  throw 'Node.js not found. Install Node.js or run inside the Codex workspace runtime.'
}

$Node = Resolve-Node
Write-Host "Using Node: $Node"

$ApiJsFiles = Get-ChildItem -LiteralPath (Join-Path $ProjectRoot 'api') -Recurse -File |
  Where-Object { $_.Extension -eq '.js' -and $_.FullName -notmatch '\\node_modules\\' }

foreach ($File in $ApiJsFiles) {
  Write-Host "Checking API JS: $($File.FullName.Substring($ProjectRoot.Length + 1))"
  & $Node --check $File.FullName
  if ($LASTEXITCODE -ne 0) {
    throw "Node syntax check failed: $($File.FullName)"
  }
}

$CheckScript = @'
const fs = require('fs');
const vm = require('vm');

const files = process.argv.slice(2);
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const js = file.endsWith('.html')
    ? text.replace(/^\s*<script>\s*/i, '').replace(/\s*<\/script>\s*$/i, '')
    : text;
  new vm.Script(js, { filename: file });
  console.log(`${file} ok`);
}
'@

$ScriptHtmlFiles = Get-ChildItem -LiteralPath $ProjectRoot -File -Filter 'Script_*.html'
if ($ScriptHtmlFiles.Count) {
  Write-Host 'Checking Apps Script HTML partials...'
  & $Node -e $CheckScript @($ScriptHtmlFiles.FullName)
  if ($LASTEXITCODE -ne 0) {
    throw 'Apps Script HTML syntax check failed.'
  }
}

if (-not $SkipGasCheck) {
  $GasFile = Join-Path $ProjectRoot '程式碼.gs'
  if (Test-Path -LiteralPath $GasFile) {
    Write-Host 'Checking Apps Script server file: 程式碼.gs'
    & $Node -e $CheckScript $GasFile
    if ($LASTEXITCODE -ne 0) {
      throw 'Apps Script server syntax check failed.'
    }
  }
}

Write-Host 'Script checks completed.'
