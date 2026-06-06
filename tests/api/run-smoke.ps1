param(
  [switch]$WriteDemo
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\..\..\tools\setup-utf8.ps1"

& "$PSScriptRoot\smoke-health.ps1"
& "$PSScriptRoot\smoke-error-context.ps1"
& "$PSScriptRoot\smoke-admin-supply.ps1" -WriteDemo:$WriteDemo

Write-Host 'All selected smoke tests passed.'
