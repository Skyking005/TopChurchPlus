param(
  [string]$SqlServerConnectionString = 'Server=192.168.3.6;Initial Catalog=TopChurch;Connection Timeout=10;User ID=TopChurch;Password=TopChurch;TrustServerCertificate=True;Encrypt=False;',
  [string]$OutputPath = 'database/education_import_from_sqlserver.generated.sql'
)

$ErrorActionPreference = 'Stop'

function ConvertTo-PgText {
  param($Value)
  if ($null -eq $Value -or [DBNull]::Value.Equals($Value) -or [string]$Value -eq '') {
    return 'NULL'
  }

  $text = [string]$Value
  $builder = [System.Text.StringBuilder]::new()
  foreach ($ch in $text.ToCharArray()) {
    $code = [int][char]$ch
    if ($ch -eq "'") {
      [void]$builder.Append("''")
    } elseif ($ch -eq '\') {
      [void]$builder.Append('\\')
    } elseif ($code -ge 32 -and $code -le 126) {
      [void]$builder.Append($ch)
    } elseif ($code -le 0xFFFF) {
      [void]$builder.Append('\' + $code.ToString('X4'))
    } else {
      [void]$builder.Append('\+' + $code.ToString('X6'))
    }
  }
  return "U&'$($builder.ToString())'"
}

function ConvertTo-PgDate {
  param($Value)
  if ($null -eq $Value -or [DBNull]::Value.Equals($Value)) {
    return 'NULL'
  }
  return "'$(([datetime]$Value).ToString('yyyy-MM-dd'))'"
}

function ConvertTo-PgBool {
  param($Value)
  if ([bool]$Value) { return 'true' }
  return 'false'
}

$connection = [System.Data.SqlClient.SqlConnection]::new($SqlServerConnectionString)
$connection.Open()

$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add('BEGIN;')
$lines.Add('TRUNCATE education_enrollments, education_courses, education_course_categories;')

$command = $connection.CreateCommand()
$command.CommandText = 'SELECT CourseClassification001, CourseClassification002, CourseClassification003, CourseClassification004, CourseClassification005 FROM dbo.CourseClassification ORDER BY CourseClassification001'
$reader = $command.ExecuteReader()
while ($reader.Read()) {
  $lines.Add("INSERT INTO education_course_categories (category_id, category_name, is_class, sort_order, group_code) VALUES ($($reader.GetValue(0)), $(ConvertTo-PgText $reader.GetValue(1)), $(ConvertTo-PgBool $reader.GetValue(2)), $($reader.GetValue(3)), $($reader.GetValue(4))) ON CONFLICT (category_id) DO UPDATE SET category_name = EXCLUDED.category_name, is_class = EXCLUDED.is_class, sort_order = EXCLUDED.sort_order, group_code = EXCLUDED.group_code, updated_at = now();")
}
$reader.Close()

$command = $connection.CreateCommand()
$command.CommandText = 'SELECT Course001, Course002, Course003, Course004, Course005 FROM dbo.Course ORDER BY Course001'
$reader = $command.ExecuteReader()
while ($reader.Read()) {
  $lines.Add("INSERT INTO education_courses (course_id, category_id, course_name, start_date, end_date) VALUES ($($reader.GetValue(0)), $($reader.GetValue(1)), $(ConvertTo-PgText $reader.GetValue(2)), $(ConvertTo-PgDate $reader.GetValue(3)), $(ConvertTo-PgDate $reader.GetValue(4))) ON CONFLICT (course_id) DO UPDATE SET category_id = EXCLUDED.category_id, course_name = EXCLUDED.course_name, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, updated_at = now();")
}
$reader.Close()

$command = $connection.CreateCommand()
$command.CommandText = 'SELECT CourseMember001, CourseMember002, CourseMember003, CourseMember004, CourseMember005 FROM dbo.CourseMember ORDER BY CourseMember001'
$reader = $command.ExecuteReader()
while ($reader.Read()) {
  $memberId = $reader.GetValue(1)
  $courseId = $reader.GetValue(4)
  $lines.Add("INSERT INTO education_enrollments (enrollment_id, member_id, is_completed, note, course_id) SELECT $($reader.GetValue(0)), $memberId, $(ConvertTo-PgBool $reader.GetValue(2)), $(ConvertTo-PgText $reader.GetValue(3)), $courseId WHERE EXISTS (SELECT 1 FROM pastoral_members WHERE id = $memberId) AND EXISTS (SELECT 1 FROM education_courses WHERE course_id = $courseId) ON CONFLICT (member_id, course_id) DO UPDATE SET is_completed = EXCLUDED.is_completed, note = EXCLUDED.note, updated_at = now();")
}
$reader.Close()
$connection.Close()

$lines.Add('COMMIT;')

$resolvedOutput = Resolve-Path -Path (Split-Path -Parent $OutputPath) -ErrorAction SilentlyContinue
if (-not $resolvedOutput) {
  New-Item -ItemType Directory -Path (Split-Path -Parent $OutputPath) -Force | Out-Null
}
[System.IO.File]::WriteAllLines((Join-Path (Get-Location) $OutputPath), $lines, [System.Text.Encoding]::ASCII)
Write-Output "Wrote $($lines.Count) SQL lines to $OutputPath"
