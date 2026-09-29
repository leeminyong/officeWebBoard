@echo off
rem 할 일 앱(웹 /todo, 안드로이드 앱) 전용 비밀번호를 설정하거나 바꿉니다.
rem 서버가 켜져 있어도 실행할 수 있습니다.
cd /d "%~dp0"

set "NODE_EXE=C:\Users\USER\AppData\Local\Programs\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"

"%NODE_EXE%" --no-warnings server\set-todo-password.js
echo.
pause
