param(
  [string]$ProjectRoot = '',
  [string]$Destination = '',
  [switch]$NoReadOnly
)

$ErrorActionPreference = 'Stop'

function Resolve-DefaultProjectRoot {
  $current = $PSScriptRoot
  while ($current) {
    if ((Test-Path -LiteralPath (Join-Path $current 'AGENTS.md')) -and
        (Test-Path -LiteralPath (Join-Path $current 'api\src'))) {
      return (Resolve-Path $current).Path
    }
    $parent = Split-Path $current -Parent
    if ($parent -eq $current) {
      break
    }
    $current = $parent
  }
  throw 'Unable to locate project root. Pass -ProjectRoot explicitly.'
}

if (-not $ProjectRoot) {
  $ProjectRoot = Resolve-DefaultProjectRoot
} else {
  $ProjectRoot = (Resolve-Path $ProjectRoot).Path
}

if (-not $Destination) {
  $Destination = Join-Path (Split-Path $ProjectRoot -Parent) 'topchurchplus-ai-context'
}

$destinationParent = Split-Path $Destination -Parent
if (-not (Test-Path -LiteralPath $destinationParent)) {
  New-Item -ItemType Directory -Path $destinationParent | Out-Null
}

$Destination = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Destination)

if ($Destination -eq $ProjectRoot -or $Destination.StartsWith("$ProjectRoot\", [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'Destination must not be inside the live project repo.'
}
if ((Split-Path $Destination -Leaf) -notmatch 'ai-context$') {
  throw 'Destination folder name must end with ai-context for safety.'
}

$allowedExtensions = @(
  '.cmd',
  '.gs',
  '.html',
  '.js',
  '.json',
  '.md',
  '.ps1',
  '.sql'
)

$allowedRootFiles = @(
  'AGENTS.md',
  'appsscript.json',
  'package.json',
  'package-lock.json'
)

$allowedRootPatterns = @(
  '*.gs',
  '*.html'
)

$allowedDirectories = @(
  'api\public',
  'api\src',
  'database',
  'docs',
  'tests\api',
  'tools'
)

$blockedDirectoryNames = @(
  '.git',
  '.venv-tools',
  'backups',
  'dist',
  'node_modules',
  'logs',
  'tmp',
  '固定資產原始資料',
  '文書範本',
  '測試資料'
)

$blockedFileNames = @(
  '.clasp.json',
  '.env',
  'project-management-export.json'
)

$blockedFileNamePatterns = @(
  '.env.*',
  '*.bak',
  '*.backup',
  '*.dump',
  '*.gz',
  '*.key',
  '*.log',
  '*.p12',
  '*.pem',
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.pdf',
  '*.sql.gz',
  '*.zip'
)

function Get-ProjectRelativePath {
  param([Parameter(Mandatory = $true)][string]$Path)

  $root = $ProjectRoot
  if (-not $root.EndsWith('\')) {
    $root = "$root\"
  }
  $rootUri = New-Object System.Uri($root)
  $pathUri = New-Object System.Uri($Path)
  $relativeUri = $rootUri.MakeRelativeUri($pathUri)
  return [System.Uri]::UnescapeDataString($relativeUri.ToString()).Replace('/', '\')
}

function Test-BlockedPath {
  param([Parameter(Mandatory = $true)][string]$Path)

  $relative = Get-ProjectRelativePath $Path
  $parts = $relative -split '[\\/]'
  foreach ($part in $parts) {
    if ($blockedDirectoryNames -contains $part) {
      return $true
    }
  }

  $leaf = Split-Path $Path -Leaf
  if ($blockedFileNames -contains $leaf) {
    return $true
  }
  foreach ($pattern in $blockedFileNamePatterns) {
    if ($leaf -like $pattern) {
      return $true
    }
  }

  return $false
}

function Test-InAllowedDirectory {
  param([Parameter(Mandatory = $true)][string]$Path)

  $relative = Get-ProjectRelativePath $Path
  foreach ($dir in $allowedDirectories) {
    if ($relative.Equals($dir, [System.StringComparison]::OrdinalIgnoreCase) -or
        $relative.StartsWith("$dir\", [System.StringComparison]::OrdinalIgnoreCase)) {
      return $true
    }
  }
  return $false
}

function Test-AllowedRootFile {
  param([Parameter(Mandatory = $true)][string]$Path)

  $relative = Get-ProjectRelativePath $Path
  if ($relative -match '[\\/]') {
    return $false
  }

  $leaf = Split-Path $Path -Leaf
  if ($allowedRootFiles -contains $leaf) {
    return $true
  }
  foreach ($pattern in $allowedRootPatterns) {
    if ($leaf -like $pattern) {
      return $true
    }
  }
  return $false
}

if (Test-Path -LiteralPath $Destination) {
  Get-ChildItem -LiteralPath $Destination -Recurse -Force | ForEach-Object {
    if ($_.Attributes -band [System.IO.FileAttributes]::ReadOnly) {
      $_.Attributes = $_.Attributes -band (-bnot [System.IO.FileAttributes]::ReadOnly)
    }
  }
  Get-ChildItem -LiteralPath $Destination -Force | Remove-Item -Recurse -Force
} else {
  New-Item -ItemType Directory -Path $Destination | Out-Null
}

$copied = New-Object System.Collections.Generic.List[string]
$skipped = New-Object System.Collections.Generic.List[string]

$sourceFiles = Get-ChildItem -LiteralPath $ProjectRoot -Recurse -File -Force | Where-Object {
  -not (Test-BlockedPath $_.FullName)
}

foreach ($file in $sourceFiles) {
  $extension = [System.IO.Path]::GetExtension($file.Name).ToLowerInvariant()
  $isAllowed = $allowedExtensions -contains $extension
  $isRootFile = Test-AllowedRootFile $file.FullName
  $isAllowedDirectory = Test-InAllowedDirectory $file.FullName

  if (-not (($isRootFile -or $isAllowedDirectory) -and $isAllowed)) {
    $skipped.Add((Get-ProjectRelativePath $file.FullName))
    continue
  }

  $relative = Get-ProjectRelativePath $file.FullName
  $target = Join-Path $Destination $relative
  $targetDir = Split-Path $target -Parent
  if (-not (Test-Path -LiteralPath $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir | Out-Null
  }
  Copy-Item -LiteralPath $file.FullName -Destination $target -Force
  $copied.Add($relative)
}

$manifestPath = Join-Path $Destination 'AI_CONTEXT_MANIFEST.md'
$manifest = @(
  '# TopChurchPlus AI Context Snapshot',
  '',
  "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')",
  "Source: $ProjectRoot",
  "Files copied: $($copied.Count)",
  '',
  '## Safety Rules',
  '',
  '- This folder is generated for AI read-only analysis.',
  '- Do not place `.env`, tokens, passwords, private keys, database dumps, or raw test assets here.',
  '- Rebuild this folder with `tools\build-ai-context.cmd` instead of editing it manually.',
  '',
  '## Included File List',
  ''
)
$manifest += ($copied | Sort-Object | ForEach-Object { '- `{0}`' -f $_ })
[System.IO.File]::WriteAllLines($manifestPath, $manifest, [System.Text.UTF8Encoding]::new($false))

if (-not $NoReadOnly) {
  Get-ChildItem -LiteralPath $Destination -Recurse -File -Force | ForEach-Object {
    $_.Attributes = $_.Attributes -bor [System.IO.FileAttributes]::ReadOnly
  }
}

Write-Host "AI context generated: $Destination"
Write-Host "Files copied: $($copied.Count)"
Write-Host "Files skipped by extension/scope: $($skipped.Count)"
