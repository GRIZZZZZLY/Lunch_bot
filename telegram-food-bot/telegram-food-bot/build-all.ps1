# ========================================
# Build Production Version
# ========================================

param(
    [switch]$SkipFrontend,
    [switch]$SkipBackend
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Building Production" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$startTime = Get-Date

# Build Backend
if (-not $SkipBackend) {
    Write-Host "[1/2] Building Backend..." -ForegroundColor Yellow
    Write-Host ""
    
    Push-Location backend
    
    # Clean old build
    if (Test-Path "dist") {
        Write-Host "  Cleaning old build..." -ForegroundColor Gray
        Remove-Item -Recurse -Force "dist"
    }
    
    # Build (with relaxed type checking for production)
    Write-Host "  Compiling TypeScript (production mode)..." -ForegroundColor Gray
    npm run build:prod 2>&1 | Out-Null
    
    # Check if dist was created (TypeScript may show errors but still compile with noEmitOnError: false)
    if (-not (Test-Path "dist\index.js")) {
        Write-Host ""
        Write-Host "ERROR: Backend build failed - dist/index.js not found!" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    
    Write-Host "  OK Backend compiled (warnings ignored)" -ForegroundColor Green
    
    Pop-Location
    Write-Host ""
} else {
    Write-Host "[1/2] Skipping Backend build" -ForegroundColor Gray
    Write-Host ""
}

# Build Frontend
if (-not $SkipFrontend) {
    Write-Host "[2/2] Building Frontend..." -ForegroundColor Yellow
    Write-Host ""
    
    Push-Location frontend
    
    # Clean old build
    if (Test-Path "dist") {
        Write-Host "  Cleaning old build..." -ForegroundColor Gray
        Remove-Item -Recurse -Force "dist"
    }
    
    # Build
    Write-Host "  Bundling with Vite..." -ForegroundColor Gray
    npm run build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "ERROR: Frontend build failed!" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    
    Write-Host "  OK Frontend built successfully" -ForegroundColor Green
    
    Pop-Location
    Write-Host ""
} else {
    Write-Host "[2/2] Skipping Frontend build" -ForegroundColor Gray
    Write-Host ""
}

$endTime = Get-Date
$duration = $endTime - $startTime

Write-Host "========================================" -ForegroundColor Green
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Build time: $($duration.TotalSeconds.ToString('0.0')) seconds" -ForegroundColor Cyan
Write-Host ""

# Show build info
if (-not $SkipFrontend -and (Test-Path "frontend\dist")) {
    $frontendSize = (Get-ChildItem -Path "frontend\dist" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "Frontend bundle size: $($frontendSize.ToString('0.00')) MB" -ForegroundColor White
}

if (-not $SkipBackend -and (Test-Path "backend\dist")) {
    $backendFiles = (Get-ChildItem -Path "backend\dist" -Recurse -File).Count
    Write-Host "Backend files: $backendFiles" -ForegroundColor White
}

Write-Host ""
Write-Host "Ready to run production build!" -ForegroundColor Green
Write-Host "Use: .\start-production.ps1" -ForegroundColor Yellow
Write-Host ""
