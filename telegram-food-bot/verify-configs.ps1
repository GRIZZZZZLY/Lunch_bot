# ========================================
# Verify Vite Configs Synchronization
# Проверка синхронизации конфигураций
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VITE CONFIGS VERIFICATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = Get-Location
$frontendDir = Join-Path $projectRoot "frontend"

# Check if we're in the right directory
if (-not (Test-Path $frontendDir)) {
    Write-Host "ERROR: frontend directory not found!" -ForegroundColor Red
    Write-Host "Please run this script from telegram-food-bot root directory" -ForegroundColor Yellow
    exit 1
}

Write-Host "Checking configurations..." -ForegroundColor Yellow
Write-Host ""

# Check main config
$mainConfig = Join-Path $frontendDir "vite.config.ts"
if (Test-Path $mainConfig) {
    Write-Host "✅ vite.config.ts found" -ForegroundColor Green
    $mainContent = Get-Content $mainConfig -Raw

    # Check critical settings
    $checks = @{
        "dedupe React" = $mainContent -match "dedupe:\s*\['react',\s*'react-dom'\]"
        "React vendor chunk" = $mainContent -match "if\s*\(\s*id\.includes\('react'\)\s*\)\s*\{?\s*return\s+'react-vendor'"
        "drop_console true" = $mainContent -match "drop_console:\s*true"
        "sourcemap false" = $mainContent -match "sourcemap:\s*false"
    }

    Write-Host "  Main config checks:" -ForegroundColor White
    foreach ($check in $checks.GetEnumerator()) {
        if ($check.Value) {
            Write-Host "    ✅ $($check.Key)" -ForegroundColor Green
        } else {
            Write-Host "    ❌ $($check.Key) - NOT FOUND!" -ForegroundColor Red
        }
    }
} else {
    Write-Host "❌ vite.config.ts NOT FOUND!" -ForegroundColor Red
}

Write-Host ""

