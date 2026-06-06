param(
  [string]$SqlServerConnectionString = "Server=192.168.3.6;Initial Catalog=TopChurch;Connection Timeout=10;User ID=TopChurch;Password=TopChurch;TrustServerCertificate=True;Encrypt=False;",
  [string]$NasHost = "192.168.3.2",
  [string]$NasUser = "cetu",
  [string]$SshKey = "$env:USERPROFILE\.ssh\project_api_deploy",
  [string]$PgContainer = "TopProject",
  [string]$PgDatabase = "postgres",
  [string]$PgUser = "Codex",
  [string]$PgPassword = "SuperSmart"
)

$ErrorActionPreference = "Stop"
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

function Invoke-SqlServerScalarMap([string]$Query) {
  $connection = [System.Data.SqlClient.SqlConnection]::new($SqlServerConnectionString)
  $connection.Open()
  $command = $connection.CreateCommand()
  $command.CommandTimeout = 180
  $command.CommandText = $Query
  $reader = $command.ExecuteReader()
  $map = [ordered]@{}
  while ($reader.Read()) {
    $map[[string]$reader.GetValue(0)] = [int]$reader.GetValue(1)
  }
  $reader.Close()
  $connection.Close()
  return $map
}

function Invoke-PostgresScalarMap([string]$Query) {
  $raw = $Query | ssh -i $SshKey "$NasUser@$NasHost" "sudo /usr/local/bin/docker exec -i -e PGPASSWORD='$PgPassword' $PgContainer psql -U $PgUser -d $PgDatabase -t -A -F '|'"
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
) source_enrollments;
"@

$postgres = Invoke-PostgresScalarMap @"
SELECT 'Newcomer' AS metric, COUNT(*) FROM pastoral_members WHERE is_active
UNION ALL SELECT 'Shepherd', COUNT(*) FROM pastoral_groups
UNION ALL SELECT 'NewcomerTrack', COUNT(*) FROM pastoral_care_records
UNION ALL SELECT 'CourseClassification', COUNT(*) FROM education_course_categories
UNION ALL SELECT 'Course', COUNT(*) FROM education_courses
UNION ALL SELECT 'CourseMemberValid', COUNT(*) FROM education_enrollments;
"@

$metricNames = @(
  "Newcomer",
  "Shepherd",
  "NewcomerTrack",
  "CourseClassification",
  "Course",
  "CourseMemberValid"
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
  throw "MSSQL/PostgreSQL pastoral or education counts do not match."
}

Write-Output "MSSQL/PostgreSQL pastoral and education count check passed."
