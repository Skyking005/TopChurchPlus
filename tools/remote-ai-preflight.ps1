param(
  [Parameter(Mandatory = $true)]
  [string]$Task,

  [string]$Model = $env:TOPCHURCHPLUS_REMOTE_AI_MODEL,
  [string]$BaseUrls = $env:TOPCHURCHPLUS_REMOTE_AI_BASE_URLS,
  [string]$ApiKey = $env:TOPCHURCHPLUS_REMOTE_AI_API_KEY,
  [int]$MaxMatches = 40,
  [int]$MaxDocChars = 900,
  [switch]$NoAi
)

. "$PSScriptRoot\setup-utf8.ps1"

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$outputDir = Join-Path $repoRoot 'tmp\remote-ai'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

if (-not $Model) {
  $Model = 'Qwopu3.6-27B-v2-oQ4-fp16-mtp'
}

if (-not $BaseUrls) {
  throw 'Missing remote AI base URLs. Set TOPCHURCHPLUS_REMOTE_AI_BASE_URLS or pass -BaseUrls.'
}

if (-not $NoAi -and -not $ApiKey) {
  throw 'Missing remote AI API key. Set TOPCHURCHPLUS_REMOTE_AI_API_KEY or pass -ApiKey.'
}

$remoteBaseUrls = @(
  $BaseUrls -split '[;,]' |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ }
)

if ($remoteBaseUrls.Count -eq 0) {
  throw 'No usable remote AI base URLs were provided.'
}

$remoteBaseUrls = @(
  $remoteBaseUrls |
    ForEach-Object {
      if ($_ -notmatch '^https?://') { "http://$_" } else { $_ }
    } |
    ForEach-Object { $_.TrimEnd('/') }
)

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

function Write-Utf8File {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content
  )
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Read-Utf8FileSafe {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return '' }
  return [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
}

function Get-TaskKeywords {
  param([Parameter(Mandatory = $true)][string]$Text)

  $Text -split '[^\p{L}\p{Nd}_-]+' |
    Where-Object { $_ -and $_.Trim().Length -ge 2 } |
    ForEach-Object { $_.Trim() } |
    Select-Object -Unique -First 12
}

function Invoke-RgSearch {
  param([string[]]$Keywords)

  if (-not $Keywords -or $Keywords.Count -eq 0) { return @() }

  $pattern = ($Keywords | ForEach-Object { [regex]::Escape($_) }) -join '|'
  $rgArgs = @(
    '--json',
    '--ignore-case',
    '--hidden',
    '-g', '*.md',
    '-g', '*.js',
    '-g', '*.html',
    '-g', '*.gs',
    '-g', '*.sql',
    '-g', '*.ps1',
    '-g', '*.cmd',
    '-g', '*.json',
    '-g', '!node_modules/**',
    '-g', '!api/node_modules/**',
    '-g', '!.git/**',
    '-g', '!tmp/**',
    '-g', '!logs/**',
    '-g', '!.venv-tools/**',
    '-g', '!*.env',
    '-g', '!.env*',
    $pattern,
    '.'
  )

  $rgOutput = & rg @rgArgs 2>$null
  if ($LASTEXITCODE -gt 1) { throw 'rg search failed.' }

  $files = @()
  $seen = @{}
  foreach ($line in $rgOutput) {
    if (-not $line) { continue }
    try {
      $item = $line | ConvertFrom-Json
    } catch {
      continue
    }
    if ($item.type -ne 'match') { continue }

    $path = $item.data.path.text
    if (-not $path -or $seen.ContainsKey($path)) { continue }

    $seen[$path] = $true
    $files += [ordered]@{
      path = $path
      line = $item.data.line_number
      preview = ($item.data.lines.text -replace '\s+', ' ').Trim()
    }
    if ($files.Count -ge $MaxMatches) { break }
  }

  return $files
}

function Get-DocDigest {
  param([string[]]$DocPaths)

  $parts = @()
  foreach ($relativePath in $DocPaths) {
    $fullPath = Join-Path $repoRoot $relativePath
    $content = Read-Utf8FileSafe -Path $fullPath
    if (-not $content) { continue }
    if ($content.Length -gt $MaxDocChars) {
      $content = $content.Substring(0, $MaxDocChars) + "`n...[truncated]"
    }
    $parts += "## $relativePath`n$content"
  }

  return ($parts -join "`n`n")
}

