param(
  [string]$SqlServer = "192.168.3.6",
  [string]$SqlDatabase = "TopChurch",
  [string]$SqlUser = "TopChurch",
  [string]$SqlPassword = "TopChurch",
  [string]$NasHost = "192.168.3.2",
  [string]$NasUser = "cetu",
  [string]$NasProjectPath = "/volume1/docker/project-api",
  [string]$SshKey = "$env:USERPROFILE\.ssh\project_api_deploy",
  [string]$PgContainer = "TopProject",
  [string]$PgDatabase = "postgres",
  [string]$PgUser = "Codex",
  [string]$PgPassword = "SuperSmart",
  [switch]$GenerateOnly,
  [switch]$Append
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$importDir = Join-Path $PSScriptRoot "pastoral_permission_import"
$importPath = Join-Path $importDir "generated_pastoral_permission_import.sql"
$unmatchedPath = Join-Path $importDir "unmatched_pastoral_permission_accounts.csv"
New-Item -ItemType Directory -Force -Path $importDir | Out-Null

function Invoke-SourceQuery([string]$Query) {
  $connectionString = "Server=$SqlServer;Database=$SqlDatabase;User ID=$SqlUser;Password=$SqlPassword;Encrypt=False;TrustServerCertificate=True;Connection Timeout=30;"
  $connection = New-Object System.Data.SqlClient.SqlConnection($connectionString)
  $command = $connection.CreateCommand()
  $command.CommandTimeout = 180
  $command.CommandText = $Query
  $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($command)
  $table = New-Object System.Data.DataTable
  [void]$adapter.Fill($table)
  $connection.Close()
  return ,$table
}

function SqlValue($Value) {
  if ($null -eq $Value -or $Value -is [DBNull]) { return "NULL" }
  if ($Value -is [int] -or $Value -is [long]) { return [string]$Value }
  $text = [string]$Value
  if ([string]::IsNullOrWhiteSpace($text)) { return "NULL" }
  return "'" + $text.Trim().Replace("'", "''") + "'"
}

function Col($Row, [string]$Name) {
  return $Row[$Name]
}

Write-Host "讀取舊系統 AccountSynagoguePrivilege..."
$sourceRows = Invoke-SourceQuery @"
SELECT
  lower(a.Account001) AS email,
  a.Account003 AS name,
  a.Account007 AS legacy_account_id,
  p.AccountSynagoguePrivilege002 AS church_id
FROM Account a
JOIN AccountSynagoguePrivilege p ON p.AccountSynagoguePrivilege001 = a.Account007
ORDER BY a.Account007, p.AccountSynagoguePrivilege002;
"@

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("BEGIN;")
if (-not $Append) {
  $lines.Add("DELETE FROM account_pastoral_church_permissions;")
}

$lines.Add("CREATE TEMP TABLE tmp_pastoral_permission_source (email text, name text, legacy_account_id integer, church_id integer) ON COMMIT DROP;")

foreach ($row in $sourceRows.Rows) {
  $lines.Add(
    "INSERT INTO tmp_pastoral_permission_source (email, name, legacy_account_id, church_id) VALUES (" +
    ((SqlValue (Col $row "email")), (SqlValue (Col $row "name")), (SqlValue (Col $row "legacy_account_id")), (SqlValue (Col $row "church_id")) -join ", ") +
    ");"
  )
}

$lines.Add(@"
WITH name_counts AS (
  SELECT name, count(*) AS count
  FROM accounts
  GROUP BY name
),
matched AS (
  SELECT DISTINCT ON (src.legacy_account_id, src.church_id)
    a.staff_id,
    src.church_id
  FROM tmp_pastoral_permission_source src
  JOIN accounts a ON (
    lower(coalesce(a.email, '')) = src.email
    OR (
      NOT EXISTS (
        SELECT 1
        FROM accounts email_account
        WHERE lower(coalesce(email_account.email, '')) = src.email
      )
      AND a.name = src.name
      AND EXISTS (
        SELECT 1
        FROM name_counts nc
        WHERE nc.name = src.name
          AND nc.count = 1
      )
    )
  )
  JOIN churches c ON c.id = src.church_id
  ORDER BY src.legacy_account_id, src.church_id,
    CASE WHEN lower(coalesce(a.email, '')) = src.email THEN 0 ELSE 1 END
)
INSERT INTO account_pastoral_church_permissions (staff_id, church_id)
SELECT staff_id, church_id
FROM matched
ON CONFLICT (staff_id, church_id) DO NOTHING;
"@)

$lines.Add(@"
CREATE TEMP TABLE tmp_pastoral_permission_unmatched AS
SELECT DISTINCT src.email, src.name, src.legacy_account_id
FROM tmp_pastoral_permission_source src
WHERE NOT EXISTS (
  SELECT 1
  FROM accounts a
  WHERE lower(coalesce(a.email, '')) = src.email
)
AND NOT EXISTS (
  SELECT 1
  FROM accounts a
  JOIN (
    SELECT name, count(*) AS count
    FROM accounts
    GROUP BY name
  ) nc ON nc.name = a.name AND nc.count = 1
  WHERE a.name = src.name
);
"@)

$lines.Add(@"
SELECT 'inserted_permissions' AS metric, count(*)::text AS value
FROM account_pastoral_church_permissions
UNION ALL
SELECT 'unmatched_accounts', count(*)::text
FROM tmp_pastoral_permission_unmatched;
"@)
$lines.Add("COMMIT;")

[System.IO.File]::WriteAllLines($importPath, $lines, [System.Text.UTF8Encoding]::new($false))
Write-Host "已產生匯入 SQL：$importPath"
Write-Host "舊系統權限筆數：$($sourceRows.Rows.Count)"

if ($GenerateOnly) {
  return
}

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$NasProjectPath/backups/project_management_before_pastoral_permission_import_$stamp.sql"

Write-Host "備份 PostgreSQL：$backupFile"
ssh -i $SshKey "$NasUser@$NasHost" "cd $NasProjectPath && mkdir -p backups && sudo /usr/local/bin/docker exec -e PGPASSWORD='$PgPassword' $PgContainer pg_dump -U $PgUser -d $PgDatabase > $backupFile"

Write-Host "匯入牧養會堂權限"
Get-Content -Raw -Encoding UTF8 $importPath | ssh -i $SshKey "$NasUser@$NasHost" "sudo /usr/local/bin/docker exec -i -e PGPASSWORD='$PgPassword' $PgContainer psql -U $PgUser -d $PgDatabase -v ON_ERROR_STOP=1 -q"

Write-Host "產生未對應帳號報表"
$pgAccountRaw = @"
SELECT lower(coalesce(email,'')) AS email, staff_id, name
FROM accounts;
"@ | ssh -i $SshKey "$NasUser@$NasHost" "sudo /usr/local/bin/docker exec -i -e PGPASSWORD='$PgPassword' $PgContainer psql -U $PgUser -d $PgDatabase -t -A -F ','"

$pgAccounts = @()
foreach ($line in $pgAccountRaw -split "`n") {
  if (![string]::IsNullOrWhiteSpace($line)) {
    $parts = $line.Split(',', 3)
    $pgAccounts += [pscustomobject]@{ email = $parts[0]; staffId = $parts[1]; name = $parts[2] }
  }
}

$accountsByEmail = @{}
$accountsByName = @{}
foreach ($account in $pgAccounts) {
  if ($account.email) { $accountsByEmail[$account.email] = $account }
  if (-not $accountsByName.ContainsKey($account.name)) { $accountsByName[$account.name] = @() }
  $accountsByName[$account.name] += $account
}

$sourceAccounts = @{}
foreach ($row in $sourceRows.Rows) {
  $key = "$(Col $row "email")|$(Col $row "name")|$(Col $row "legacy_account_id")"
  if (-not $sourceAccounts.ContainsKey($key)) {
    $sourceAccounts[$key] = [pscustomobject]@{
      email = [string](Col $row "email")
      name = [string](Col $row "name")
      legacy_account_id = [int](Col $row "legacy_account_id")
    }
  }
}

$unmatched = @()
foreach ($sourceAccount in $sourceAccounts.Values | Sort-Object legacy_account_id) {
  if ($accountsByEmail.ContainsKey($sourceAccount.email)) { continue }
  if ($accountsByName.ContainsKey($sourceAccount.name) -and $accountsByName[$sourceAccount.name].Count -eq 1) { continue }
  $unmatched += $sourceAccount
}

$unmatched | Export-Csv -Path $unmatchedPath -NoTypeInformation -Encoding UTF8
Write-Host "未對應帳號報表：$unmatchedPath"
