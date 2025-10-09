# ========================================
# Setup ngrok in PATH
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup ngrok in PATH" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Common ngrok locations
$commonPaths = @(
    "$env:USERPROFILE\Downloads",
    "$env:USERPROFILE\Desktop",
    "$env:LOCALAPPDATA\Programs\ngrok",
    "$env:ProgramFiles\ngrok",
    "$env:ProgramFiles(x86)\ngrok",
    "C:\ngrok",
    "C:\Tools\ngrok"
)

Write-Host "Searching for ngrok.exe..." -ForegroundColor Yellow

$ngrokPath = $null

# Search in common locations
foreach ($path in $commonPaths) {
    if (Test-Path "$path\ngrok.exe") {
        $ngrokPath = $path
        Write-Host "  Found: $path\ngrok.exe" -ForegroundColor Green
        break
    }
}

# If not found, search in entire user profile (slower)
if (-not $ngrokPath) {
    Write-Host "  Not found in common locations, searching entire user profile..." -ForegroundColor Yellow
    $found = Get-ChildItem -Path $env:USERPROFILE -Recurse -Filter "ngrok.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
        $ngrokPath = $found.DirectoryName
        Write-Host "  Found: $($found.FullName)" -ForegroundColor Green
    }
}

if (-not $ngrokPath) {
    Write-Host ""
    Write-Host "ERROR: ngrok.exe not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install ngrok:" -ForegroundColor Yellow
    Write-Host "  1. Download from: https://ngrok.com/download" -ForegroundColor White
    Write-Host "  2. Extract ngrok.exe to C:\Tools\ngrok\" -ForegroundColor White
    Write-Host "  3. Run this script again" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "ngrok location: $ngrokPath" -ForegroundColor Cyan
Write-Host ""

# Check if already in PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -like "*$ngrokPath*") {
    Write-Host "ngrok is already in PATH!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Testing..." -ForegroundColor Yellow
    
    # Refresh PATH in current session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    
    ngrok version
    
    Write-Host ""
    Write-Host "All good!" -ForegroundColor Green
    exit 0
}

Write-Host "Adding ngrok to PATH..." -ForegroundColor Yellow

# Add to User PATH (persistent)
$newPath = $currentPath + ";" + $ngrokPath
[Environment]::SetEnvironmentVariable("Path", $newPath, "User")

# Also add to current session PATH
$env:Path += ";$ngrokPath"

Write-Host "  OK Added to PATH" -ForegroundColor Green
Write-Host ""

# Test
Write-Host "Testing ngrok..." -ForegroundColor Yellow
try {
    ngrok version
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  SUCCESS!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "ngrok is now available in PATH" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "IMPORTANT:" -ForegroundColor Yellow
    Write-Host "  1. Close this PowerShell window" -ForegroundColor White
    Write-Host "  2. Open a NEW PowerShell window" -ForegroundColor White
    Write-Host "  3. Run: .\start-production.ps1" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "WARNING: ngrok added to PATH but test failed" -ForegroundColor Yellow
    Write-Host "Please restart PowerShell and try again" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "PATH updated successfully!" -ForegroundColor Green
Write-Host "Restart PowerShell for changes to take effect" -ForegroundColor Yellow
Write-Host ""
