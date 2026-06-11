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
  [switch]$GenerateOnly
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$root = Split-Path -Parent $PSScriptRoot
$schemaPath = Join-Path $PSScriptRoot "pastoral_schema.sql"
$importDir = Join-Path $PSScriptRoot "pastoral_import"
$importPath = Join-Path $importDir "generated_pastoral_import.sql"
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
  if ($Value -is [bool]) { return $(if ($Value) { "true" } else { "false" }) }
  if ($Value -is [byte]) { return [string][int]$Value }
  if ($Value -is [int] -or $Value -is [long] -or $Value -is [decimal] -or $Value -is [double] -or $Value -is [single]) {
    return ([string]$Value).Replace(",", ".")
  }
  if ($Value -is [datetime]) {
    return "'" + $Value.ToString("yyyy-MM-dd HH:mm:ss.fff") + "'"
  }
  $text = [string]$Value
  if ([string]::IsNullOrWhiteSpace($text)) { return "NULL" }
  return "'" + $text.Replace("'", "''") + "'"
}

function BoolFromBit($Value) {
  if ($null -eq $Value -or $Value -is [DBNull]) { return $null }
  return [bool]$Value
}

function Get-IntOrNull($Value) {
  if ($null -eq $Value -or $Value -is [DBNull] -or [string]::IsNullOrWhiteSpace([string]$Value)) { return $null }
  return [int]$Value
}

function Col($Row, [string]$Name) {
  if ($null -eq $Row) { throw "資料列為空，無法讀取欄位 $Name" }
  return $Row[$Name]
}

function Add-Insert([System.Collections.Generic.List[string]]$Lines, [string]$Table, [string[]]$Columns, [object[]]$Values) {
  $escaped = $Values | ForEach-Object { SqlValue $_ }
  $Lines.Add("INSERT INTO $Table (" + ($Columns -join ", ") + ") VALUES (" + ($escaped -join ", ") + ");")
}

function Get-RegionFromAddress([string]$Address) {
  if ([string]::IsNullOrWhiteSpace($Address)) { return $null }
  $clean = $Address.Trim()
  $match = [regex]::Match($clean, "^(?<postal>\d{3})?(?<city>[^縣市]{1,8}[縣市])(?<district>[^區鄉鎮市]{1,8}[區鄉鎮市])")
  if (-not $match.Success) { return $null }
  return [pscustomobject]@{
    PostalCode = $match.Groups["postal"].Value
    City = $match.Groups["city"].Value
    District = $match.Groups["district"].Value
  }
}

Write-Host "讀取 SQL Server 牧養資料..."
$tables = @{
  Churches = Invoke-SourceQuery "SELECT Synagogue001, Synagogue002, Synagogue003, Synagogue004, Synagogue005 FROM Synagogue ORDER BY Synagogue001"
  Categories = Invoke-SourceQuery "SELECT NewcomerClassification001, NewcomerClassification002 FROM NewcomerClassification ORDER BY NewcomerClassification001"
  Professions = Invoke-SourceQuery "SELECT MembershipProfession001, MembershipProfession002 FROM MembershipProfession ORDER BY MembershipProfession001"
  Titles = Invoke-SourceQuery "SELECT Title001, Title002 FROM Title ORDER BY Title001"
  MaritalStatuses = Invoke-SourceQuery "SELECT MembershipMaritalStatus001, MembershipMaritalStatus002, MembershipMaritalStatus003 FROM MembershipMaritalStatus ORDER BY MembershipMaritalStatus001"
  Groups = Invoke-SourceQuery "SELECT Shepherd001, Shepherd002, Shepherd003, Shepherd004, Shepherd005, Shepherd006, Shepherd007, Shepherd008, Shepherd009 FROM Shepherd ORDER BY Shepherd002, Shepherd001"
  Members = Invoke-SourceQuery "SELECT * FROM Newcomer ORDER BY Newcomer001"
  Tracks = Invoke-SourceQuery "SELECT NewcomerTrack001, NewcomerTrack002, NewcomerTrack003, NewcomerTrack004, CONVERT(nvarchar(max), NewcomerTrack005) AS NewcomerTrack005 FROM NewcomerTrack ORDER BY NewcomerTrack001"
  Leaders = Invoke-SourceQuery "SELECT ShepherdLeader001, ShepherdLeader002, ShepherdLeader003 FROM ShepherdLeader ORDER BY ShepherdLeader001"
}

