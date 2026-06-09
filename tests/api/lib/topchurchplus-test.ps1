$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
. "$ProjectRoot\tools\setup-utf8.ps1"

function ConvertTo-Base64Url([string]$Text) {
  $base64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($Text))
  return $base64.TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Decode-Utf8([string]$Base64) {
  return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Base64))
}

function New-DemoCurrentUser {
  return [ordered]@{
    staffId = '21'
    name = Decode-Utf8 '5p2c5bu65oGp'
    email = 'the.king.of.sky@gmail.com'
    roles = @(
      (Decode-Utf8 '5YWo6IG35ZCM5bel'),
      (Decode-Utf8 '566h55CG5ZOh'),
      (Decode-Utf8 '6LaF57Sa566h55CG6ICF')
    )
    deviceType = 'desktop'
  }
}

function Invoke-TopChurchPlusApi {
  param(
    [ValidateSet('GET', 'POST', 'PUT', 'PATCH', 'DELETE')]
    [string]$Method = 'GET',

    [Parameter(Mandatory = $true)]
    [string]$Path,

    [object]$Body = $null,

    [object]$CurrentUser = $null,

    [switch]$AllowFailure
  )

  $baseUrl = $env:TOPCHURCHPLUS_API_BASE_URL
  $apiKey = $env:TOPCHURCHPLUS_API_KEY
  if (-not $baseUrl) { throw 'Missing TOPCHURCHPLUS_API_BASE_URL.' }
  if (-not $apiKey) { throw 'Missing TOPCHURCHPLUS_API_KEY.' }

  Add-Type -AssemblyName System.Net.Http
  $client = [System.Net.Http.HttpClient]::new()
  try {
    $client.DefaultRequestHeaders.Add('x-api-key', $apiKey)
    if ($CurrentUser) {
      $userJson = $CurrentUser | ConvertTo-Json -Depth 12 -Compress
      $client.DefaultRequestHeaders.Add('x-current-user', (ConvertTo-Base64Url $userJson))
    }

    $uri = "$($baseUrl.TrimEnd('/'))$Path"
    $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), $uri)
    if ($null -ne $Body) {
      $json = $Body | ConvertTo-Json -Depth 16 -Compress
      $request.Content = [System.Net.Http.StringContent]::new($json, [System.Text.UTF8Encoding]::new($false), 'application/json')
    }

    $response = $client.SendAsync($request).GetAwaiter().GetResult()
    $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    if (-not $response.IsSuccessStatusCode -and -not $AllowFailure) {
      throw "HTTP $([int]$response.StatusCode): $text"
    }

    $jsonResult = $null
    if ($text) {
      $jsonResult = $text | ConvertFrom-Json
    }

    return [pscustomobject]@{
      Status = [int]$response.StatusCode
      Text = $text
      Json = $jsonResult
    }
  } finally {
    $client.Dispose()
  }
}

function Assert-True {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

function Get-StableCount {
  param(
    [Parameter(ValueFromPipeline = $true)]
    [object]$InputObject
  )

  begin {
    $items = @()
  }

  process {
    if ($null -ne $InputObject) {
      $items += $InputObject
    }
  }

  end {
    # PowerShell may unwrap a single pipeline result, so use Measure-Object for stable 0/1/many counts.
    return ($items | Measure-Object).Count
  }
}

function Assert-ReadableChinese {
  param(
    [string]$Text,
    [string]$FieldName
  )

  if ($Text -match '\?\?\?\?' -or $Text.Contains([char]0xFFFD)) {
    throw "$FieldName contains mojibake: $Text"
  }
}
