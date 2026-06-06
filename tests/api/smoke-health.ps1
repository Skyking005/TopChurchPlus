$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\lib\topchurchplus-test.ps1"

$result = Invoke-TopChurchPlusApi -Method GET -Path '/health'
Assert-True ($result.Json.ok -eq $true) 'API health failed.'
Write-Host 'PASS health'
