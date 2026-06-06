param(
  [string]$SqlServer = "192.168.3.6",
  [string]$SqlDatabase = "TopChurch",
  [string]$SqlUser = "TopChurch",
  [string]$SqlPassword = "TopChurch",
  [string]$NasHost = "192.168.3.2",
  [string]$NasUser = "cetu",
  [string]$NasProjectPath = "/volume1/docker/project-api",
  [string]$NasSharePath = "\\192.168.3.2\docker\project-api",
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

$importDir = Join-Path $PSScriptRoot "qt_import"
$importPath = Join-Path $importDir "generated_qt_import.sql"
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
  if ($Value -is [byte] -or $Value -is [int] -or $Value -is [long] -or $Value -is [decimal] -or $Value -is [double] -or $Value -is [single]) {
    return ([string]$Value).Replace(",", ".")
  }
  if ($Value -is [datetime]) {
    return "'" + $Value.ToString("yyyy-MM-dd HH:mm:ss.fff") + "'"
  }
  $text = [string]$Value
  if ([string]::IsNullOrWhiteSpace($text)) { return "NULL" }
  return "'" + $text.Replace("'", "''") + "'"
}

function SqlIntValue($Value) {
  if ($null -eq $Value -or $Value -is [DBNull] -or [string]::IsNullOrWhiteSpace([string]$Value)) { return "NULL::integer" }
  return [string][int]$Value
}

function Add-Insert([System.Collections.Generic.List[string]]$Lines, [string]$Table, [string[]]$Columns, [object[]]$Values, [string[]]$ConflictColumns, [string[]]$UpdateColumns) {
  $escaped = $Values | ForEach-Object { SqlValue $_ }
  $sql = "INSERT INTO $Table (" + ($Columns -join ", ") + ") VALUES (" + ($escaped -join ", ") + ")"
  if ($ConflictColumns -and $ConflictColumns.Count -gt 0) {
    if ($UpdateColumns -and $UpdateColumns.Count -gt 0) {
      $updates = @($UpdateColumns | ForEach-Object { "$_ = EXCLUDED.$_" })
      $updates += "updated_at = now()"
      $sql += " ON CONFLICT (" + ($ConflictColumns -join ", ") + ") DO UPDATE SET " + ($updates -join ", ")
    } else {
      $sql += " ON CONFLICT (" + ($ConflictColumns -join ", ") + ") DO NOTHING"
    }
  }
  $Lines.Add($sql + ";")
}

function Add-RawStatement([System.Collections.Generic.List[string]]$Lines, [string]$Sql) {
  $Lines.Add($Sql.Trim() + ";")
}

function Get-DateOrNull($Value) {
  if ($null -eq $Value -or $Value -is [DBNull]) { return $null }
  return [datetime]$Value
}

function Get-MonthOrNull($Value) {
  $date = Get-DateOrNull $Value
  if ($null -eq $date) { return $null }
  return [datetime]::new($date.Year, $date.Month, 1)
}

function Map-OrderStatus($Value) {
  if ([int]$Value -eq -1) { return "cancelled" }
  if ([int]$Value -eq 0) { return "expired" }
  if ([int]$Value -eq 2) { return "active" }
  return "pending"
}

function Map-FinanceStatus($Value) {
  if ([int]$Value -eq 2) { return "posted" }
  if ([int]$Value -eq 1) { return "received" }
  return "unpaid"
}

function ProductTypeFromPlan($PlanId) {
  if (@(7, 8, 9) -contains [int]$PlanId) { return "eaglet" }
  return "adult_student"
}

function DurationFromPlanId([int]$PlanId) {
  if (@(3, 6, 9, 12) -contains $PlanId) { return 12 }
  if (@(2, 5, 8, 11) -contains $PlanId) { return 6 }
  return 1
}

