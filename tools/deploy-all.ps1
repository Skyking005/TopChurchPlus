param(
  [switch]$SkipChecks,
  [switch]$SkipApiDeploy,
  [switch]$SkipAppsScriptPush,
  [switch]$SkipHealth
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\setup-utf8.ps1"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

if (-not $SkipChecks) {
  & "$PSScriptRoot\check-api.ps1" -SkipHealth:$SkipHealth
}

if (-not $SkipApiDeploy) {
  Write-Host 'Deploying NAS API...'
  & "$ProjectRoot\deploy-api.cmd"
  if ($LASTEXITCODE -ne 0) {
    throw "deploy-api.cmd failed with exit code $LASTEXITCODE"
  }
}

if (-not $SkipAppsScriptPush) {
  Write-Host 'Pushing Google Apps Script...'
  & "$ProjectRoot\push-to-google.cmd"
  if ($LASTEXITCODE -ne 0) {
    throw "push-to-google.cmd failed with exit code $LASTEXITCODE"
  }
}

Write-Host 'Deploy workflow completed.'
