param(
  [Parameter(Mandatory = $true)]
  [string]$Task,

  [string]$Model = 'qwen3:0.6b',
  [int]$MaxMatches = 40,
  [int]$MaxDocChars = 600,
  [switch]$NoAi
)

. "$PSScriptRoot\setup-utf8.ps1"

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$outputDir = Join-Path $repoRoot 'tmp\local-ai'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

if (-not $env:OLLAMA_MODELS) {
  $env:OLLAMA_MODELS = 'D:\ollama-models'
}

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
  if (-not (Test-Path -LiteralPath $Path)) {
    return ''
  }
  return [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
}

function Get-OllamaPath {
  $command = Get-Command ollama -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $localAppPath = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
  if (Test-Path -LiteralPath $localAppPath) {
    return $localAppPath
  }

  throw 'Ollama executable not found. Install Ollama or add it to PATH.'
}

function Ensure-OllamaServer {
  param([Parameter(Mandatory = $true)][string]$OllamaPath)

  try {
    Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -Method GET -TimeoutSec 3 | Out-Null
    return
  } catch {
    Start-Process -FilePath $OllamaPath -ArgumentList 'serve' -WindowStyle Hidden
    Start-Sleep -Seconds 5
  }

  Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -Method GET -TimeoutSec 10 | Out-Null
}

function Get-TaskKeywords {
  param([Parameter(Mandatory = $true)][string]$Text)

  $tokens = $Text -split '[^\p{L}\p{Nd}_-]+'
  $tokens |
    Where-Object { $_ -and $_.Trim().Length -ge 2 } |
    ForEach-Object { $_.Trim() } |
    Select-Object -Unique -First 12
}

function Invoke-RgSearch {
  param([string[]]$Keywords)

  $files = @()
  if (-not $Keywords -or $Keywords.Count -eq 0) {
    return $files
  }

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
    '-g', '!測試資料/**',
    '-g', '!固定資產原始資料/**',
    '-g', '!文書範本/**',
    '-g', '!database/pastoral_import/**',
    '-g', '!database/pastoral_permission_import/**',
    '-g', '!database/qt_import/**',
    '-g', '!*.env',
    '-g', '!.env*',
    $pattern,
    '.'
  )

  $rgOutput = & rg @rgArgs 2>$null
  $exitCode = $LASTEXITCODE
  if ($exitCode -gt 1) {
    throw 'rg search failed.'
  }

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
    if ($files.Count -ge $MaxMatches) {
      break
    }
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

function Invoke-LocalAi {
  param(
    [Parameter(Mandatory = $true)][string]$Prompt
  )

  $body = @{
    model = $Model
    stream = $false
    think = $false
    prompt = "/no_think`n$Prompt"
    options = @{
      temperature = 0.2
      num_ctx = 8192
      num_predict = 350
    }
  } | ConvertTo-Json -Depth 8

  $response = Invoke-RestMethod `
    -Uri 'http://127.0.0.1:11434/api/generate' `
    -Method POST `
    -ContentType 'application/json; charset=utf-8' `
    -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) `
    -TimeoutSec 90

  $text = [string]$response.response
  if ([string]::IsNullOrWhiteSpace($text)) {
    throw 'Ollama returned an empty response.'
  }
  return $text
}

$coreDocs = @(
  'AGENTS.md',
  'docs/NEW_THREAD_GUIDE.md',
  'docs/HANDOFF.md',
  'docs/MODULES.md'
)

$keywords = @(Get-TaskKeywords -Text $Task)
$matches = @(Invoke-RgSearch -Keywords $keywords)
$docDigest = Get-DocDigest -DocPaths $coreDocs

$matchesJson = $matches | ConvertTo-Json -Depth 6
if (-not $matchesJson) { $matchesJson = '[]' }

Write-Utf8File -Path (Join-Path $outputDir 'relevant_files.json') -Content $matchesJson

$fallbackContext = @"
# TopChurchPlus Local AI Preflight

## Task
$Task

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
  Write-Utf8File -Path (Join-Path $outputDir 'risks.md') -Content "NoAi mode: review relevant_files.json and task_context.raw.md manually."
  Write-Host "Local AI skipped. Files written to $outputDir"
  exit 0
}

$ollamaPath = Get-OllamaPath
Ensure-OllamaServer -OllamaPath $ollamaPath

$prompt = @"
你是 TopChurchPlus 專案的 Local AI 前置分析助手。

請使用繁體中文輸出 Markdown，協助 Codex 在大型專案中降低 Token 消耗。

限制：
- 不要輸出思考過程。
- 不要修改程式碼。
- 不要推測 secret、token、password、API key。
- 不要建議直接改 production database。
- 如果資訊不足，請明確標示「需要 Codex 再確認」。
- 你只負責前置分析，最後仍由 Codex 讀檔、修改、測試與部署。

請依下列章節輸出：
1. 任務摘要
2. 建議先讀文件
3. 可能相關檔案
4. 風險與注意事項
5. 建議 Codex 下一步

以下是任務與已擷取的最小上下文：

$fallbackContext
"@

try {
  $aiResult = Invoke-LocalAi -Prompt $prompt
  Write-Utf8File -Path (Join-Path $outputDir 'task_context.md') -Content $aiResult
  Write-Utf8File -Path (Join-Path $outputDir 'risks.md') -Content $aiResult
  Write-Host "Local AI preflight complete: $outputDir\task_context.md"
} catch {
  $message = "Local AI failed: $($_.Exception.Message)`nFallback context written to task_context.md."
  Write-Utf8File -Path (Join-Path $outputDir 'task_context.md') -Content $fallbackContext
  Write-Utf8File -Path (Join-Path $outputDir 'risks.md') -Content $message
  Write-Warning $message
  exit 0
}