Write-Host "Reading SQL Server QT data..."
$tables = @{
  PaymentTypes = Invoke-SourceQuery "SELECT QuietTimeOrderPaymentType001, QuietTimeOrderPaymentType002 FROM QuietTimeOrderPaymentType ORDER BY QuietTimeOrderPaymentType001"
  Prices = Invoke-SourceQuery "SELECT QuietTimePrice001, QuietTimePrice002, QuietTimePrice004, QuietTimePrice005 FROM QuietTimePrice ORDER BY QuietTimePrice001"
  Inventories = Invoke-SourceQuery "SELECT i.QuietTimeInventory001, i.QuietTimeInventory002, d.QuietTimeInventoryDetail001, d.QuietTimeInventoryDetail003, d.QuietTimeInventoryDetail004 FROM QuietTimeInventory i JOIN QuietTimeInventoryDetail d ON d.QuietTimeInventoryDetail002 = i.QuietTimeInventory001 ORDER BY d.QuietTimeInventoryDetail001"
  Orders = Invoke-SourceQuery "SELECT * FROM QuietTimeOrder ORDER BY QuietTimeOrder001"
  Items = Invoke-SourceQuery "SELECT * FROM QuietTimeOrderItem ORDER BY QuietTimeOrderItem001"
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("BEGIN;")
$lines.Add("TRUNCATE qt_order_items, qt_orders, qt_payment_types;")
$lines.Add("DELETE FROM qt_inventory_movements WHERE source_system = 'legacy_quiet_time' AND source_id LIKE 'QuietTimeInventoryDetail:%';")

foreach ($row in $tables["PaymentTypes"].Rows) {
  Add-Insert $lines "qt_payment_types" @("payment_type_id","payment_type_name") @($row["QuietTimeOrderPaymentType001"],$row["QuietTimeOrderPaymentType002"]) @("payment_type_id") @("payment_type_name")
}

foreach ($row in $tables["Prices"].Rows) {
  $planId = [int]$row["QuietTimePrice001"]
  $planName = [string]$row["QuietTimePrice002"]
  $legacyGroupCode = [int]$row["QuietTimePrice005"]
  Add-Insert $lines "qt_price_plans" @("plan_id","plan_name","product_type","duration_months","unit_price","legacy_group_code") @(
    $planId,
    $planName,
    (ProductTypeFromPlan $planId),
    (DurationFromPlanId $planId),
    $row["QuietTimePrice004"],
    $legacyGroupCode
  ) @("plan_id") @("plan_name","product_type","duration_months","unit_price","legacy_group_code")
}

foreach ($row in $tables["Inventories"].Rows) {
  $issueMonth = SqlValue (Get-MonthOrNull $row["QuietTimeInventory002"])
  $churchId = SqlIntValue $row["QuietTimeInventoryDetail003"]
  $quantity = SqlValue $row["QuietTimeInventoryDetail004"]
  $sourceId = SqlValue "QuietTimeInventoryDetail:$($row["QuietTimeInventoryDetail001"])"
  Add-RawStatement $lines @"
INSERT INTO qt_inventory_movements (issue_month, church_id, product_type, movement_type, quantity, source_system, source_id, note)
SELECT $issueMonth, $churchId, 'adult_student', 'initial_stock', $quantity, 'legacy_quiet_time', $sourceId, 'legacy_quiet_time_inventory_import'
WHERE EXISTS (SELECT 1 FROM churches WHERE id = $churchId)
"@
}

foreach ($row in $tables["Orders"].Rows) {
  $planId = if ($row["QuietTimeOrder009"] -is [DBNull]) { $null } else { [int]$row["QuietTimeOrder009"] }
  $orderId = SqlIntValue $row["QuietTimeOrder001"]
  $memberId = SqlIntValue $row["QuietTimeOrder002"]
  $payerMemberId = SqlIntValue $row["QuietTimeOrder014"]
  $churchId = SqlIntValue $row["QuietTimeOrder017"]
  $sqlPlanId = SqlIntValue $planId
  $paymentTypeId = SqlIntValue $row["QuietTimeOrder012"]
  Add-RawStatement $lines @"
INSERT INTO qt_orders (
  order_id, member_id, payer_member_id, church_id, plan_id, product_type,
  start_month, end_month, quantity, amount, order_status, finance_status,
  cashier_staff_id, payment_type_id, paper_receipt_no, payment_sequence_no,
  ordered_at, paid_at, cancelled_at, legacy_product_group
)
SELECT
  $orderId,
  CASE WHEN EXISTS (SELECT 1 FROM pastoral_members WHERE id = $memberId) THEN $memberId ELSE NULL END,
  CASE WHEN EXISTS (SELECT 1 FROM pastoral_members WHERE id = $payerMemberId) THEN $payerMemberId ELSE NULL END,
  CASE WHEN EXISTS (SELECT 1 FROM churches WHERE id = $churchId) THEN $churchId ELSE NULL END,
  CASE WHEN EXISTS (SELECT 1 FROM qt_price_plans WHERE plan_id = $sqlPlanId) THEN $sqlPlanId ELSE NULL END,
  $(SqlValue (ProductTypeFromPlan $planId)),
  $(SqlValue (Get-MonthOrNull $row["QuietTimeOrder003"])),
  $(SqlValue (Get-MonthOrNull $row["QuietTimeOrder004"])),
  $(SqlValue $(if ($row["QuietTimeOrder016"] -is [DBNull]) { 1 } else { $row["QuietTimeOrder016"] })),
  $(SqlValue $(if ($row["QuietTimeOrder005"] -is [DBNull]) { 0 } else { $row["QuietTimeOrder005"] })),
  $(SqlValue (Map-OrderStatus $row["QuietTimeOrder006"])),
  $(SqlValue (Map-FinanceStatus $row["QuietTimeOrder008"])),
  $(SqlValue $row["QuietTimeOrder007"]),
  CASE WHEN EXISTS (SELECT 1 FROM qt_payment_types WHERE payment_type_id = $paymentTypeId) THEN $paymentTypeId ELSE NULL END,
  $(SqlValue $row["QuietTimeOrder013"]),
  $(SqlValue $row["QuietTimeOrder015"]),
  $(SqlValue (Get-DateOrNull $row["QuietTimeOrder010"])),
  $(SqlValue (Get-DateOrNull $row["QuietTimeOrder011"])),
  $(SqlValue (Get-DateOrNull $row["QuietTimeOrder018"])),
  $(SqlValue $row["QuietTimeOrder019"])
ON CONFLICT (order_id) DO UPDATE SET
  member_id = EXCLUDED.member_id,
  payer_member_id = EXCLUDED.payer_member_id,
  church_id = EXCLUDED.church_id,
  plan_id = EXCLUDED.plan_id,
  product_type = EXCLUDED.product_type,
  start_month = EXCLUDED.start_month,
  end_month = EXCLUDED.end_month,
  quantity = EXCLUDED.quantity,
  amount = EXCLUDED.amount,
  order_status = EXCLUDED.order_status,
  finance_status = EXCLUDED.finance_status,
  cashier_staff_id = EXCLUDED.cashier_staff_id,
  payment_type_id = EXCLUDED.payment_type_id,
  paper_receipt_no = EXCLUDED.paper_receipt_no,
  payment_sequence_no = EXCLUDED.payment_sequence_no,
  ordered_at = EXCLUDED.ordered_at,
  paid_at = EXCLUDED.paid_at,
  cancelled_at = EXCLUDED.cancelled_at,
  legacy_product_group = EXCLUDED.legacy_product_group,
  updated_at = now()
"@
}

foreach ($row in $tables["Items"].Rows) {
  $itemId = SqlIntValue $row["QuietTimeOrderItem001"]
  $orderId = SqlIntValue $row["QuietTimeOrderItem002"]
  $receiverMemberId = SqlIntValue $row["QuietTimeOrderItem005"]
  Add-RawStatement $lines @"
INSERT INTO qt_order_items (order_item_id, order_id, issue_month, is_received, receiver_member_id, received_at)
SELECT
  $itemId,
  $orderId,
  $(SqlValue (Get-MonthOrNull $row["QuietTimeOrderItem003"])),
  $(SqlValue $(if ($row["QuietTimeOrderItem004"] -is [DBNull]) { $false } else { [bool]$row["QuietTimeOrderItem004"] })),
  CASE WHEN EXISTS (SELECT 1 FROM pastoral_members WHERE id = $receiverMemberId) THEN $receiverMemberId ELSE NULL END,
  $(SqlValue (Get-DateOrNull $row["QuietTimeOrderItem006"]))
WHERE EXISTS (SELECT 1 FROM qt_orders WHERE order_id = $orderId)
ON CONFLICT (order_item_id) DO UPDATE SET
  order_id = EXCLUDED.order_id,
  issue_month = EXCLUDED.issue_month,
  is_received = EXCLUDED.is_received,
  receiver_member_id = EXCLUDED.receiver_member_id,
  received_at = EXCLUDED.received_at,
  updated_at = now()
"@
}

$lines.Add(@"
UPDATE qt_orders o
SET member_id = NULL
WHERE member_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM pastoral_members pm WHERE pm.id = o.member_id);
UPDATE qt_orders o
SET payer_member_id = NULL
WHERE payer_member_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM pastoral_members pm WHERE pm.id = o.payer_member_id);
UPDATE qt_orders o
SET church_id = NULL
WHERE church_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM churches c WHERE c.id = o.church_id);
UPDATE qt_orders o
SET plan_id = NULL
WHERE plan_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM qt_price_plans p WHERE p.plan_id = o.plan_id);
UPDATE qt_order_items i
SET receiver_member_id = NULL
WHERE receiver_member_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM pastoral_members pm WHERE pm.id = i.receiver_member_id);
"@)
$lines.Add("COMMIT;")

