param(
  [string]$SqlServerConnectionString = "Server=tcp:192.168.3.6,1433;Initial Catalog=TopChurch;Connection Timeout=30;User ID=TopChurch;Password=TopChurch;TrustServerCertificate=True;Encrypt=False;",
  [string]$OutputPath = "database/attendance_import_from_sqlserver.generated.sql",
  [int]$BatchSize = 1000
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)

$root = Split-Path -Parent $PSScriptRoot
$resolvedOutputPath = if ([System.IO.Path]::IsPathRooted($OutputPath)) { $OutputPath } else { Join-Path $root $OutputPath }
$outputDir = Split-Path -Parent $resolvedOutputPath
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

function Invoke-SourceQuery {
  param([string]$Query)

  $connection = [System.Data.SqlClient.SqlConnection]::new($SqlServerConnectionString)
  $connection.Open()
  try {
    $command = $connection.CreateCommand()
    $command.CommandTimeout = 300
    $command.CommandText = $Query
    $adapter = [System.Data.SqlClient.SqlDataAdapter]::new($command)
    $table = [System.Data.DataTable]::new()
    [void]$adapter.Fill($table)
    return ,$table
  } finally {
    $connection.Close()
  }
}

function ConvertTo-PgText {
  param($Value)

  if ($null -eq $Value -or [DBNull]::Value.Equals($Value) -or [string]$Value -eq '') {
    return "NULL"
  }

  $text = [string]$Value
  $builder = [System.Text.StringBuilder]::new()
  foreach ($ch in $text.ToCharArray()) {
    $code = [int][char]$ch
    if ($ch -eq "'") {
      [void]$builder.Append("''")
    } elseif ($ch -eq "\") {
      [void]$builder.Append("\\")
    } elseif ($code -ge 32 -and $code -le 126) {
      [void]$builder.Append($ch)
    } elseif ($code -le 0xFFFF) {
      [void]$builder.Append("\" + $code.ToString("X4"))
    } else {
      [void]$builder.Append("\+" + $code.ToString("X6"))
    }
  }
  return "U&'$($builder.ToString())'"
}

function ConvertTo-PgDate {
  param($Value)
  if ($null -eq $Value -or [DBNull]::Value.Equals($Value)) { return "NULL" }
  return "'" + ([datetime]$Value).ToString("yyyy-MM-dd") + "'"
}

function ConvertTo-PgTimestamp {
  param($Value)
  if ($null -eq $Value -or [DBNull]::Value.Equals($Value)) { return "NULL::timestamptz" }
  return "'" + ([datetime]$Value).ToString("yyyy-MM-dd HH:mm:ss.fff") + "'::timestamptz"
}

function ConvertTo-PgBool {
  param($Value)
  if ($null -eq $Value -or [DBNull]::Value.Equals($Value)) { return "false" }
  if ([bool]$Value) { return "true" }
  return "false"
}

function ConvertTo-WeekdayArray {
  param($Row)

  $days = [System.Collections.Generic.List[string]]::new()
  for ($i = 4; $i -le 10; $i++) {
    $name = "RollcallType" + $i.ToString().PadLeft(3, "0")
    if ($Row[$name] -isnot [DBNull] -and [bool]$Row[$name]) {
      [void]$days.Add([string]($i - 3))
    }
  }
  return "ARRAY[" + ($days -join ",") + "]::smallint[]"
}

function Flush-RecordBatch {
  param(
    [System.IO.StreamWriter]$Writer,
    [System.Collections.Generic.List[string]]$Batch
  )

  if ($Batch.Count -eq 0) { return }
  $Writer.WriteLine("INSERT INTO attendance_records (legacy_record_id, event_id, member_id, attendance_type_id, attendance_mode, recorded_at, source_system, source_id)")
  $Writer.WriteLine("SELECT v.legacy_record_id, e.id, v.member_id, v.attendance_type_id, v.attendance_mode, v.recorded_at, v.source_system, v.source_id")
  $Writer.WriteLine("FROM (VALUES")
  $Writer.WriteLine(($Batch -join ",`n"))
  $Writer.WriteLine(") AS v(legacy_record_id, legacy_worship_weekend_id, member_id, attendance_type_id, attendance_mode, recorded_at, source_system, source_id)")
  $Writer.WriteLine("JOIN attendance_events e ON e.legacy_worship_weekend_id = v.legacy_worship_weekend_id")
  $Writer.WriteLine("JOIN attendance_types t ON t.id = v.attendance_type_id")
  $Writer.WriteLine("JOIN pastoral_members pm ON pm.id = v.member_id")
  $Writer.WriteLine("ON CONFLICT (legacy_record_id) DO UPDATE SET event_id = EXCLUDED.event_id, member_id = EXCLUDED.member_id, attendance_type_id = EXCLUDED.attendance_type_id, attendance_mode = EXCLUDED.attendance_mode, recorded_at = EXCLUDED.recorded_at, source_system = EXCLUDED.source_system, source_id = EXCLUDED.source_id, updated_at = now();")
  $Batch.Clear()
}

Write-Host "Reading SQL Server attendance data..."
$events = Invoke-SourceQuery "SELECT WorshipWeekend001, WorshipWeekend002 FROM dbo.WorshipWeekend ORDER BY WorshipWeekend001"
$types = Invoke-SourceQuery "SELECT RollcallType001, RollcallType002, RollcallType003, RollcallType004, RollcallType005, RollcallType006, RollcallType007, RollcallType008, RollcallType009, RollcallType010 FROM dbo.RollcallType ORDER BY RollcallType001"
$records = Invoke-SourceQuery "SELECT NewcomerWorshipRecord001, NewcomerWorshipRecord002, NewcomerWorshipRecord003, NewcomerWorshipRecord004, NewcomerWorshipRecord005, NewcomerWorshipRecord006 FROM dbo.NewcomerWorshipRecord ORDER BY NewcomerWorshipRecord001"

$writer = [System.IO.StreamWriter]::new($resolvedOutputPath, $false, [System.Text.Encoding]::ASCII)
try {
  $writer.WriteLine("BEGIN;")
  $writer.WriteLine("DELETE FROM attendance_records WHERE source_system = 'legacy_mssql';")

  foreach ($row in $events.Rows) {
    $id = [int]$row["WorshipWeekend001"]
    $eventDate = ConvertTo-PgDate $row["WorshipWeekend002"]
    $title = ConvertTo-PgText (([datetime]$row["WorshipWeekend002"]).ToString("yyyy-MM-dd"))
    $writer.WriteLine("INSERT INTO attendance_events (legacy_worship_weekend_id, event_date, title) VALUES ($id, $eventDate, $title) ON CONFLICT (legacy_worship_weekend_id) DO UPDATE SET event_date = EXCLUDED.event_date, title = EXCLUDED.title, updated_at = now();")
  }

  foreach ($row in $types.Rows) {
    $id = [int]$row["RollcallType001"]
    $name = ConvertTo-PgText $row["RollcallType002"]
    $isAreaBased = ConvertTo-PgBool $row["RollcallType003"]
    $activeWeekdays = ConvertTo-WeekdayArray $row
    $writer.WriteLine("INSERT INTO attendance_types (id, name, is_area_based, active_weekdays, is_active, sort_order) VALUES ($id, $name, $isAreaBased, $activeWeekdays, true, $id) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_area_based = EXCLUDED.is_area_based, active_weekdays = EXCLUDED.active_weekdays, is_active = EXCLUDED.is_active, sort_order = EXCLUDED.sort_order, updated_at = now();")
  }

  $batch = [System.Collections.Generic.List[string]]::new()
  foreach ($row in $records.Rows) {
    $legacyId = [int]$row["NewcomerWorshipRecord001"]
    $weekendId = [int]$row["NewcomerWorshipRecord002"]
    $memberId = [int]$row["NewcomerWorshipRecord003"]
    $typeId = [int]$row["NewcomerWorshipRecord004"]
    $mode = if ($row["NewcomerWorshipRecord005"] -isnot [DBNull] -and [bool]$row["NewcomerWorshipRecord005"]) { "online" } else { "physical" }
    $recordedAt = ConvertTo-PgTimestamp $row["NewcomerWorshipRecord006"]
    $sourceId = "NewcomerWorshipRecord:$legacyId"
    [void]$batch.Add("($legacyId, $weekendId, $memberId, $typeId, '$mode', $recordedAt, 'legacy_mssql', '$sourceId')")
    if ($batch.Count -ge $BatchSize) {
      Flush-RecordBatch $writer $batch
    }
  }
  Flush-RecordBatch $writer $batch

  $writer.WriteLine("COMMIT;")
} finally {
  $writer.Close()
}

Write-Host "Generated attendance import SQL: $resolvedOutputPath"
Write-Host ("Source counts: events {0}, types {1}, records {2}" -f $events.Rows.Count, $types.Rows.Count, $records.Rows.Count)
