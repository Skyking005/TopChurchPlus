param(
  [switch]$RunSmoke,
  [string]$ApiBaseUrl = 'http://192.168.3.2:3000',
  [string]$NasSharePath = '\\192.168.3.2\docker\project-api',
  [string]$SshKey = "$env:USERPROFILE\.ssh\project_api_deploy"
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\setup-utf8.ps1"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$failures = New-Object System.Collections.Generic.List[string]

function Add-CheckResult {
  param(
    [string]$Name,
    [bool]$Passed,
    [string]$Detail = ''
  )

  if ($Passed) {
    Write-Host "[PASS] $Name $Detail"
  } else {
    Write-Host "[FAIL] $Name $Detail"
    $failures.Add($Name)
  }
}

function Test-RequiredPath {
  param(
    [string]$Name,
    [string]$Path
  )

  Add-CheckResult $Name (Test-Path -LiteralPath $Path) $Path
}

function Import-ApiKeyFromEnvFile {
  $envPath = Join-Path $ProjectRoot 'api\.env'
  if (-not (Test-Path -LiteralPath $envPath)) {
    return
  }

  foreach ($line in [System.IO.File]::ReadAllLines($envPath)) {
    if ($line -match '^\s*API_KEY\s*=\s*(.+)\s*$') {
      $env:TOPCHURCHPLUS_API_KEY = $Matches[1].Trim()
      return
    }
  }
}

Write-Host 'TopChurchPlus rebuild readiness check'
Write-Host "ProjectRoot: $ProjectRoot"

$requiredFiles = @(
  @{ Name = 'AGENTS.md'; Path = 'AGENTS.md' },
  @{ Name = 'Git ignore'; Path = '.gitignore' },
  @{ Name = 'Apps Script manifest'; Path = 'appsscript.json' },
  @{ Name = 'clasp config'; Path = '.clasp.json' },
  @{ Name = 'NAS deploy wrapper'; Path = 'deploy-api.cmd' },
  @{ Name = 'Apps Script push wrapper'; Path = 'push-to-google.cmd' },
  @{ Name = 'API package'; Path = 'api\package.json' },
  @{ Name = 'API docker compose'; Path = 'api\docker-compose.yml' },
  @{ Name = 'API env example'; Path = 'api\.env.example' },
  @{ Name = 'API env local'; Path = 'api\.env' },
  @{ Name = 'Smoke wrapper'; Path = 'tests\api\run-smoke.cmd' },
  @{ Name = 'Workflow doc'; Path = 'docs\WORKFLOW.md' },
  @{ Name = 'Handoff doc'; Path = 'docs\HANDOFF.md' },
  @{ Name = 'Architecture doc'; Path = 'docs\SYSTEM_ARCHITECTURE.md' },
  @{ Name = 'Database schema doc'; Path = 'docs\DATABASE_SCHEMA.md' },
  @{ Name = 'API catalog doc'; Path = 'docs\API_CATALOG.md' },
  @{ Name = 'Rebuild doc'; Path = 'docs\DISASTER_RECOVERY_REBUILD.md' }
)

foreach ($item in $requiredFiles) {
  Test-RequiredPath $item.Name (Join-Path $ProjectRoot $item.Path)
}

$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
  $githubDesktopGit = Join-Path $env:LOCALAPPDATA 'GitHubDesktop\app-3.5.2\resources\app\git\cmd\git.exe'
  if (Test-Path -LiteralPath $githubDesktopGit) {
    $git = [pscustomobject]@{ Source = $githubDesktopGit }
  }
}

Add-CheckResult 'Git command' ($null -ne $git) (($git | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue) -as [string])
if ($git) {
  $remote = (& $git.Source remote get-url origin 2>$null)
  Add-CheckResult 'GitHub origin' ($remote -match 'Skyking005/TopChurchPlus(\.git)?$') $remote

  $branch = (& $git.Source branch --show-current 2>$null)
  Add-CheckResult 'Git branch readable' ($LASTEXITCODE -eq 0 -and $branch) $branch
}

Add-CheckResult 'NAS share reachable' (Test-Path -LiteralPath $NasSharePath) $NasSharePath
Add-CheckResult 'NAS backups folder reachable' (Test-Path -LiteralPath (Join-Path $NasSharePath 'backups')) (Join-Path $NasSharePath 'backups')
Add-CheckResult 'SSH deploy key exists' (Test-Path -LiteralPath $SshKey) $SshKey

try {
  $health = Invoke-RestMethod -Uri "$($ApiBaseUrl.TrimEnd('/'))/health" -TimeoutSec 10
  Add-CheckResult 'NAS API health' ($health.ok -eq $true) $ApiBaseUrl
} catch {
  Add-CheckResult 'NAS API health' $false $_.Exception.Message
}

Write-Host 'Checking development CLI map...'
& "$ProjectRoot\tools\check-dev-cli.cmd"
Add-CheckResult 'Development CLI tools' ($LASTEXITCODE -eq 0)

if ($RunSmoke) {
  Import-ApiKeyFromEnvFile
  if (-not $env:TOPCHURCHPLUS_API_BASE_URL) {
    $env:TOPCHURCHPLUS_API_BASE_URL = $ApiBaseUrl
  }

  if (-not $env:TOPCHURCHPLUS_API_KEY) {
    Add-CheckResult 'API smoke tests' $false 'Missing TOPCHURCHPLUS_API_KEY.'
  } else {
    & "$ProjectRoot\tests\api\run-smoke.cmd"
    Add-CheckResult 'API smoke tests' ($LASTEXITCODE -eq 0)
  }
}

if ($failures.Count -gt 0) {
  Write-Host ''
  Write-Host 'Rebuild readiness check failed:'
  $failures | ForEach-Object { Write-Host "- $_" }
  exit 1
}

Write-Host ''
Write-Host 'Rebuild readiness check passed.'
