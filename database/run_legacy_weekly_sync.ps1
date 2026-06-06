param(
  [string]$SqlServerConnectionString = "Server=tcp:192.168.3.6,1433;Initial Catalog=TopChurch;Connection Timeout=30;User ID=TopChurch;Password=TopChurch;TrustServerCertificate=True;Encrypt=False;",
  [string]$NasHost = "192.168.3.2",
  [string]$NasUser = "cetu",
  [string]$NasProjectPath = "/volume1/docker/project-api",
  [string]$NasSharePath = "\\192.168.3.2\docker\project-api",
  [string]$SshKey = "$env:USERPROFILE\.ssh\project_api_deploy",
  [string]$PgContainer = "TopProject",
  [string]$PgDatabase = "postgres",
  [string]$PgUser = "Codex",
  [string]$PgPassword = "SuperSmart"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)

$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root "logs\legacy_sync"
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logPath = Join-Path $logDir "legacy_sync_$stamp.log"
$tmpImportShare = Join-Path $NasSharePath "tmp_import"
$pastoralImportScript = Join-Path $PSScriptRoot "import_pastoral_from_sqlserver.ps1"
$safePastoralScript = Join-Path $PSScriptRoot "build_safe_pastoral_import.ps1"
$educationImportScript = Join-Path $PSScriptRoot "import_education_from_sqlserver.ps1"
$attendanceImportScript = Join-Path $PSScriptRoot "import_attendance_from_sqlserver.ps1"
$qtImportScript = Join-Path $PSScriptRoot "import_qt_from_sqlserver.ps1"
$compareScript = Join-Path $PSScriptRoot "compare_mssql_postgres_pastoral_education.ps1"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Invoke-ExternalCommand {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed ($LASTEXITCODE): $FilePath $($Arguments -join ' ')"
  }
}

function Invoke-LocalScript {
  param(
    [string]$ScriptPath,
    [string[]]$Arguments = @()
  )

  if (-not (Test-Path -LiteralPath $ScriptPath)) {
    throw "Script not found: $ScriptPath"
  }

  $global:LASTEXITCODE = 0
  & $ScriptPath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Script failed ($LASTEXITCODE): $ScriptPath $($Arguments -join ' ')"
  }
}

function Invoke-SqlServerScalarMap {
  param([string]$Query)

  $connection = [System.Data.SqlClient.SqlConnection]::new($SqlServerConnectionString)
  $connection.Open()
  try {
    $command = $connection.CreateCommand()
    $command.CommandTimeout = 180
    $command.CommandText = $Query
    $reader = $command.ExecuteReader()
    $map = [ordered]@{}
    while ($reader.Read()) {
      $map[[string]$reader.GetValue(0)] = [int]$reader.GetValue(1)
    }
    $reader.Close()
    return $map
  } finally {
    $connection.Close()
  }
}

function Invoke-PostgresScalarMap {
  param([string]$Query)

  $raw = $Query | ssh -i $SshKey "$NasUser@$NasHost" "sudo /usr/local/bin/docker exec -i -e PGPASSWORD='$PgPassword' $PgContainer psql -U $PgUser -d $PgDatabase -t -A -F '|'"
  if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL query failed ($LASTEXITCODE)."
  }

  $map = [ordered]@{}
  foreach ($line in ($raw -split "`n")) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $parts = $line.Split("|", 2)
    if ($parts.Count -eq 2) {
      $map[$parts[0]] = [int]$parts[1]
    }
  }
  return $map
}

