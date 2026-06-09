param(
  [switch]$WriteDemo
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\lib\topchurchplus-test.ps1"

$currentUser = New-DemoCurrentUser

$documents = (Invoke-TopChurchPlusApi -Method GET -Path '/dev-management/documents' -CurrentUser $currentUser).Json
Assert-True (($documents.rows | Measure-Object).Count -gt 0) 'Dev management documents should be listed.'
Assert-True ((($documents.rows | Where-Object { $_.key -eq 'HANDOFF' }) | Measure-Object).Count -eq 1) 'HANDOFF document should be listed.'
Write-Host 'PASS dev-management documents'

$handoff = (Invoke-TopChurchPlusApi -Method GET -Path '/dev-management/documents/HANDOFF' -CurrentUser $currentUser).Json
Assert-True ($handoff.content.Length -gt 0) 'HANDOFF content should not be empty.'
Write-Host 'PASS dev-management document detail'

$issues = (Invoke-TopChurchPlusApi -Method GET -Path '/dev-management/issues?page=1&pageSize=20' -CurrentUser $currentUser).Json
Assert-True ($issues.pageSize -eq 20) 'Dev management issues should use pageSize 20.'
Write-Host 'PASS dev-management issues list'

$releases = (Invoke-TopChurchPlusApi -Method GET -Path '/dev-management/releases?limit=10' -CurrentUser $currentUser).Json
Assert-True ($null -ne $releases.rows) 'Dev management releases should return rows.'
Write-Host 'PASS dev-management releases list'

if (-not $WriteDemo) {
  Write-Host 'SKIP dev-management write demo. Pass -WriteDemo to create retained demo data.'
  exit 0
}

$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$issueDescription = "$(Decode-Utf8 'Q29kZXgg57O757Wx6ZaL55m8566h55CGIERlbW8gSXNzdWUg')$stamp$(Decode-Utf8 '77ya56K66KqNIElzc3VlIOaPkOahiOOAgeaWh+S7tiBSZXZpZXcg6IiH54mI5pys5q2356iL5Y+v5Lul5q2j5bi45L2/55So44CC')"
$created = (Invoke-TopChurchPlusApi -Method POST -Path '/dev-management/issues' -CurrentUser $currentUser -Body @{
  currentUser = $currentUser
  issue = @{
    issueType = 'maintain'
    status = (Decode-Utf8 '5o+Q5qGI')
    priority = (Decode-Utf8 '5L2O')
    description = $issueDescription
  }
}).Json
Assert-True ($created.issue.issueId -ne $null -and $created.issue.issueId -ne '') 'Dev management issue create should return issueId.'
Assert-ReadableChinese $created.issue.description 'development_issues.description'

$releaseSummary = "$(Decode-Utf8 'Q29kZXgg57O757Wx6ZaL55m8566h55CGIERlbW8g54mI5pysIA==')$stamp"
$release = (Invoke-TopChurchPlusApi -Method POST -Path '/dev-management/releases' -CurrentUser $currentUser -Body @{
  currentUser = $currentUser
  release = @{
    commitHash = 'DEMO'
    commitMessage = 'Smoke test demo release'
    appsScriptVersion = '@DEMO'
    apiDeployed = $true
    appsScriptDeployed = $false
    summary = $releaseSummary
    verificationResult = 'API smoke test retained demo data.'
  }
}).Json
Assert-True ($release.release.releaseId -ne $null -and $release.release.releaseId -ne '') 'Dev management release create should return releaseId.'
Assert-ReadableChinese $release.release.summary 'development_releases.summary'

Write-Host "PASS dev-management write demo issueId=$($created.issue.issueId) releaseId=$($release.release.releaseId)"
