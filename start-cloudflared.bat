@echo off
title Cloudflared Tunnel

cd /d D:\officeWebBoard

echo Waiting for server on port 3000...
echo.

:WAIT_LOOP
netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul
if %errorlevel% neq 0 (
    timeout /t 2 /nobreak >nul
    goto WAIT_LOOP
)

echo Server ready! Starting Cloudflared tunnel...
echo.
cloudflared-windows-amd64.exe tunnel --url http://localhost:3000

echo.
echo Tunnel closed. Press any key to exit.
pause