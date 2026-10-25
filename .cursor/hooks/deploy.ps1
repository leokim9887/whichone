# 에이전트 작업이 끝난 뒤 main의 변경만 Vercel로 올린다.
$ErrorActionPreference = "Continue"
try {
  $null = [Console]::In.ReadToEnd()
} catch {
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $root

$branch = (git rev-parse --abbrev-ref HEAD 2>$null).Trim()
if ($branch -ne "main") {
  exit 0
}

git add -A
$stagedNames = @(git diff --cached --name-only)
foreach ($path in $stagedNames) {
  $normalized = $path -replace "\\", "/"
  if ($normalized -match '(^|/)\.env($|\.)' -and $normalized -ne ".env.example") {
    git reset -q -- $path
  }
}

$staged = @(git diff --cached --name-only)
if ($staged.Count -eq 0) {
  exit 0
}

if (-not (git config user.name) -or -not (git config user.email)) {
  $env:GIT_AUTHOR_NAME = "leokim9887"
  $env:GIT_AUTHOR_EMAIL = "leokim9887@users.noreply.github.com"
  $env:GIT_COMMITTER_NAME = "leokim9887"
  $env:GIT_COMMITTER_EMAIL = "leokim9887@users.noreply.github.com"
}

$summary = ($staged | Select-Object -First 4) -join ", "
git commit -m "WhicHOne 변경 사항을 배포: $summary"
if ($LASTEXITCODE -ne 0) {
  exit 0
}

git push origin main
exit 0