$groupById = New-Object 'System.Collections.Generic.Dictionary[int,object]'
foreach ($row in $tables["Groups"].Rows) {
  $groupById[[int](Col $row "Shepherd001")] = $row
}

function Get-ChurchIdForGroup([int]$GroupId) {
  if (-not $groupById.ContainsKey($GroupId)) { return $null }
  $current = $groupById[$GroupId]
  for ($i = 0; $i -lt 20; $i++) {
    $level = Get-IntOrNull (Col $current "Shepherd002")
    if ($level -eq 0) { return Get-IntOrNull (Col $current "Shepherd001") }
    $parentId = Get-IntOrNull (Col $current "Shepherd003")
    if ($null -eq $parentId -or -not $groupById.ContainsKey($parentId)) {
      return Get-IntOrNull (Col $current "Shepherd005")
    }
    $current = $groupById[$parentId]
  }
  return $null
}

function Get-GroupPath([int]$GroupId) {
  $names = New-Object System.Collections.Generic.List[string]
  $currentId = $GroupId
  for ($i = 0; $i -lt 20; $i++) {
    if (-not $groupById.ContainsKey($currentId)) { break }
    $row = $groupById[$currentId]
    $names.Insert(0, [string](Col $row "Shepherd004"))
    $level = Get-IntOrNull (Col $row "Shepherd002")
    $parentId = Get-IntOrNull (Col $row "Shepherd003")
    if ($level -eq 0 -and $parentId -eq 0) { break }
    if ($null -eq $parentId -or $parentId -eq $currentId) { break }
    $currentId = $parentId
  }
  return ($names -join " / ")
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("BEGIN;")
$lines.Add("SET CONSTRAINTS ALL DEFERRED;")
$lines.Add("TRUNCATE baptism_participants, baptism_events, pastoral_member_files, pastoral_member_relationships, pastoral_member_family_notes, pastoral_care_records, pastoral_group_leaders, pastoral_member_group_assignments, pastoral_member_faith, pastoral_member_addresses, pastoral_member_contacts, pastoral_members, pastoral_group_closure, pastoral_groups, pastoral_group_types, relationship_types, marital_statuses, pastoral_titles, professions, membership_categories, churches, regions, countries RESTART IDENTITY CASCADE;")

Add-Insert $lines "countries" @("id","code","name") @(1,"TW","台灣")
Add-Insert $lines "countries" @("id","code","name") @(2,"CA","加拿大")

$regionMap = @{}
$nextRegionId = 1
foreach ($church in $tables["Churches"].Rows) {
  $address = [string](Col $church "Synagogue004")
  $countryId = if ([string](Col $church "Synagogue002") -like "*溫哥華*") { 2 } else { 1 }
  $parsed = Get-RegionFromAddress $address
  if ($parsed) {
    $key = "$countryId|$($parsed.City)|$($parsed.District)|$($parsed.PostalCode)"
    if (-not $regionMap.ContainsKey($key)) {
      $regionMap[$key] = $nextRegionId
      Add-Insert $lines "regions" @("id","country_id","city","district","postal_code") @($nextRegionId,$countryId,$parsed.City,$parsed.District,$parsed.PostalCode)
      $nextRegionId++
    }
  }
}

foreach ($church in $tables["Churches"].Rows) {
  $id = [int](Col $church "Synagogue001")
  $address = [string](Col $church "Synagogue004")
  $countryId = if ([string](Col $church "Synagogue002") -like "*溫哥華*") { 2 } else { 1 }
  $regionId = $null
  $parsed = Get-RegionFromAddress $address
  if ($parsed) {
    $key = "$countryId|$($parsed.City)|$($parsed.District)|$($parsed.PostalCode)"
    $regionId = $regionMap[$key]
  }
  $churchType = if ($id -eq 0) { "無會堂" } elseif ($id -eq 7) { "友會" } else { "本會" }
  Add-Insert $lines "churches" @("id","code","name","church_type","country_id","region_id","phone","address","tax_id","sort_order") @($id,"S$id",(Col $church "Synagogue002"),$churchType,$countryId,$regionId,(Col $church "Synagogue003"),(Col $church "Synagogue004"),(Col $church "Synagogue005"),$id)
}

foreach ($row in $tables["Categories"].Rows) {
  $code = [string](Col $row "NewcomerClassification001")
  Add-Insert $lines "membership_categories" @("code","name","is_member","is_external","sort_order") @($code,(Col $row "NewcomerClassification002"),($code -eq "B"),($code -eq "Q"),[int][char]$code[0])
}
foreach ($row in $tables["Professions"].Rows) {
  Add-Insert $lines "professions" @("id","name","sort_order") @((Col $row "MembershipProfession001"),(Col $row "MembershipProfession002"),(Col $row "MembershipProfession001"))
}
foreach ($row in $tables["Titles"].Rows) {
  Add-Insert $lines "pastoral_titles" @("id","name","sort_order") @((Col $row "Title001"),(Col $row "Title002"),(Col $row "Title001"))
}
foreach ($row in $tables["MaritalStatuses"].Rows) {
  Add-Insert $lines "marital_statuses" @("id","name","is_married","sort_order") @((Col $row "MembershipMaritalStatus001"),(Col $row "MembershipMaritalStatus002"),(BoolFromBit (Col $row "MembershipMaritalStatus003")),(Col $row "MembershipMaritalStatus001"))
}

@(
  @(0,"會堂"),
  @(1,"牧區分類"),
  @(2,"牧區"),
  @(3,"大家"),
  @(4,"小家"),
  @(5,"實習小家"),
  @(99,"其他")
) | ForEach-Object {
  Add-Insert $lines "pastoral_group_types" @("id","name","sort_order") @($_[0],$_[1],$_[0])
}

foreach ($row in $tables["Groups"].Rows) {
  $id = [int](Col $row "Shepherd001")
  $level = Get-IntOrNull (Col $row "Shepherd002")
  $parentId = Get-IntOrNull (Col $row "Shepherd003")
  if ($parentId -eq 0 -and $level -eq 0) { $parentId = $null }
  $typeId = if ($level -ge 0 -and $level -le 5) { $level } else { 99 }
  Add-Insert $lines "pastoral_groups" @("id","church_id","parent_id","group_type_id","level_no","name","path","sort_order") @($id,(Get-ChurchIdForGroup $id),$parentId,$typeId,$level,(Col $row "Shepherd004"),(Get-GroupPath $id),$id)
}

foreach ($row in $tables["Members"].Rows) {
  $id = [int](Col $row "Newcomer001")
  $churchId = Get-IntOrNull (Col $row "Newcomer003")
  if ($null -eq $churchId) { $churchId = 0 }
  $maritalId = Get-IntOrNull (Col $row "Newcomer005")
  if ($null -eq $maritalId -or $maritalId -eq 0) { $maritalId = 1 }
  if ($maritalId -eq 1) { $maritalId = 6 } elseif ($maritalId -eq 2) { $maritalId = 2 }
  $memberName = [string](Col $row "Newcomer028")
  if ([string]::IsNullOrWhiteSpace($memberName)) { $memberName = "未填姓名#$id" }
  $memberCode = "TOP$($id.ToString('00000'))"
  Add-Insert $lines "pastoral_members" @("id","member_code","church_id","name","gender","birthday","membership_category_code","title_id","profession_id","profession_note","source_text","marital_status_id","marital_note","line_display_id","line_user_id","light_status","followup_staff_id","created_date","baptized_date","note") @(
    $id,$memberCode,$churchId,$memberName,(Get-IntOrNull (Col $row "Newcomer004")),(Col $row "Newcomer007"),(Col $row "Newcomer025"),(Get-IntOrNull (Col $row "Newcomer034")),(Get-IntOrNull (Col $row "Newcomer014")),(Col $row "Newcomer015"),(Col $row "Newcomer032"),$maritalId,(Col $row "Newcomer006"),(Col $row "Newcomer035"),(Col $row "Newcomer042"),(Get-IntOrNull (Col $row "Newcomer026")),(Get-IntOrNull (Col $row "Newcomer027")),(Col $row "Newcomer002"),(Col $row "Newcomer036"),(Col $row "Newcomer041")
  )
  Add-Insert $lines "pastoral_member_contacts" @("member_id","email","home_phone","office_phone","mobile_phone","preferred_contact_time","referrer_name","referrer_phone") @(
    $id,(Col $row "Newcomer008"),(Col $row "Newcomer009"),(Col $row "Newcomer010"),(Col $row "Newcomer011"),(Col $row "Newcomer012"),(Col $row "Newcomer016"),(Col $row "Newcomer017")
  )
  $address = [string](Col $row "Newcomer013")
  if (-not [string]::IsNullOrWhiteSpace($address)) {
    $countryId = 1
    $parsed = Get-RegionFromAddress $address
    Add-Insert $lines "pastoral_member_addresses" @("member_id","country_id","postal_code","city","district","address_line","is_primary") @(
      $id,$countryId,$(if ($parsed) { $parsed.PostalCode } else { $null }),$(if ($parsed) { $parsed.City } else { $null }),$(if ($parsed) { $parsed.District } else { $null }),$address,$true
    )
  }
  Add-Insert $lines "pastoral_member_faith" @("member_id","is_christian","previous_church_id","previous_church_text","willing_join_church","willing_contact","accepted_christ","willing_continue_group","willing_baptism","prayer_request","feedback") @(
    $id,(BoolFromBit (Col $row "Newcomer018")),$null,(Col $row "Newcomer019"),(BoolFromBit (Col $row "Newcomer020")),(BoolFromBit (Col $row "Newcomer021")),(BoolFromBit (Col $row "Newcomer022")),(BoolFromBit (Col $row "Newcomer030")),(BoolFromBit (Col $row "Newcomer031")),(Col $row "Newcomer023"),(Col $row "Newcomer024")
  )
  if (-not [string]::IsNullOrWhiteSpace([string](Col $row "Newcomer037")) -or -not [string]::IsNullOrWhiteSpace([string](Col $row "Newcomer038")) -or -not [string]::IsNullOrWhiteSpace([string](Col $row "Newcomer039")) -or -not [string]::IsNullOrWhiteSpace([string](Col $row "Newcomer040"))) {
    Add-Insert $lines "pastoral_member_family_notes" @("member_id","spouse_text","father_text","mother_text","children_text") @($id,(Col $row "Newcomer037"),(Col $row "Newcomer038"),(Col $row "Newcomer039"),(Col $row "Newcomer040"))
  }
  $groupId = Get-IntOrNull (Col $row "Newcomer033")
  if ((Col $row "Newcomer025") -eq "B" -and $null -ne $groupId -and $groupId -ne 0 -and $groupById.ContainsKey($groupId)) {
    Add-Insert $lines "pastoral_member_group_assignments" @("member_id","group_id","started_at","is_current") @($id,$groupId,(Col $row "Newcomer002"),$true)
  }
}

foreach ($row in $tables["Tracks"].Rows) {
  Add-Insert $lines "pastoral_care_records" @("id","member_id","staff_id","care_at","content") @((Col $row "NewcomerTrack001"),(Col $row "NewcomerTrack002"),(Col $row "NewcomerTrack003"),(Col $row "NewcomerTrack004"),(Col $row "NewcomerTrack005"))
}

foreach ($row in $tables["Leaders"].Rows) {
  $groupId = Get-IntOrNull (Col $row "ShepherdLeader002")
  $memberId = Get-IntOrNull (Col $row "ShepherdLeader003")
  if ($null -ne $groupId -and $null -ne $memberId -and $groupById.ContainsKey($groupId)) {
    Add-Insert $lines "pastoral_group_leaders" @("id","group_id","member_id","is_current") @((Col $row "ShepherdLeader001"),$groupId,$memberId,$true)
  }
}

@(
  @(1,"配偶","配偶"),
  @(2,"父親","子女"),
  @(3,"母親","子女"),
  @(4,"子女","父母"),
  @(5,"手足","手足"),
  @(6,"其他親屬","其他親屬")
) | ForEach-Object {
  Add-Insert $lines "relationship_types" @("id","name","reverse_name") @($_[0],$_[1],$_[2])
}

$lines.Add(@"
WITH RECURSIVE tree AS (
  SELECT id AS ancestor_id, id AS descendant_id, 0 AS depth
  FROM pastoral_groups
  UNION ALL
  SELECT tree.ancestor_id, child.id AS descendant_id, tree.depth + 1
  FROM tree
  JOIN pastoral_groups child ON child.parent_id = tree.descendant_id
)
INSERT INTO pastoral_group_closure (ancestor_id, descendant_id, depth)
SELECT ancestor_id, descendant_id, depth
FROM tree
ON CONFLICT (ancestor_id, descendant_id) DO NOTHING;
"@)
$lines.Add("COMMIT;")

[System.IO.File]::WriteAllLines($importPath, $lines, [System.Text.UTF8Encoding]::new($false))
Write-Host "已產生匯入 SQL：$importPath"
Write-Host ("來源筆數：會堂 {0}、分類 {1}、職業 {2}、職分 {3}、牧區 {4}、會友 {5}、關懷紀錄 {6}、牧區領袖 {7}" -f $tables["Churches"].Rows.Count, $tables["Categories"].Rows.Count, $tables["Professions"].Rows.Count, $tables["Titles"].Rows.Count, $tables["Groups"].Rows.Count, $tables["Members"].Rows.Count, $tables["Tracks"].Rows.Count, $tables["Leaders"].Rows.Count)

if ($GenerateOnly) {
  return
}

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$NasProjectPath/backups/project_management_before_pastoral_import_$stamp.sql"

Write-Host "備份 PostgreSQL：$backupFile"
ssh -i $SshKey "$NasUser@$NasHost" "cd $NasProjectPath && mkdir -p backups && sudo /usr/local/bin/docker exec -e PGPASSWORD='$PgPassword' $PgContainer pg_dump -U $PgUser -d $PgDatabase > $backupFile"

Write-Host "套用 pastoral_schema.sql"
Get-Content -Raw -Encoding UTF8 $schemaPath | ssh -i $SshKey "$NasUser@$NasHost" "sudo /usr/local/bin/docker exec -i -e PGPASSWORD='$PgPassword' $PgContainer psql -U $PgUser -d $PgDatabase -v ON_ERROR_STOP=1"

Write-Host "匯入牧養資料"
Get-Content -Raw -Encoding UTF8 $importPath | ssh -i $SshKey "$NasUser@$NasHost" "sudo /usr/local/bin/docker exec -i -e PGPASSWORD='$PgPassword' $PgContainer psql -U $PgUser -d $PgDatabase -v ON_ERROR_STOP=1 -q"

Write-Host "驗證匯入筆數"
@"
SELECT 'churches', count(*) FROM churches
UNION ALL SELECT 'pastoral_groups', count(*) FROM pastoral_groups
UNION ALL SELECT 'pastoral_members', count(*) FROM pastoral_members
UNION ALL SELECT 'pastoral_member_group_assignments', count(*) FROM pastoral_member_group_assignments
UNION ALL SELECT 'pastoral_care_records', count(*) FROM pastoral_care_records
ORDER BY 1;
"@ | ssh -i $SshKey "$NasUser@$NasHost" "sudo /usr/local/bin/docker exec -i -e PGPASSWORD='$PgPassword' $PgContainer psql -U $PgUser -d $PgDatabase -t -A -F ','"
