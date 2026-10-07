@echo off
title WhatsApp Blaster - Stop Services
color 0C

echo ========================================================
echo         Stopping WhatsApp Blaster Services               
echo ========================================================
echo.

echo Stopping processes on port 3000 (Frontend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo Stopping processes on port 3003 (Backend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3003" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo All WhatsApp Blaster services have been stopped.
echo.
pause
