# ============================================================
# Smart Lab System — Local Development Launcher
# Run this script from the smart-lab-system root directory
# Usage: .\start-local.ps1
# ============================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Smart Lab System — Local Dev Launcher " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$backendDir = Join-Path $rootDir "backend"
$webDir = Join-Path $rootDir "web"

# ── Verify .env exists ───────────────────────────────────────
$envFile = Join-Path $backendDir ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "[ERROR] backend/.env not found!" -ForegroundColor Red
    Write-Host "  Copy backend/.env.example to backend/.env and fill in your AWS credentials." -ForegroundColor Yellow
    exit 1
}

Write-Host "[1/2] Starting Backend API server on http://localhost:3001 ..." -ForegroundColor Green
$backendProc = Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "Set-Location '$backendDir'; Write-Host 'BACKEND starting...' -ForegroundColor Cyan; npm run dev" `
    -PassThru

Write-Host "      Waiting for backend to compile (ts-node ~15s)..." -ForegroundColor DarkGray
Start-Sleep -Seconds 15

# Health check
$healthy = $false
for ($i = 0; $i -lt 10; $i++) {
    try {
        $r = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method GET -ErrorAction Stop
        if ($r.status -eq "healthy") {
            Write-Host "      [OK] Backend is healthy!" -ForegroundColor Green
            $healthy = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 3
    }
}

if (-not $healthy) {
    Write-Host "[WARN] Backend health check timed out. It may still be starting." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[2/2] Starting Web Frontend on http://localhost:5173 ..." -ForegroundColor Magenta
$webProc = Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "Set-Location '$webDir'; Write-Host 'WEB starting...' -ForegroundColor Magenta; npm run dev" `
    -PassThru

Start-Sleep -Seconds 5

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " All services launched!" -ForegroundColor Green
Write-Host ""
Write-Host "  Web App  : http://localhost:5173" -ForegroundColor White
Write-Host "  Backend  : http://localhost:3001" -ForegroundColor White
Write-Host "  Health   : http://localhost:3001/health" -ForegroundColor White
Write-Host ""
Write-Host "  Press CTRL+C in each terminal window to stop." -ForegroundColor DarkGray
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
