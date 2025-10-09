# ========================================
# Diagnose Frontend Build
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Frontend Build Diagnostics" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check build structure
Write-Host "[1/4] Checking build structure..." -ForegroundColor Yellow
Write-Host ""

if (-not (Test-Path "frontend\dist")) {
    Write-Host "ERROR: frontend/dist not found!" -ForegroundColor Red
    exit 1
}

Write-Host "Files in dist:" -ForegroundColor Cyan
Get-ChildItem "frontend\dist" -Recurse -File | ForEach-Object {
    $size = ($_.Length / 1KB).ToString("0.00")
    Write-Host "  $($_.FullName.Replace((Get-Location).Path + '\frontend\dist\', '')) ($size KB)" -ForegroundColor White
}

Write-Host ""

# 2. Check index.html
Write-Host "[2/4] Checking index.html..." -ForegroundColor Yellow
Write-Host ""

$indexPath = "frontend\dist\index.html"
if (Test-Path $indexPath) {
    $indexContent = Get-Content $indexPath -Raw
    
    # Check for script tags
    $scriptMatches = [regex]::Matches($indexContent, '<script[^>]*src="([^"]+)"')
    Write-Host "Scripts found:" -ForegroundColor Cyan
    foreach ($match in $scriptMatches) {
        Write-Host "  $($match.Groups[1].Value)" -ForegroundColor White
    }
    
    Write-Host ""
    
    # Check if files exist
    foreach ($match in $scriptMatches) {
        $scriptPath = "frontend\dist\" + $match.Groups[1].Value.TrimStart('/')
        if (Test-Path $scriptPath) {
            Write-Host "  OK $($match.Groups[1].Value)" -ForegroundColor Green
        } else {
            Write-Host "  MISSING $($match.Groups[1].Value)" -ForegroundColor Red
        }
    }
} else {
    Write-Host "ERROR: index.html not found!" -ForegroundColor Red
}

Write-Host ""

# 3. Check for React in vendor bundle
Write-Host "[3/4] Checking for React in bundle..." -ForegroundColor Yellow
Write-Host ""

$vendorFiles = Get-ChildItem "frontend\dist\assets\vendor-*.js" -ErrorAction SilentlyContinue
if ($vendorFiles) {
    $vendorContent = Get-Content $vendorFiles[0].FullName -Raw -ErrorAction SilentlyContinue
    
    if ($vendorContent -match "react") {
        Write-Host "  React found in vendor bundle" -ForegroundColor Green
    } else {
        Write-Host "  React NOT found in vendor bundle!" -ForegroundColor Red
    }
    
    if ($vendorContent -match "useState") {
        Write-Host "  useState found in bundle" -ForegroundColor Green
    } else {
        Write-Host "  useState NOT found in bundle!" -ForegroundColor Red
    }
} else {
    Write-Host "  No vendor bundle found!" -ForegroundColor Red
}

Write-Host ""

# 4. Check .env files
Write-Host "[4/4] Checking environment..." -ForegroundColor Yellow
Write-Host ""

Write-Host "Frontend .env:" -ForegroundColor Cyan
if (Test-Path "frontend\.env") {
    Get-Content "frontend\.env" | Where-Object { $_ -match "^VITE_" } | ForEach-Object {
        Write-Host "  $_" -ForegroundColor White
    }
} else {
    Write-Host "  .env not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Recommendations" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Try these fixes:" -ForegroundColor Yellow
Write-Host "  1. Rebuild with clean install:" -ForegroundColor White
Write-Host "     cd frontend" -ForegroundColor Gray
Write-Host "     npm install" -ForegroundColor Gray
Write-Host "     npm run build" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Check browser console:" -ForegroundColor White
Write-Host "     F12 -> Console tab" -ForegroundColor Gray
Write-Host "     F12 -> Network tab (filter: JS)" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Try development mode:" -ForegroundColor White
Write-Host "     .\start-dev.ps1 -NoNgrok" -ForegroundColor Gray
Write-Host ""
