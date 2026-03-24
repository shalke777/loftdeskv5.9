# Session start — print operational context reminder
# Run via VS Code task "session-start" or manually before work.

$ErrorActionPreference = 'Continue'
$root = git rev-parse --show-toplevel 2>$null
if (-not $root) { $root = Get-Location }

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " LoftDesk Agent Session Start" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check operational docs exist
$opDir = Join-Path (Join-Path $root ".claude") "operational"
$requiredDocs = @(
    "task-classification.md",
    "routing-decision-tree.md",
    "quality-gates.md",
    "definition-of-done.md",
    "needs-human-decision.md",
    "report-template.md",
    "handoff-protocol.md"
)

$missing = @()
foreach ($doc in $requiredDocs) {
    $path = Join-Path $opDir $doc
    if (Test-Path $path) {
        Write-Host "  [OK] $doc" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $doc" -ForegroundColor Red
        $missing += $doc
    }
}

Write-Host ""

if ($missing.Count -gt 0) {
    Write-Host "WARNING: $($missing.Count) operational doc(s) missing!" -ForegroundColor Yellow
} else {
    Write-Host "All operational docs present." -ForegroundColor Green
}

# Git status
Write-Host ""
Write-Host "--- Git status ---" -ForegroundColor Gray
git status --short
$branch = git branch --show-current
Write-Host "Branch: $branch"
Write-Host ""

# Package scripts check
Write-Host "--- Available npm scripts ---" -ForegroundColor Gray
$pkgPath = Join-Path $root "package.json"
if (Test-Path $pkgPath) {
    $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
    if ($pkg.scripts) {
        $pkg.scripts.PSObject.Properties | ForEach-Object {
            Write-Host "  $($_.Name): $($_.Value)" -ForegroundColor Gray
        }
    }
}

Write-Host ""
Write-Host "Session ready. Follow operational docs for task workflow." -ForegroundColor Cyan
Write-Host ""
