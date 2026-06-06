$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$LocalApiRoot = Join-Path $ProjectRoot 'api'
$LocalApiSrc = Join-Path $ProjectRoot 'api\src'
$RemoteApiRoot = '\\192.168.3.2\docker\project-api'
$RemoteApiSrc = '\\192.168.3.2\docker\project-api\src'
$RemoteApiIndex = Join-Path $RemoteApiSrc 'index.js'
$SshKey = Join-Path $env:USERPROFILE '.ssh\project_api_deploy'
$NasUser = 'cetu'
$NasHost = '192.168.3.2'
$RemoteProjectDir = '/volume1/docker/project-api'
$DockerBin = '/usr/local/bin/docker'

if (-not (Test-Path -LiteralPath $LocalApiSrc)) {
  throw "Local API src folder not found: $LocalApiSrc"
}

if (-not (Test-Path -LiteralPath $RemoteApiSrc)) {
  throw "Remote API src folder not found: $RemoteApiSrc"
}

if (-not (Test-Path -LiteralPath $SshKey)) {
  throw "SSH key not found: $SshKey"
}

$Stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$BackupPath = "$RemoteApiIndex.bak_$Stamp"

Write-Host "Backing up NAS API index..."
Copy-Item -LiteralPath $RemoteApiIndex -Destination $BackupPath -Force

Write-Host "Copying local API src to NAS..."
Get-ChildItem -LiteralPath $LocalApiSrc -Force | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $RemoteApiSrc -Recurse -Force
}

Write-Host "Copying API runtime files to NAS..."
@('package.json', 'Dockerfile', 'docker-compose.yml') | ForEach-Object {
  $localFile = Join-Path $LocalApiRoot $_
  if (Test-Path -LiteralPath $localFile) {
    Copy-Item -LiteralPath $localFile -Destination (Join-Path $RemoteApiRoot $_) -Force
  }
}

Write-Host "Rebuilding API container on NAS..."
$RemoteCommand = "cd $RemoteProjectDir && sudo -n $DockerBin compose up -d --build"
ssh -i $SshKey "$NasUser@$NasHost" $RemoteCommand
if ($LASTEXITCODE -ne 0) {
  throw "Remote docker compose failed with exit code $LASTEXITCODE"
}

Write-Host "API deployment completed."
Write-Host "Backup: $BackupPath"
