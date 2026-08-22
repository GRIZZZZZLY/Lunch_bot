# ========================================
# Update ngrok URL in .env files
# ========================================

param(
    [Parameter(Mandatory=$true)]
    [string]$NgrokUrl
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Update ngrok URL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Remove trailing slash if exists
$NgrokUrl = $NgrokUrl.TrimEnd('/')

# Validate URL format
if ($NgrokUrl -notmatch '^https?://') {
    Write-Host "ERROR: URL must start with http:// or https://" -ForegroundColor Red
    Write-Host "Example: https://abc123.ngrok-free.app" -ForegroundColor Yellow
    exit 1
}

Write-Host "New URL: $NgrokUrl" -ForegroundColor Green
Write-Host ""

# 1. Backend .env
Write-Host "[1/2] Updating backend/.env..." -ForegroundColor Yellow
$backendEnv = Get-Content "backend\.env" -Raw

# Update WEBAPP_URL
$backendEnv = $backendEnv -replace 'WEBAPP_URL=https?://[^\s]+', "WEBAPP_URL=$NgrokUrl"

# Update CORS_ORIGIN
$corsOrigins = "http://localhost:5173,http://127.0.0.1:5173,$NgrokUrl"
$backendEnv = $backendEnv -replace 'CORS_ORIGIN=[^\r\n]+', "CORS_ORIGIN=$corsOrigins"

Set-Content "backend\.env" -Value $backendEnv -NoNewline
Write-Host "  OK backend/.env updated" -ForegroundColor Green

# 2. Frontend .env
Write-Host "[2/2] Updating frontend-new/.env..." -ForegroundColor Yellow
$frontendEnv = Get-Content "frontend-new\.env" -Raw

# Update VITE_API_URL
$apiUrl = "$NgrokUrl/api"
$frontendEnv = $frontendEnv -replace 'VITE_API_URL=https?://[^\s]+', "VITE_API_URL=$apiUrl"

Set-Content "frontend-new\.env" -Value $frontendEnv -NoNewline
Write-Host "  OK frontend-new/.env updated" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  DONE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Settings updated:" -ForegroundColor Cyan
Write-Host "  Backend WEBAPP_URL: $NgrokUrl" -ForegroundColor White
Write-Host "  Frontend API URL:   $apiUrl" -ForegroundColor White
Write-Host "  CORS Origin:        $corsOrigins" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANT: Restart services!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Commands:" -ForegroundColor Cyan
Write-Host "  cd backend && npm run dev" -ForegroundColor Gray
Write-Host "  cd frontend-new && npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "Or use:" -ForegroundColor Cyan
Write-Host '  .\start-dev.ps1 -NoNgrok' -ForegroundColor Gray
Write-Host ""