[System.IO.File]::WriteAllLines($importPath, $lines, [System.Text.UTF8Encoding]::new($false))
Write-Host "Generated import SQL: $importPath"
Write-Host ("Source counts: prices {0}, payment types {1}, inventory details {2}, orders {3}, order items {4}" -f $tables["Prices"].Rows.Count, $tables["PaymentTypes"].Rows.Count, $tables["Inventories"].Rows.Count, $tables["Orders"].Rows.Count, $tables["Items"].Rows.Count)

if ($GenerateOnly) {
  return
}

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$NasProjectPath/backups/topchurchplus_before_qt_reimport_$stamp.sql"

Write-Host "Backing up PostgreSQL: $backupFile"
ssh -i $SshKey "$NasUser@$NasHost" "cd $NasProjectPath && mkdir -p backups tmp_import && sudo /usr/local/bin/docker exec -e PGPASSWORD='$PgPassword' $PgContainer pg_dump -U $PgUser -d $PgDatabase > $backupFile"

$tmpDir = Join-Path $NasSharePath "tmp_import"
if (-not (Test-Path -LiteralPath $tmpDir)) {
  New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
}
Copy-Item -LiteralPath $importPath -Destination (Join-Path $tmpDir "qt_import.sql") -Force

Write-Host "Importing QT data"
ssh -i $SshKey "$NasUser@$NasHost" "cd $NasProjectPath && sudo /usr/local/bin/docker cp tmp_import/qt_import.sql ${PgContainer}:/tmp/qt_import.sql && sudo /usr/local/bin/docker exec -e PGPASSWORD='$PgPassword' $PgContainer psql -U $PgUser -d $PgDatabase -v ON_ERROR_STOP=1 -q -f /tmp/qt_import.sql"

Write-Host "QT import completed"
