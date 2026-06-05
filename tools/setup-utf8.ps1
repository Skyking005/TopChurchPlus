$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)

chcp 65001 > $null
[Console]::OutputEncoding = $Utf8NoBom
[Console]::InputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom

Write-Host 'PowerShell UTF-8 mode enabled.'
