param()

$ErrorActionPreference = 'Continue'

chcp 65001 > $null
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [System.Text.UTF8Encoding]::new()

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$winGetPackageRoot = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
$winGetPackagePaths = @()
if (Test-Path -LiteralPath $winGetPackageRoot) {
  $winGetPackagePaths = Get-ChildItem -LiteralPath $winGetPackageRoot -Directory -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty FullName
}
$env:PATH = @(
  'C:\Program Files\nodejs'
  (Join-Path $repoRoot 'node_modules\.bin')
  (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links')
  $winGetPackagePaths
  $env:PATH
) -join ';'

$checks = @(
  @{ Name = 'rg'; Command = 'rg'; Args = @('--version') }
  @{ Name = 'jq'; Command = 'jq'; Args = @('--version') }
  @{ Name = 'yq'; Command = 'yq'; Args = @('--version') }
  @{ Name = 'Playwright'; Command = 'playwright'; Args = @('--version') }
  @{ Name = 'clasp'; Command = 'clasp'; Args = @('--version') }
  @{ Name = 'ast-grep'; Command = 'ast-grep'; Args = @('--version') }
  @{ Name = 'Repomix'; Command = 'repomix'; Args = @('--version') }
  @{ Name = 'SQLFluff'; Command = Join-Path $repoRoot '.venv-tools\Scripts\sqlfluff.exe'; Args = @('--version') }
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
    & $check.Command @($check.Args) | Select-Object -First 3
    if ($LASTEXITCODE -ne 0) { $failed += $check.Name }
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