function Compare-LegacySyncCounts {
  $mssql = Invoke-SqlServerScalarMap @"
SELECT 'Newcomer' AS metric, COUNT(*) FROM dbo.Newcomer
UNION ALL SELECT 'Shepherd', COUNT(*) FROM dbo.Shepherd
UNION ALL SELECT 'NewcomerTrack', COUNT(*) FROM dbo.NewcomerTrack
UNION ALL SELECT 'CourseClassification', COUNT(*) FROM dbo.CourseClassification
UNION ALL SELECT 'Course', COUNT(*) FROM dbo.Course
UNION ALL
SELECT 'CourseMemberValid', COUNT(*)
FROM (
  SELECT cm.CourseMember002, cm.CourseMember005
  FROM dbo.CourseMember cm
  WHERE EXISTS (SELECT 1 FROM dbo.Newcomer n WHERE n.Newcomer001 = cm.CourseMember002)
    AND EXISTS (SELECT 1 FROM dbo.Course c WHERE c.Course001 = cm.CourseMember005)
  GROUP BY cm.CourseMember002, cm.CourseMember005
) source_enrollments
UNION ALL SELECT 'QuietTimePrice', COUNT(*) FROM dbo.QuietTimePrice
UNION ALL SELECT 'QuietTimeOrderPaymentType', COUNT(*) FROM dbo.QuietTimeOrderPaymentType
UNION ALL SELECT 'QuietTimeInventoryDetail', COUNT(*) FROM dbo.QuietTimeInventoryDetail
UNION ALL SELECT 'QuietTimeOrder', COUNT(*) FROM dbo.QuietTimeOrder
UNION ALL
SELECT 'QuietTimeOrderItemValid', COUNT(*)
FROM dbo.QuietTimeOrderItem item
WHERE EXISTS (
  SELECT 1
  FROM dbo.QuietTimeOrder orders
  WHERE orders.QuietTimeOrder001 = item.QuietTimeOrderItem002
)
UNION ALL SELECT 'WorshipWeekend', COUNT(*) FROM dbo.WorshipWeekend
UNION ALL SELECT 'RollcallType', COUNT(*) FROM dbo.RollcallType
UNION ALL
SELECT 'NewcomerWorshipRecordValid', COUNT(*)
FROM dbo.NewcomerWorshipRecord record
WHERE EXISTS (SELECT 1 FROM dbo.WorshipWeekend event WHERE event.WorshipWeekend001 = record.NewcomerWorshipRecord002)
  AND EXISTS (SELECT 1 FROM dbo.RollcallType type WHERE type.RollcallType001 = record.NewcomerWorshipRecord004)
  AND EXISTS (SELECT 1 FROM dbo.Newcomer member WHERE member.Newcomer001 = record.NewcomerWorshipRecord003);
"@

  $postgres = Invoke-PostgresScalarMap @"
SELECT 'Newcomer' AS metric, COUNT(*) FROM pastoral_members WHERE is_active
UNION ALL SELECT 'Shepherd', COUNT(*) FROM pastoral_groups
UNION ALL SELECT 'NewcomerTrack', COUNT(*) FROM pastoral_care_records
UNION ALL SELECT 'CourseClassification', COUNT(*) FROM education_course_categories
UNION ALL SELECT 'Course', COUNT(*) FROM education_courses
UNION ALL SELECT 'CourseMemberValid', COUNT(*) FROM education_enrollments
UNION ALL SELECT 'QuietTimePrice', COUNT(*) FROM qt_price_plans
UNION ALL SELECT 'QuietTimeOrderPaymentType', COUNT(*) FROM qt_payment_types
UNION ALL SELECT 'QuietTimeInventoryDetail', COUNT(*) FROM qt_inventory_movements WHERE source_system = 'legacy_quiet_time'
UNION ALL SELECT 'QuietTimeOrder', COUNT(*) FROM qt_orders
UNION ALL SELECT 'QuietTimeOrderItemValid', COUNT(*) FROM qt_order_items
UNION ALL SELECT 'WorshipWeekend', COUNT(*) FROM attendance_events
UNION ALL SELECT 'RollcallType', COUNT(*) FROM attendance_types
UNION ALL SELECT 'NewcomerWorshipRecordValid', COUNT(*) FROM attendance_records WHERE source_system = 'legacy_mssql';
"@

  $metricNames = @(
    "Newcomer",
    "Shepherd",
    "NewcomerTrack",
    "CourseClassification",
    "Course",
    "CourseMemberValid",
    "QuietTimePrice",
    "QuietTimeOrderPaymentType",
    "QuietTimeInventoryDetail",
    "QuietTimeOrder",
    "QuietTimeOrderItemValid",
    "WorshipWeekend",
    "RollcallType",
    "NewcomerWorshipRecordValid"
  )

  $hasMismatch = $false
  $rows = foreach ($metric in $metricNames) {
    $source = $mssql[$metric]
    $target = $postgres[$metric]
    $matched = $source -eq $target
    if (-not $matched) { $hasMismatch = $true }
    [pscustomobject]@{
      Metric = $metric
      MSSQL = $source
      Postgres = $target
      Match = $matched
    }
  }

  $rows | Format-Table -AutoSize

  if ($hasMismatch) {
    throw "MSSQL/PostgreSQL legacy sync counts do not match."
  }
}

