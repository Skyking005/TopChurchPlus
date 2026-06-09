param()

$ErrorActionPreference = 'Continue'

chcp 65001 > $null
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [System.Text.UTF8Encoding]::new()

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$mapPath = Join-Path $PSScriptRoot 'dev-cli-map.json'

function Expand-DevCliPath {
  param([string] $Path)
  if (-not $Path) { return '' }
  $expanded = $Path.Replace('%REPO_ROOT%', $repoRoot.Path)
  [Environment]::ExpandEnvironmentVariables($expanded)
}

$toolMap = Get-Content -LiteralPath $mapPath -Raw -Encoding UTF8 | ConvertFrom-Json
$mappedPathEntries = @($toolMap.pathEntries | ForEach-Object { Expand-DevCliPath $_ } | Where-Object { $_ -and (Test-Path -LiteralPath $_) })
$env:PATH = @($mappedPathEntries; $env:PATH) -join ';'
$commands = $toolMap.commands

$checks = @(
  @{ Name = 'rg'; Command = $commands.rg; Args = @('--version') }
  @{ Name = 'jq'; Command = $commands.jq; Args = @('--version') }
  @{ Name = 'yq'; Command = $commands.yq; Args = @('--version') }
  @{ Name = 'Playwright'; Command = $commands.playwright; Args = @('--version') }
  @{ Name = 'clasp'; Command = $commands.clasp; Args = @('--version') }
  @{ Name = 'ast-grep'; Command = $commands.astGrep; Args = @('--version') }
  @{ Name = 'Repomix'; Command = $commands.repomix; Args = @('--version') }
  @{ Name = 'SQLFluff'; Command = Expand-DevCliPath $commands.sqlfluff; Args = @('--version') }
)

$failed = @()
foreach ($check in $checks) {
  Write-Host "== $($check.Name) =="
  $cmd = Get-Command $check.Command -ErrorAction SilentlyContinue
  if (-not $cmd -and -not (Test-Path -LiteralPath $check.Command)) {
    Write-Host "NOT FOUND"
    $failed += $check.Name
    continue
  }
  try {
    $output = & $check.Command @($check.Args) 2>&1
    $exitCode = $LASTEXITCODE
    $output | Select-Object -First 3
    if ($exitCode -ne 0) { $failed += $check.Name }
  } catch {
    Write-Host $_.Exception.Message
    $failed += $check.Name
  }
}

if ($failed.Count) {
  Write-Error ("Missing or failed tools: " + ($failed -join ', '))
  exit 1
}

Write-Host 'All development CLI tools are available.'
