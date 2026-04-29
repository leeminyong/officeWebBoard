@echo off
setlocal

rem Why: Chrome must trust this local certificate before it stops showing the HTTPS warning.
rem How: Add onepass-local.cer to the Windows Trusted Root Certification Authorities store.
cd /d "%~dp0"
certutil -addstore Root "%~dp0onepass-local.cer"

echo.
echo Done. Close all Chrome windows, then open Chrome again.
echo If Chrome is still running in the background, end chrome.exe from Task Manager.
pause
