@echo off
echo.
echo ========================================
echo   Restarting Backend
echo ========================================
echo.

echo Stopping Node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 >nul

echo.
echo Starting backend...
start "Backend Production" cmd /k "npm start"

echo.
echo Backend restarted!
echo.
pause
