param(
  [string]$ContextPath = '',
  [string]$ShareName = 'topchurchplus-ai-context',
  [Parameter(Mandatory = $true)][string]$ReaderIdentity
)

$ErrorActionPreference = 'Stop'

if (-not $ContextPath) {
  $projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
  $ContextPath = Join-Path (Split-Path $projectRoot -Parent) 'topchurchplus-ai-context'
}

if (-not (Test-Path -LiteralPath $ContextPath)) {
  throw "AI context folder not found: $ContextPath. Run tools\build-ai-context.cmd first."
}

$ContextPath = (Resolve-Path $ContextPath).Path

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'This command must run in an elevated PowerShell window to create SMB share permissions.'
}

$existing = Get-SmbShare -Name $ShareName -ErrorAction SilentlyContinue
if (-not $existing) {
  New-SmbShare -Name $ShareName -Path $ContextPath -ReadAccess $ReaderIdentity -CachingMode None | Out-Null
} else {
  if ($existing.Path -ne $ContextPath) {
    throw "Share $ShareName already exists but points to $($existing.Path)."
  }
  Grant-SmbShareAccess -Name $ShareName -AccountName $ReaderIdentity -AccessRight Read -Force | Out-Null
}

icacls $ContextPath /grant:r "${ReaderIdentity}:(OI)(CI)RX" | Out-Null

$hostName = $env:COMPUTERNAME
Write-Host "Read-only share ready: \\$hostName\$ShareName"
Write-Host "Reader identity: $ReaderIdentity"
