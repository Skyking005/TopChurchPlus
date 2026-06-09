param()

$ErrorActionPreference = 'Stop'

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
$pathEntries = @($toolMap.pathEntries | ForEach-Object { Expand-DevCliPath $_ } | Where-Object { $_ -and (Test-Path -LiteralPath $_) })
$env:PATH = @($pathEntries; $env:PATH) -join ';'

Write-Host 'TopChurchPlus development PATH has been prepared for this PowerShell session.'
Write-Host 'Run .\tools\check-dev-cli.cmd to verify the toolchain.'
