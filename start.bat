@echo off
title WhatsApp Blaster Launcher
color 0A

echo ========================================================
echo         WhatsApp Blaster - Starting Services            
echo ========================================================
echo.

:: Navigate to script directory
cd /d "%~dp0"

:: 1. Start Backend Service in a new window
echo [1/3] Starting WhatsApp Backend Service on port 3003...
start "WhatsApp Blaster - Backend (Port 3003)" cmd /k "cd /d ""%~dp0mini-services\whatsapp-service"" && npm run dev"

:: Wait 4 seconds for the backend service to initialize
echo [2/3] Waiting for backend service to initialize...
timeout /t 4 /nobreak >nul

:: 2. Open browser
echo [3/3] Launching Web Browser at http://localhost:3000...
start http://localhost:3000

:: 3. Start Frontend in the current window
echo.
echo ========================================================
echo  Frontend running on http://localhost:3000
echo  Backend running on http://localhost:3003
echo.
echo  To STOP the frontend, press Ctrl+C in this window.
echo  Close the backend window to stop the backend service.
echo ========================================================
echo.

npm run dev
