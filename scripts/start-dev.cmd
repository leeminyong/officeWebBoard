@echo off
rem scripts\ 폴더 기준으로 한 단계 위(프로젝트 루트)로 이동합니다.
cd /d "%~dp0.."

set "NODE_EXE=C:\Users\USER\AppData\Local\Programs\nodejs\node.exe"
set "NPM_EXE=C:\Users\USER\AppData\Local\Programs\nodejs\npm.cmd"

echo [1/2] 백엔드 서버(API) 시작 중... (포트 3000)
start "백엔드 서버" "%NODE_EXE%" server\server.js

echo [2/2] 개발 서버 시작 중... (포트 5173)
echo.
echo 접속 주소: http://192.168.0.139:5173
echo 파일을 저장하면 브라우저가 자동으로 새로고침됩니다.
echo 개발이 끝나면 이 창을 닫고 scripts\start-officeWebBoard.cmd 로 실행하세요.
echo.
"%NPM_EXE%" run dev
pause
