param(
  [switch]$WriteDemo
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\lib\topchurchplus-test.ps1"

$currentUser = New-DemoCurrentUser

$options = (Invoke-TopChurchPlusApi -Method GET -Path '/admin-supplies/options' -CurrentUser $currentUser).Json
Assert-True (($options.churches | Get-StableCount) -gt 0) 'Admin supply options should include churches.'
Assert-True (($options.categories | Get-StableCount) -gt 0) 'Admin supply options should include categories.'
Write-Host 'PASS admin-supply options'

$items = (Invoke-TopChurchPlusApi -Method GET -Path '/admin-supplies/items?page=1&pageSize=20' -CurrentUser $currentUser).Json
Assert-True ($items.pageSize -eq 20) 'Admin supply list should use pageSize 20.'
Write-Host 'PASS admin-supply list'

if (-not $WriteDemo) {
  Write-Host 'SKIP admin-supply write demo. Pass -WriteDemo to create retained demo data.'
  exit 0
}

$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$createBody = @{
  currentUser = $currentUser
  item = @{
    name = "CodexFlowTestAdminSupply$stamp"
    category = Decode-Utf8 '6KGM5pS/6ICX5p2Q'
    unit = Decode-Utf8 '5YyF'
    minStock = 2
    isActive = $true
    note = Decode-Utf8 'QVBJIHNtb2tlIHRlc3QgRGVtbyDos4fmlpk='
  }
}
$created = (Invoke-TopChurchPlusApi -Method POST -Path '/admin-supplies/items' -CurrentUser $currentUser -Body $createBody).Json
$supplyId = $created.supplyId
Assert-True ($supplyId -ne $null -and $supplyId -ne '') 'Admin supply create should return supplyId.'

$church1 = $options.churches[0].churchId
$church2 = $options.churches[1].churchId

Invoke-TopChurchPlusApi -Method POST -Path '/admin-supplies/movements' -CurrentUser $currentUser -Body @{
  currentUser = $currentUser
  movement = @{ supplyId = $supplyId; movementType = 'in'; toChurchId = $church1; quantity = 10; reason = (Decode-Utf8 'U21va2Ug5YWl5bqr'); note = (Decode-Utf8 '5L+d55WZIERlbW8g6LOH5paZ') }
} | Out-Null

Invoke-TopChurchPlusApi -Method POST -Path '/admin-supplies/movements' -CurrentUser $currentUser -Body @{
  currentUser = $currentUser
  movement = @{ supplyId = $supplyId; movementType = 'out'; fromChurchId = $church1; quantity = 3; reason = (Decode-Utf8 'U21va2Ug6aCY55So'); note = (Decode-Utf8 '5L+d55WZIERlbW8g6LOH5paZ') }
} | Out-Null

Invoke-TopChurchPlusApi -Method POST -Path '/admin-supplies/movements' -CurrentUser $currentUser -Body @{
  currentUser = $currentUser
  movement = @{ supplyId = $supplyId; movementType = 'transfer'; fromChurchId = $church1; toChurchId = $church2; quantity = 2; reason = (Decode-Utf8 'U21va2Ug6Kq/5pKl'); note = (Decode-Utf8 '5L+d55WZIERlbW8g6LOH5paZ') }
} | Out-Null

$saved = (Invoke-TopChurchPlusApi -Method GET -Path "/admin-supplies/items?keyword=$stamp&page=1&pageSize=20" -CurrentUser $currentUser).Json.rows[0]
Assert-ReadableChinese $saved.name 'admin_supply_items.name'
Assert-True ([decimal]$saved.totalQuantity -eq 7) 'Admin supply total quantity should be 7 after smoke movements.'
Write-Host "PASS admin-supply write demo supplyId=$supplyId"
