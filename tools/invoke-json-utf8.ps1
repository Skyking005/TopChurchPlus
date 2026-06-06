param(
  [Parameter(Mandatory = $true)]
  [string]$Uri,

  [ValidateSet('GET', 'POST', 'PUT', 'PATCH', 'DELETE')]
  [string]$Method = 'GET',

  [string]$ApiKey = $env:TOPCHURCHPLUS_API_KEY,

  [string]$BodyJson = '',

  [string]$BodyFile = '',

  [string]$CurrentUserBase64 = ''
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\setup-utf8.ps1"
Add-Type -AssemblyName System.Net.Http

if (-not $ApiKey) {
  throw 'Missing API key. Set TOPCHURCHPLUS_API_KEY or pass -ApiKey.'
}

$client = [System.Net.Http.HttpClient]::new()
try {
  $client.DefaultRequestHeaders.Add('x-api-key', $ApiKey)
  if ($CurrentUserBase64) {
    $client.DefaultRequestHeaders.Add('x-current-user', $CurrentUserBase64)
  }

  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), $Uri)
  if ($BodyFile) {
    $BodyJson = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $BodyFile), [System.Text.UTF8Encoding]::new($false))
  }
  if ($BodyJson) {
    $request.Content = [System.Net.Http.StringContent]::new($BodyJson, [System.Text.UTF8Encoding]::new($false), 'application/json')
  }

  $response = $client.SendAsync($request).GetAwaiter().GetResult()
  $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  if (-not $response.IsSuccessStatusCode) {
    throw "HTTP $([int]$response.StatusCode): $text"
  }
  if ($text) {
    Write-Output $text
  }
} finally {
  $client.Dispose()
}
