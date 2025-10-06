# Скрипт для просмотра логов backend

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("combined", "error", "all", "tail")]
    [string]$Type = "tail",
    
    [Parameter(Mandatory=$false)]
    [int]$Lines = 100
)

$BackendLogsPath = "$PSScriptRoot\backend\logs"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Backend Logs Viewer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $BackendLogsPath)) {
    Write-Host "❌ Папка с логами не найдена: $BackendLogsPath" -ForegroundColor Red
    Write-Host "   Проверьте что backend запущен" -ForegroundColor Yellow
    exit 1
}

switch ($Type) {
    "combined" {
        Write-Host "📄 Показываю ВСЕ логи (combined)..." -ForegroundColor Green
        Write-Host ""
        Get-ChildItem "$BackendLogsPath\combined-*.log" -ErrorAction SilentlyContinue | 
            ForEach-Object { Get-Content $_.FullName }
    }
    
    "error" {
        Write-Host "❌ Показываю только ОШИБКИ..." -ForegroundColor Red
        Write-Host ""
        Get-ChildItem "$BackendLogsPath\error-*.log" -ErrorAction SilentlyContinue | 
            ForEach-Object { Get-Content $_.FullName }
    }
    
    "tail" {
        Write-Host "📊 Показываю последние $Lines строк..." -ForegroundColor Green
        Write-Host ""
        Get-ChildItem "$BackendLogsPath\combined-*.log" -ErrorAction SilentlyContinue | 
            Sort-Object LastWriteTime -Descending | 
            Select-Object -First 1 | 
            ForEach-Object { Get-Content $_.FullName -Tail $Lines }
    }
    
    "all" {
        Write-Host "📦 Показываю ВСЕ файлы логов:" -ForegroundColor Green
        Write-Host ""
        Get-ChildItem "$BackendLogsPath\*.log" -ErrorAction SilentlyContinue | 
            Format-Table Name, Length, LastWriteTime -AutoSize
        Write-Host ""
        Write-Host "💡 Используйте:" -ForegroundColor Yellow
        Write-Host "   .\show-logs.ps1 -Type combined    # Все логи"
        Write-Host "   .\show-logs.ps1 -Type error       # Только ошибки"
        Write-Host "   .\show-logs.ps1 -Type tail        # Последние 100 строк"
        Write-Host "   .\show-logs.ps1 -Type tail -Lines 200  # Последние 200 строк"
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Для мониторинга в реальном времени:" -ForegroundColor Yellow
Write-Host "   Get-Content '$BackendLogsPath\combined-*.log' -Tail 50 -Wait"
Write-Host ""
