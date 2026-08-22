# ========================================
# Telegram Food Bot - Production Start
# Starts Backend + (Cloudflare tunnel | ngrok | external)
# ========================================
#
# Usage:
#   .\start-prod.ps1 -WebAppUrl https://lunch.example.com
#       => uses Cloudflare/external URL, no tunnel started
#   .\start-prod.ps1 -WebAppUrl https://lunch.example.com -Cloudflared
#       => starts cloudflared tunnel (must be configured)
#   .\start-prod.ps1
#       => fallback: starts ngrok with static domain (legacy)
#
# WEBAPP_URL is passed to backend as env var -- bot uses it for
# setChatMenuButton, deep links, and inline keyboards.

param(
    [string]$WebAppUrl = "https://rocketlunch.dpdns.org",
    [switch]$Cloudflared,
    [switch]$SkipChecks,
    [switch]$NoNgrok,
    [switch]$SkipBuild
)

# ========================================
# Tunnel selection
# ========================================
$NGROK_DOMAIN = "unprying-marita-nonvacantly.ngrok-free.dev"
$NGROK_URL    = "https://$NGROK_DOMAIN"

if ($WebAppUrl) {
    $PUBLIC_URL = $WebAppUrl.TrimEnd('/')
    $useNgrok = $false
} else {
    $PUBLIC_URL = $NGROK_URL
    $useNgrok = -not $NoNgrok
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Telegram Food Bot - Production Start" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Public URL (WEBAPP_URL): $PUBLIC_URL" -ForegroundColor Green
if ($useNgrok)        { Write-Host "Tunnel: ngrok (static domain)" -ForegroundColor Yellow }
elseif ($Cloudflared) { Write-Host "Tunnel: cloudflared (auto-start)" -ForegroundColor Yellow }
else                  { Write-Host "Tunnel: external (assume Cloudflare/other tunnel runs separately)" -ForegroundColor Yellow }
Write-Host ""

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js not installed!" -ForegroundColor Red
    exit 1
}

# Check tunnel binary (depending on chosen mode)
if ($useNgrok) {
    if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
        Write-Host "WARNING: ngrok not installed!" -ForegroundColor Yellow
        Write-Host "Install: winget install ngrok" -ForegroundColor Yellow
        Write-Host "Or pass -WebAppUrl <url> to use Cloudflare/other tunnel" -ForegroundColor Yellow
        exit 1
    }
}
if ($Cloudflared) {
    if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
        Write-Host "ERROR: cloudflared not installed!" -ForegroundColor Red
        Write-Host "Install: winget install --id Cloudflare.cloudflared" -ForegroundColor Yellow
        exit 1
    }
}

# Check project structure
foreach ($path in @("backend\package.json", "frontend-new\package.json")) {
    if (-not (Test-Path $path)) {
        Write-Host "ERROR: $path not found!" -ForegroundColor Red
        exit 1
    }
}

Write-Host "OK: All checks passed" -ForegroundColor Green
Write-Host ""

# Install dependencies if needed
if (-not $SkipChecks) {
    if (-not (Test-Path "backend\node_modules")) {
        Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
        Set-Location backend; npm install; Set-Location ..
    }
    if (-not (Test-Path "frontend-new\node_modules")) {
        Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
        Set-Location frontend-new; npm install; Set-Location ..
    }
}

# Build backend
if (-not $SkipBuild) {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "  Building Backend..." -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Set-Location backend
    npm run build
    $buildOk = $LASTEXITCODE
    Set-Location ..
    if ($buildOk -ne 0) { Write-Host "ERROR: Backend build failed!" -ForegroundColor Red; exit 1 }
    Write-Host "OK: Backend built" -ForegroundColor Green
    Write-Host ""
} else {
    if (-not (Test-Path "backend\dist\index.js")) {
        Write-Host "ERROR: No backend build found! Run without -SkipBuild first." -ForegroundColor Red; exit 1
    }
    Write-Host "Skipping backend build..." -ForegroundColor Yellow
}

# Build frontend
if (-not $SkipBuild) {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "  Building Frontend..." -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Set-Location frontend-new
    npm run build
    $buildOk = $LASTEXITCODE
    Set-Location ..
    if ($buildOk -ne 0) { Write-Host "ERROR: Frontend build failed!" -ForegroundColor Red; exit 1 }
    $distSize = [math]::Round((Get-ChildItem "frontend-new\dist" -Recurse | Measure-Object Length -Sum).Sum / 1MB, 2)
    Write-Host "OK: Frontend built ($distSize MB)" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "Skipping frontend build..." -ForegroundColor Yellow
}

$projectRoot = Get-Location

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Starting Services..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# 0. Copy .env.production -> .env so dotenv picks up prod settings
$prodEnv = Join-Path $projectRoot 'backend\.env.production'
$activeEnv = Join-Path $projectRoot 'backend\.env'
if (-not (Test-Path $prodEnv)) {
    Write-Host "ERROR: backend\.env.production not found" -ForegroundColor Red
    exit 1
}
Copy-Item -Path $prodEnv -Destination $activeEnv -Force
Write-Host "Copied .env.production -> backend\.env" -ForegroundColor DarkGray

