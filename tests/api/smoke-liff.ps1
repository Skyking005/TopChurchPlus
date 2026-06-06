param(
  [switch]$WriteDemo
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\lib\topchurchplus-test.ps1"

$baseUrl = $env:TOPCHURCHPLUS_API_BASE_URL
if (-not $baseUrl) { throw 'Missing TOPCHURCHPLUS_API_BASE_URL.' }

$config = Invoke-RestMethod -Method GET -Uri "$($baseUrl.TrimEnd('/'))/liff/config?channelKey=main"
Assert-True ($null -ne $config.channelKey) 'LIFF config should be publicly readable.'
Assert-ReadableChinese $config.channelName 'LIFF channelName'

$me = Invoke-TopChurchPlusApi -Method GET -Path '/liff/me' -AllowFailure
Assert-True ($me.Status -eq 401) 'LIFF me should reject requests without session token.'
Assert-True ($me.Text -match 'LIFF Session|Session Token') 'LIFF me should return a session-related error.'

$html = Invoke-RestMethod -Method GET -Uri "$($baseUrl.TrimEnd('/'))/liff"
Assert-True ($html -match 'TopChurchPlus' -and $html -match 'liff-app.js') 'LIFF page should render the portal shell.'
Assert-ReadableChinese $html 'LIFF page html'

Write-Host 'LIFF smoke tests passed.'