function Invoke-RemoteAi {
  param(
    [Parameter(Mandatory = $true)][string]$Prompt,
    [Parameter(Mandatory = $true)][string[]]$Urls
  )

  $headers = @{
    Authorization = "Bearer $ApiKey"
  }

  $body = @{
    model = $Model
    temperature = 0.2
    max_tokens = 220
    messages = @(
      @{
        role = 'system'
        content = 'You are a read-only TopChurchPlus preflight assistant. Reply in Traditional Chinese Markdown. Do not expose secrets, edit files, deploy, or claim certainty when context is missing.'
      },
      @{
        role = 'user'
        content = $Prompt
      }
    )
  } | ConvertTo-Json -Depth 8

  $errors = @()
  foreach ($url in $Urls) {
    try {
      $response = Invoke-RestMethod `
        -Uri "$url/chat/completions" `
        -Method POST `
        -Headers $headers `
        -ContentType 'application/json; charset=utf-8' `
        -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) `
        -TimeoutSec 30

      $text = [string]$response.choices[0].message.content
      if ([string]::IsNullOrWhiteSpace($text)) {
        throw 'Remote AI returned an empty response.'
      }

      return [ordered]@{
        url = $url
        text = $text
      }
    } catch {
      $errors += "$url => $($_.Exception.Message)"
    }
  }

  throw ("All remote AI endpoints failed.`n" + ($errors -join "`n"))
}

$coreDocs = @(
  'AGENTS.md',
  'docs/NEW_THREAD_GUIDE.md',
  'docs/HANDOFF.md',
  'docs/REMOTE_AI_GUARDRAILS.md',
  'docs/MODULES.md'
)

$keywords = @(Get-TaskKeywords -Text $Task)
$matches = @(Invoke-RgSearch -Keywords $keywords)
$docDigest = Get-DocDigest -DocPaths $coreDocs

$matchesJson = $matches | ConvertTo-Json -Depth 6
if (-not $matchesJson) { $matchesJson = '[]' }
Write-Utf8File -Path (Join-Path $outputDir 'relevant_files.json') -Content $matchesJson

$fallbackContext = @"
# TopChurchPlus Remote AI Preflight

## Task
$Task

## Remote AI
- Base URLs: $($remoteBaseUrls -join ', ')
- Model: $Model

## Keywords
$($keywords -join ', ')

## Relevant Files
$($matches | ForEach-Object { "- $($_.path):$($_.line) $($_.preview)" } | Out-String)

## Core Documents Digest
$docDigest
"@

Write-Utf8File -Path (Join-Path $outputDir 'task_context.raw.md') -Content $fallbackContext

if ($NoAi) {
  Write-Utf8File -Path (Join-Path $outputDir 'task_context.md') -Content $fallbackContext
  Write-Utf8File -Path (Join-Path $outputDir 'risks.md') -Content 'NoAi mode: review relevant_files.json and task_context.raw.md manually.'
  Write-Host "Remote AI skipped. Files written to $outputDir"
  exit 0
}

$prompt = @"
請依據以下 TopChurchPlus 任務上下文，輸出高訊號的前置分析。

請包含：
1. 任務理解
2. 相關檔案與原因
3. 主要風險
4. 建議 Codex 下一步

限制：
- 不要輸出或推測 secret、token、password、API key。
- 不要建議直接部署 production。
- 不要宣稱已經修改檔案。
- 若文件出現 mojibake 或資訊不足，請明確指出。

$fallbackContext
"@

try {
  $result = Invoke-RemoteAi -Prompt $prompt -Urls $remoteBaseUrls
  $content = @"
# Remote AI Preflight

Endpoint: $($result.url)
Model: $Model

$($result.text)
"@
  Write-Utf8File -Path (Join-Path $outputDir 'task_context.md') -Content $content
  Write-Utf8File -Path (Join-Path $outputDir 'risks.md') -Content $content
  Write-Host "Remote AI preflight complete: $outputDir\task_context.md"
} catch {
  $message = "Remote AI failed: $($_.Exception.Message)`nFallback context written to task_context.md."
  Write-Utf8File -Path (Join-Path $outputDir 'task_context.md') -Content $fallbackContext
  Write-Utf8File -Path (Join-Path $outputDir 'risks.md') -Content $message
  Write-Warning $message
  exit 0
}