# 0.5. Ensure PostgreSQL running (Windows often leaves a stale postmaster.pid
# after reboot when PG isn't installed as a service — backend then dies with
# ECONNREFUSED on Prisma boot).
function Ensure-Postgres {
    $port = 5432
    $listening = $false
    try {
        $tcp = Test-NetConnection -ComputerName localhost -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue
        $listening = [bool]$tcp
    } catch { $listening = $false }

    if ($listening) {
        Write-Host "OK: PostgreSQL already listening on :$port" -ForegroundColor DarkGray
        return $true
    }

    Write-Host "PostgreSQL not running on :$port — attempting start..." -ForegroundColor Yellow

    $pgCtl = (Get-Command pg_ctl -ErrorAction SilentlyContinue)
    if (-not $pgCtl) {
        Write-Host "WARNING: pg_ctl not in PATH. Start PostgreSQL manually then re-run." -ForegroundColor Yellow
        return $false
    }

    $pgData = $env:PGDATA
    if (-not $pgData -or -not (Test-Path $pgData)) {
        $pgData = "$env:USERPROFILE\scoop\apps\postgresql\current\data"
    }
    if (-not $pgData -or -not (Test-Path $pgData)) {
        Write-Host "WARNING: PGDATA not set or invalid (value: '$pgData'). Cannot start PG." -ForegroundColor Yellow
        return $false
    }

    # Stale postmaster.pid blocks startup if PG died ungracefully (reboot etc.).
    # Safe to remove ONLY because Test-NetConnection above confirmed nothing
    # listens on :5432 — no live process owns this pid.
    $pidFile = Join-Path $pgData "postmaster.pid"
    if (Test-Path $pidFile) {
        Write-Host "Removing stale postmaster.pid..." -ForegroundColor DarkGray
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }

    $logFile = Join-Path $pgData "server.log"
    & pg_ctl start -D "$pgData" -l "$logFile" -w -t 30 | Out-Host
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: pg_ctl start failed. See $logFile" -ForegroundColor Red
        return $false
    }

    Start-Sleep -Seconds 2
    Write-Host "OK: PostgreSQL started" -ForegroundColor Green
    return $true
}

if (-not (Ensure-Postgres)) {
    Write-Host "Backend will likely fail with ECONNREFUSED. Aborting." -ForegroundColor Red
    exit 1
}

# 1. Start Backend
Write-Host "[1/2] Starting Backend..." -ForegroundColor Yellow

$backendScript = @"
cd '$projectRoot\backend'
Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host '  BACKEND SERVER (port 3001)' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
Write-Host ''
`$env:NODE_ENV='production'
`$env:WEBAPP_URL='$PUBLIC_URL'
Write-Host 'WEBAPP_URL = $PUBLIC_URL' -ForegroundColor Cyan
node dist/index.js
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript
Start-Sleep -Seconds 3

# 2. Start tunnel (ngrok | cloudflared | external)
if ($useNgrok) {
    Write-Host "[2/2] Starting ngrok (static domain)..." -ForegroundColor Yellow

    $ngrokScript = @"
Write-Host ''
Write-Host '========================================' -ForegroundColor Magenta
Write-Host '  NGROK - STATIC DOMAIN' -ForegroundColor Magenta
Write-Host '========================================' -ForegroundColor Magenta
Write-Host ''
Write-Host 'Domain: https://$NGROK_DOMAIN' -ForegroundColor Green
Write-Host 'Target: http://localhost:3001' -ForegroundColor Cyan
Write-Host ''
ngrok http --domain=$NGROK_DOMAIN 3001
"@
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $ngrokScript
}
elseif ($Cloudflared) {
    Write-Host "[2/2] Starting cloudflared tunnel..." -ForegroundColor Yellow

    $cfScript = @"
Write-Host ''
Write-Host '========================================' -ForegroundColor Magenta
Write-Host '  CLOUDFLARE TUNNEL' -ForegroundColor Magenta
Write-Host '========================================' -ForegroundColor Magenta
Write-Host ''
Write-Host 'Public URL: $PUBLIC_URL' -ForegroundColor Green
Write-Host 'Target: http://localhost:3001' -ForegroundColor Cyan
Write-Host ''
cloudflared tunnel --url http://localhost:3001
"@
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $cfScript
}
else {
    Write-Host "[2/2] No tunnel started (assume Cloudflare/other tunnel runs separately)" -ForegroundColor Yellow
    Write-Host "      Make sure $PUBLIC_URL forwards to localhost:3001" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ALL SERVICES STARTED!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Public URL (passed to backend as WEBAPP_URL):" -ForegroundColor Yellow
Write-Host "  $PUBLIC_URL" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Open @rocket_lunch_bot in Telegram" -ForegroundColor White
Write-Host "  2. Press 'Menu' button - it should point to $PUBLIC_URL" -ForegroundColor White
Write-Host "  3. WebApp should open!" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to close this window..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
