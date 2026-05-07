@echo off
setlocal

cd /d "%~dp0"

set "NODE_EXE=C:\Users\USER\AppData\Local\Programs\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"

netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul
if %errorlevel%==0 (
  echo The website is already running.
  echo Opening http://192.168.0.139:3000
  start "" "http://192.168.0.139:3000"
  pause
  exit /b 0
)

if not exist "server.js" (
  echo Cannot find server.js in this folder:
  cd
  pause
  exit /b 1
)

echo Starting office web board...
echo Open this address in your browser: http://192.168.0.139:3000
"%NODE_EXE%" server.js
pause
