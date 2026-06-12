$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')
Push-Location -LiteralPath $repoRoot

try {
    $contextDir = $env:TOPCHURCHPLUS_AI_CONTEXT_DIR
    if ([string]::IsNullOrWhiteSpace($contextDir)) {
        $contextDir = Join-Path (Split-Path -Parent $repoRoot) 'topchurchplus-ai-context'
    }

    $manifestPath = Join-Path $contextDir 'AI_CONTEXT_MANIFEST.md'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        Write-Output "[FAIL] AI context manifest not found: `"$manifestPath`""
        exit 1
    }

    $gitHeadText = (& git log -1 --format=%at 2>$null)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($gitHeadText)) {
        Write-Output '[FAIL] Cannot read Git HEAD timestamp.'
        exit 1
    }

    [int64]$gitHeadTs = $gitHeadText.Trim()
    $manifestInfo = Get-Item -LiteralPath $manifestPath
    $epoch = [DateTime]'1970-01-01T00:00:00Z'
    [int64]$manifestTs = ($manifestInfo.LastWriteTimeUtc - $epoch).TotalSeconds

    if ($manifestTs -lt $gitHeadTs) {
        Write-Output "[WARN] AI context is older than Git HEAD: `"$manifestPath`""
        Write-Output "       manifest=$manifestTs git_head=$gitHeadTs"
        exit 2
    }

    Write-Output "[PASS] AI context is fresh: `"$manifestPath`""
    Write-Output "       manifest=$manifestTs git_head=$gitHeadTs"
    exit 0
}
finally {
    Pop-Location
}
