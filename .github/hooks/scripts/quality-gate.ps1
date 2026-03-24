# Quality gate check — blocks completion if typecheck or build fail.
# Run via VS Code task "quality-gates" or manually before commit.
# Exit code 0 = all gates pass, 1 = blocked.

$ErrorActionPreference = 'Continue'

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " LoftDesk Quality Gates" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$failed = $false

# Gate 1: TypeScript
Write-Host "[1/3] TypeScript check..." -ForegroundColor Yellow
$tscOutput = npx tsc --noEmit 2>&1
$tscExit = $LASTEXITCODE
if ($tscExit -ne 0) {
    Write-Host "  FAIL: tsc --noEmit returned errors:" -ForegroundColor Red
    Write-Host $tscOutput
    $failed = $true
} else {
    Write-Host "  PASS: 0 errors" -ForegroundColor Green
}

Write-Host ""

# Gate 2: Build
Write-Host "[2/3] Production build..." -ForegroundColor Yellow
$buildOutput = npm run build 2>&1
$buildExit = $LASTEXITCODE
if ($buildExit -ne 0) {
    Write-Host "  FAIL: build returned errors:" -ForegroundColor Red
    Write-Host $buildOutput
    $failed = $true
} else {
    Write-Host "  PASS: build clean" -ForegroundColor Green
}

Write-Host ""

# Gate 3: Git status (informational, not blocking)
Write-Host "[3/3] Git status..." -ForegroundColor Yellow
$gitStatus = git status --short 2>&1
if ($gitStatus) {
    Write-Host "  INFO: uncommitted changes:" -ForegroundColor Yellow
    Write-Host $gitStatus
} else {
    Write-Host "  PASS: working tree clean" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

if ($failed) {
    Write-Host "BLOCKED: Quality gates failed. Fix errors above before completing task." -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Cyan
    exit 1
} else {
    Write-Host "ALL GATES PASSED. Task may proceed to completion." -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    exit 0
}
