$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$LocalApiIndex = Join-Path $ProjectRoot 'api\src\index.js'
$RemoteApiIndex = '\\192.168.3.2\docker\project-api\src\index.js'
$SshKey = Join-Path $env:USERPROFILE '.ssh\project_api_deploy'
$NasUser = 'cetu'
$NasHost = '192.168.3.2'
$RemoteProjectDir = '/volume1/docker/project-api'
$DockerBin = '/usr/local/bin/docker'

if (-not (Test-Path -LiteralPath $LocalApiIndex)) {
  throw "Local API file not found: $LocalApiIndex"
}

if (-not (Test-Path -LiteralPath $RemoteApiIndex)) {
  throw "Remote API file not found: $RemoteApiIndex"
}

if (-not (Test-Path -LiteralPath $SshKey)) {
  throw "SSH key not found: $SshKey"
}

$Stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$BackupPath = "$RemoteApiIndex.bak_$Stamp"

Write-Host "Backing up NAS API index..."
Copy-Item -LiteralPath $RemoteApiIndex -Destination $BackupPath -Force

Write-Host "Copying local API index to NAS..."
Copy-Item -LiteralPath $LocalApiIndex -Destination $RemoteApiIndex -Force

Write-Host "Rebuilding API container on NAS..."
$RemoteCommand = "cd $RemoteProjectDir && sudo -n $DockerBin compose up -d --build"
ssh -i $SshKey "$NasUser@$NasHost" $RemoteCommand
if ($LASTEXITCODE -ne 0) {
  throw "Remote docker compose failed with exit code $LASTEXITCODE"
}

Write-Host "API deployment completed."
Write-Host "Backup: $BackupPath"