# Check prod-dev config
$prodDevConfig = Join-Path $frontendDir "vite.config.prod-dev.ts"
if (Test-Path $prodDevConfig) {
    Write-Host "✅ vite.config.prod-dev.ts found" -ForegroundColor Green
    $prodDevContent = Get-Content $prodDevConfig -Raw

    # Check critical settings
    $checks = @{
        "dedupe React" = $prodDevContent -match "dedupe:\s*\['react',\s*'react-dom'\]"
        "React vendor chunk" = $prodDevContent -match "if\s*\(\s*id\.includes\('react'\)\s*\)\s*\{?\s*return\s+'react-vendor'"
        "drop_console false" = $prodDevContent -match "drop_console:\s*false"
        "sourcemap true" = $prodDevContent -match "sourcemap:\s*true"
        "external PWA" = $prodDevContent -match "external:\s*\['virtual:pwa-register'\]"
    }

    Write-Host "  PROD-DEV config checks:" -ForegroundColor White
    foreach ($check in $checks.GetEnumerator()) {
        if ($check.Value) {
            Write-Host "    ✅ $($check.Key)" -ForegroundColor Green
        } else {
            Write-Host "    ❌ $($check.Key) - NOT FOUND!" -ForegroundColor Red
        }
    }
} else {
    Write-Host "❌ vite.config.prod-dev.ts NOT FOUND!" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SYNCHRONIZATION CHECK" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if both have the same React chunking
if ($mainContent -match "if\s*\(\s*id\.includes\('react'\)\s*\)\s*\{?\s*return\s+'react-vendor'" -and
    $prodDevContent -match "if\s*\(\s*id\.includes\('react'\)\s*\)\s*\{?\s*return\s+'react-vendor'") {
    Write-Host "✅ Both configs have unified React chunking" -ForegroundColor Green
} else {
    Write-Host "❌ React chunking MISMATCH!" -ForegroundColor Red
    Write-Host "   This will cause 'Cannot set properties of undefined' error!" -ForegroundColor Yellow
}

# Check if both have dedupe
if ($mainContent -match "dedupe:\s*\['react',\s*'react-dom'\]" -and
    $prodDevContent -match "dedupe:\s*\['react',\s*'react-dom'\]") {
    Write-Host "✅ Both configs have React dedupe" -ForegroundColor Green
} else {
    Write-Host "❌ React dedupe MISMATCH!" -ForegroundColor Red
    Write-Host "   This will cause duplicate React instances!" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BUILD TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Testing PROD-DEV build..." -ForegroundColor Yellow
Set-Location $frontendDir

# Clean dist
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
    Write-Host "  Cleaned dist/" -ForegroundColor Gray
}

# Build with prod-dev config
Write-Host ""
Write-Host "Building with vite.config.prod-dev.ts..." -ForegroundColor Yellow
npm run build:prod-dev -- --mode production 2>&1 | Out-Null

Start-Sleep -Seconds 3

# Check if build succeeded
if (Test-Path "dist") {
    Write-Host "✅ PROD-DEV build succeeded" -ForegroundColor Green

    # Check generated files
    $indexHtml = Join-Path "dist" "index.html"
    if (Test-Path $indexHtml) {
        $htmlContent = Get-Content $indexHtml -Raw

        Write-Host ""
        Write-Host "Checking generated files..." -ForegroundColor Yellow

        # Extract script src
        if ($htmlContent -match 'src="/assets/js/(index-[^"]+\.js)"') {
            $indexFile = $matches[1]
            Write-Host "  ✅ Main bundle: $indexFile" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Main bundle not found in HTML!" -ForegroundColor Red
        }

        # Check for react-vendor
        if ($htmlContent -match 'href="/assets/js/(react-vendor-[^"]+\.js)"') {
            $reactFile = $matches[1]
            Write-Host "  ✅ React vendor: $reactFile" -ForegroundColor Green
            Write-Host "     (All React in ONE chunk - correct!)" -ForegroundColor Gray
        } else {
            Write-Host "  ❌ react-vendor chunk not found!" -ForegroundColor Red
            Write-Host "     This will cause React errors!" -ForegroundColor Yellow
        }

        # Check for OLD broken files (should NOT exist)
        if ($htmlContent -match "react-core-") {
            Write-Host "  ❌ WARNING: Old 'react-core' chunk detected!" -ForegroundColor Red
            Write-Host "     This is the OLD BROKEN config!" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "❌ PROD-DEV build FAILED!" -ForegroundColor Red
}

Set-Location $projectRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VERIFICATION COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Summary:" -ForegroundColor White
Write-Host ""
Write-Host "1. Both configs synchronized:" -ForegroundColor White
if ($mainContent -match "if\s*\(\s*id\.includes\('react'\)\s*\)\s*\{?\s*return\s+'react-vendor'" -and
    $prodDevContent -match "if\s*\(\s*id\.includes\('react'\)\s*\)\s*\{?\s*return\s+'react-vendor'" -and
    $mainContent -match "dedupe:\s*\['react',\s*'react-dom'\]" -and
    $prodDevContent -match "dedupe:\s*\['react',\s*'react-dom'\]") {
    Write-Host "   ✅ YES - Both have unified React chunking + dedupe" -ForegroundColor Green
} else {
    Write-Host "   ❌ NO - Configs are out of sync!" -ForegroundColor Red
}

Write-Host ""
Write-Host "2. PROD-DEV build works:" -ForegroundColor White
if (Test-Path "frontend/dist/index.html") {
    Write-Host "   ✅ YES - Build succeeded" -ForegroundColor Green
} else {
    Write-Host "   ❌ NO - Build failed" -ForegroundColor Red
}

Write-Host ""
Write-Host "3. React vendor chunk exists:" -ForegroundColor White
if (Test-Path "frontend/dist/index.html") {
    $htmlCheck = Get-Content "frontend/dist/index.html" -Raw
    if ($htmlCheck -match "react-vendor-") {
        Write-Host "   ✅ YES - React in single chunk" -ForegroundColor Green
    } else {
        Write-Host "   ❌ NO - React chunking incorrect!" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Run: .\start-prod-dev-NEW.ps1" -ForegroundColor White
Write-Host "  2. Open: http://localhost:3001" -ForegroundColor White
Write-Host "  3. Check DevTools console (should be no errors)" -ForegroundColor White
Write-Host "  4. Test Mini App in Telegram" -ForegroundColor White
Write-Host ""