function Invoke-SyncStep {
  param(
    [string]$Name,
    [scriptblock]$Script
  )

  Write-Host ""
  Write-Host "== $Name =="
  $startedAt = Get-Date
  & $Script
  $elapsed = (Get-Date) - $startedAt
  Write-Host ("OK {0} ({1:n1}s)" -f $Name, $elapsed.TotalSeconds)
}

Start-Transcript -Path $logPath | Out-Null

try {
  Set-Location $root
  Write-Host "TopChurchPlus legacy weekly sync started at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
  Write-Host "Log: $logPath"

  Invoke-SyncStep "Generate pastoral import SQL" {
    Invoke-ExternalCommand "powershell.exe" @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ".\database\import_pastoral_from_sqlserver.ps1", "-GenerateOnly")
  }

  Invoke-SyncStep "Build safe pastoral import SQL" {
    Invoke-ExternalCommand "powershell.exe" @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ".\database\build_safe_pastoral_import.ps1")
  }

  Invoke-SyncStep "Generate education import SQL" {
    Invoke-ExternalCommand "powershell.exe" @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ".\database\import_education_from_sqlserver.ps1")
  }

  Invoke-SyncStep "Generate attendance import SQL" {
    Invoke-ExternalCommand "powershell.exe" @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ".\database\import_attendance_from_sqlserver.ps1")
  }

  Invoke-SyncStep "Backup before pastoral education import" {
    $backupFile = "$NasProjectPath/backups/topchurchplus_before_weekly_pastoral_education_sync_$stamp.sql"
    Invoke-ExternalCommand "ssh" @("-i", $SshKey, "$NasUser@$NasHost", "cd $NasProjectPath && mkdir -p backups tmp_import && sudo /usr/local/bin/docker exec -e PGPASSWORD='$PgPassword' $PgContainer pg_dump -U $PgUser -d $PgDatabase > $backupFile")
    Write-Host "Backup: $backupFile"
  }

  Invoke-SyncStep "Copy pastoral education SQL files to NAS" {
    New-Item -ItemType Directory -Force -Path $tmpImportShare | Out-Null
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "pastoral_schema.sql") -Destination (Join-Path $tmpImportShare "pastoral_schema.sql") -Force
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "pastoral_import\generated_pastoral_import.safe.sql") -Destination (Join-Path $tmpImportShare "pastoral_import.safe.sql") -Force
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "20260605_education_schema.sql") -Destination (Join-Path $tmpImportShare "education_schema.sql") -Force
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "education_import_from_sqlserver.generated.sql") -Destination (Join-Path $tmpImportShare "education_import.sql") -Force
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "20260606_attendance_schema.sql") -Destination (Join-Path $tmpImportShare "attendance_schema.sql") -Force
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "attendance_import_from_sqlserver.generated.sql") -Destination (Join-Path $tmpImportShare "attendance_import.sql") -Force
  }

  Invoke-SyncStep "Import pastoral education data" {
    $remoteCommand = "cd $NasProjectPath && sudo /usr/local/bin/docker cp tmp_import/pastoral_schema.sql ${PgContainer}:/tmp/pastoral_schema.sql && sudo /usr/local/bin/docker cp tmp_import/pastoral_import.safe.sql ${PgContainer}:/tmp/pastoral_import.safe.sql && sudo /usr/local/bin/docker cp tmp_import/education_schema.sql ${PgContainer}:/tmp/education_schema.sql && sudo /usr/local/bin/docker cp tmp_import/education_import.sql ${PgContainer}:/tmp/education_import.sql && sudo /usr/local/bin/docker cp tmp_import/attendance_schema.sql ${PgContainer}:/tmp/attendance_schema.sql && sudo /usr/local/bin/docker cp tmp_import/attendance_import.sql ${PgContainer}:/tmp/attendance_import.sql && sudo /usr/local/bin/docker exec -e PGPASSWORD='$PgPassword' $PgContainer psql -U $PgUser -d $PgDatabase -v ON_ERROR_STOP=1 -q -f /tmp/pastoral_schema.sql && sudo /usr/local/bin/docker exec -e PGPASSWORD='$PgPassword' $PgContainer psql -U $PgUser -d $PgDatabase -v ON_ERROR_STOP=1 -q -f /tmp/pastoral_import.safe.sql && sudo /usr/local/bin/docker exec -e PGPASSWORD='$PgPassword' $PgContainer psql -U $PgUser -d $PgDatabase -v ON_ERROR_STOP=1 -q -f /tmp/education_schema.sql && sudo /usr/local/bin/docker exec -e PGPASSWORD='$PgPassword' $PgContainer psql -U $PgUser -d $PgDatabase -v ON_ERROR_STOP=1 -q -f /tmp/education_import.sql && sudo /usr/local/bin/docker exec -e PGPASSWORD='$PgPassword' $PgContainer psql -U $PgUser -d $PgDatabase -v ON_ERROR_STOP=1 -q -f /tmp/attendance_schema.sql && sudo /usr/local/bin/docker exec -e PGPASSWORD='$PgPassword' $PgContainer psql -U $PgUser -d $PgDatabase -v ON_ERROR_STOP=1 -q -f /tmp/attendance_import.sql"
    Invoke-ExternalCommand "ssh" @("-i", $SshKey, "$NasUser@$NasHost", $remoteCommand)
  }

  Invoke-SyncStep "Generate QT import SQL" {
    Invoke-ExternalCommand "powershell.exe" @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ".\database\import_qt_from_sqlserver.ps1", "-GenerateOnly")
  }

  Invoke-SyncStep "Backup before QT import" {
    $backupFile = "$NasProjectPath/backups/topchurchplus_before_weekly_qt_sync_$stamp.sql"
    Invoke-ExternalCommand "ssh" @("-i", $SshKey, "$NasUser@$NasHost", "cd $NasProjectPath && mkdir -p backups tmp_import && sudo /usr/local/bin/docker exec -e PGPASSWORD='$PgPassword' $PgContainer pg_dump -U $PgUser -d $PgDatabase > $backupFile")
    Write-Host "Backup: $backupFile"
  }

  Invoke-SyncStep "Import QT data" {
    New-Item -ItemType Directory -Force -Path $tmpImportShare | Out-Null
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "qt_import\generated_qt_import.sql") -Destination (Join-Path $tmpImportShare "qt_import.sql") -Force
    $remoteCommand = "cd $NasProjectPath && sudo /usr/local/bin/docker cp tmp_import/qt_import.sql ${PgContainer}:/tmp/qt_import.sql && sudo /usr/local/bin/docker exec -e PGPASSWORD='$PgPassword' $PgContainer psql -U $PgUser -d $PgDatabase -v ON_ERROR_STOP=1 -q -f /tmp/qt_import.sql"
    Invoke-ExternalCommand "ssh" @("-i", $SshKey, "$NasUser@$NasHost", $remoteCommand)
  }

  Invoke-SyncStep "Compare MSSQL and PostgreSQL counts" {
    Compare-LegacySyncCounts
  }

  Write-Host ""
  Write-Host "TopChurchPlus legacy weekly sync completed at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
} catch {
  Write-Error $_
  throw
} finally {
  Stop-Transcript | Out-Null
  Write-Host "Sync log saved to $logPath"
}
