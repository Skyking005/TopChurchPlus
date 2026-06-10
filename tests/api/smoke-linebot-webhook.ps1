$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\lib\topchurchplus-test.ps1"

$baseUrl = $env:TOPCHURCHPLUS_API_BASE_URL
if (-not $baseUrl) { throw 'Missing TOPCHURCHPLUS_API_BASE_URL.' }

Add-Type -AssemblyName System.Net.Http
$client = [System.Net.Http.HttpClient]::new()
try {
  $uri = "$($baseUrl.TrimEnd('/'))/linebot/webhook"
  $body = '{"events":[]}'
  $content = [System.Net.Http.StringContent]::new($body, [System.Text.UTF8Encoding]::new($false), 'application/json')
  $response = $client.PostAsync($uri, $content).GetAwaiter().GetResult()
  $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  if (-not $response.IsSuccessStatusCode) {
    throw "HTTP $([int]$response.StatusCode): $text"
  }
  $json = $text | ConvertFrom-Json
  Assert-True ($json.success -eq $true) 'LINE webhook should accept an empty event batch.'
  Assert-True ($json.received -eq 0) 'LINE webhook should report zero received events.'
} finally {
  $client.Dispose()
}

Write-Host 'PASS linebot webhook'
