param(
  [string]$ApiBaseUrl = $env:TOPCHURCHPLUS_API_BASE_URL,
  [string]$ApiKey = $env:TOPCHURCHPLUS_API_KEY,
  [switch]$SkipHealth
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\setup-utf8.ps1"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

& "$PSScriptRoot\check-scripts.ps1" -SkipGasCheck

if ($SkipHealth) {
  Write-Host 'API health check skipped.'
  exit 0
}

if (-not $ApiBaseUrl -or -not $ApiKey) {
  Write-Host 'API health check skipped. Set TOPCHURCHPLUS_API_BASE_URL and TOPCHURCHPLUS_API_KEY to enable it.'
  exit 0
}

$HealthUrl = "$($ApiBaseUrl.TrimEnd('/'))/health"
Write-Host "Checking API health: $HealthUrl"
$Result = Invoke-RestMethod -Uri $HealthUrl -Headers @{ 'x-api-key' = $ApiKey }
if (-not $Result.ok) {
  throw "API health check failed: $($Result | ConvertTo-Json -Compress)"
}

Write-Host 'API health check passed.'
