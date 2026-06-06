param(
  [string]$InputPath = "database/pastoral_import/generated_pastoral_import.sql",
  [string]$OutputPath = "database/pastoral_import/generated_pastoral_import.safe.sql"
)

$ErrorActionPreference = "Stop"
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

function Split-Columns([string]$ColumnsText) {
  return $ColumnsText.Split(",") | ForEach-Object { $_.Trim() }
}

function Build-Upsert([string]$Table, [string]$ColumnsText, [string]$ValuesText, [string[]]$KeyColumns) {
  $columns = @(Split-Columns $ColumnsText)
  $keySet = @{}
  foreach ($key in $KeyColumns) { $keySet[$key] = $true }

  $assignments = New-Object System.Collections.Generic.List[string]
  foreach ($column in $columns) {
    if (-not $keySet.ContainsKey($column)) {
      $assignments.Add("$column = EXCLUDED.$column")
    }
  }
  if ($assignments.Count -gt 0) {
    $assignments.Add("updated_at = now()")
  }

  if ($assignments.Count -eq 0) {
    return "INSERT INTO $Table ($ColumnsText) VALUES ($ValuesText) ON CONFLICT (" + ($KeyColumns -join ", ") + ") DO NOTHING;"
  }

  return "INSERT INTO $Table ($ColumnsText) VALUES ($ValuesText) ON CONFLICT (" + ($KeyColumns -join ", ") + ") DO UPDATE SET " + ($assignments -join ", ") + ";"
}

$conflictKeys = @{
  countries = @("id")
  regions = @("id")
  churches = @("id")
  membership_categories = @("code")
  professions = @("id")
  pastoral_titles = @("id")
  marital_statuses = @("id")
  pastoral_group_types = @("id")
  pastoral_groups = @("id")
  pastoral_members = @("id")
  pastoral_member_contacts = @("member_id")
  pastoral_member_faith = @("member_id")
  pastoral_member_family_notes = @("member_id")
  pastoral_care_records = @("id")
  pastoral_group_leaders = @("id")
  relationship_types = @("id")
}

$safeReset = @(
  "TRUNCATE baptism_participants, baptism_events, pastoral_member_files, pastoral_member_relationships, pastoral_member_family_notes, pastoral_care_records, pastoral_group_leaders, pastoral_member_group_assignments, pastoral_member_faith, pastoral_member_addresses, pastoral_member_contacts, pastoral_group_closure, pastoral_groups RESTART IDENTITY;"
)

function Convert-Statement([string]$Statement) {
  if ($Statement -like "TRUNCATE *") {
    return $safeReset
  }

  $match = [regex]::Match($Statement, "(?s)^INSERT INTO ([a-z_]+) \((.+?)\) VALUES \((.*)\);$")
  if ($match.Success) {
    $table = $match.Groups[1].Value
    $columnsText = $match.Groups[2].Value
    $valuesText = $match.Groups[3].Value

    if ($table -eq "pastoral_members") {
      $idMatch = [regex]::Match($valuesText, "^\s*(\d+)\s*,")
      if ($idMatch.Success) { $sourceMemberIds.Add($idMatch.Groups[1].Value) }
    }

    if ($conflictKeys.ContainsKey($table)) {
      return @((Build-Upsert $table $columnsText $valuesText $conflictKeys[$table]))
    }
  }

  return @($Statement)
}

$inputFullPath = Join-Path (Get-Location) $InputPath
$outputFullPath = Join-Path (Get-Location) $OutputPath
$lines = [System.IO.File]::ReadAllLines($inputFullPath, [System.Text.UTF8Encoding]::new($false))
$output = New-Object System.Collections.Generic.List[string]
$sourceMemberIds = New-Object System.Collections.Generic.List[string]
$pending = $null

foreach ($line in $lines) {
  if ($null -ne $pending) {
    $pending = $pending + "`n" + $line
    if ($line.TrimEnd().EndsWith(";")) {
      foreach ($convertedLine in (Convert-Statement $pending)) { $output.Add($convertedLine) }
      $pending = $null
    }
    continue
  }

  if ($line -eq "COMMIT;") {
    if ($sourceMemberIds.Count -gt 0) {
      $chunkSize = 1000
      for ($i = 0; $i -lt $sourceMemberIds.Count; $i += $chunkSize) {
        $chunk = $sourceMemberIds[$i..([Math]::Min($i + $chunkSize - 1, $sourceMemberIds.Count - 1))]
        $output.Add("UPDATE pastoral_members SET is_active = true, updated_at = now() WHERE id IN (" + ($chunk -join ",") + ");")
      }
      $output.Add("UPDATE pastoral_members SET is_active = false, updated_at = now() WHERE id NOT IN (" + ($sourceMemberIds -join ",") + ");")
    }
    $output.Add($line)
    continue
  }

  if ($line -like "INSERT INTO *" -and -not $line.TrimEnd().EndsWith(";")) {
    $pending = $line
    continue
  }

  foreach ($convertedLine in (Convert-Statement $line)) { $output.Add($convertedLine) }
}

if ($null -ne $pending) {
  throw "Unterminated SQL statement while building safe import."
}

$outputDir = Split-Path -Parent $outputFullPath
if (-not (Test-Path -LiteralPath $outputDir)) {
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}
[System.IO.File]::WriteAllLines($outputFullPath, $output, [System.Text.UTF8Encoding]::new($false))
Write-Output "Wrote $($output.Count) safe SQL lines to $OutputPath"
