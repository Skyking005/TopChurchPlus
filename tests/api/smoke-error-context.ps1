$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\lib\topchurchplus-test.ps1"

$response = Invoke-TopChurchPlusApi `
  -Method GET `
  -Path '/admin-supplies/items' `
  -AllowFailure

Assert-True ($response.Status -eq 400) 'Expected missing-user request to return HTTP 400.'
Assert-True ($response.Json.error -ne $null -and $response.Json.error -ne '') 'Error response should include error message.'
Assert-True ($response.Json.requestId -ne $null -and $response.Json.requestId -ne '') 'Error response should include requestId.'
Write-Host "PASS error-context requestId=$($response.Json.requestId)"
