@echo off
rem -------------------------------------------------------------
rem restart-server.cmd : 게시판 + 할 일 서버(3000번 포트)를 껐다가 다시 켭니다.
rem
rem cmd 주석 문법: rem 뒤의 글은 실행되지 않는 설명입니다.
rem
rem 동작 순서
rem   1단계) 3000번 포트를 쓰고 있는 프로그램의 번호(PID)를 찾습니다.
rem   2단계) 그 프로그램이 node.exe 인지 확인합니다. (다른 프로그램을 실수로 끄지 않기 위해)
rem   3단계) node.exe 를 끄고, 포트가 비워질 때까지 기다립니다.
rem   4단계) start-officeWebBoard.cmd 를 새 창으로 실행해서 서버를 다시 켭니다.
rem   5단계) 서버가 다시 켜졌는지 확인하고 결과를 보여줍니다.
rem
rem 외부 주소를 만드는 cloudflared 는 건드리지 않습니다. 그래서 외부 주소는 바뀌지 않습니다.
rem -------------------------------------------------------------

rem setlocal : 이 파일에서 만든 변수가 파일이 끝나면 사라지게 합니다.
setlocal
rem %~dp0 : 이 cmd 파일이 있는 폴더 경로입니다. (D:\officeWebBoard\)
cd /d "%~dp0"

echo [1/4] 3000번 포트에서 실행 중인 서버를 찾는 중...

rem netstat -ano : 사용 중인 포트와 프로그램 번호(PID) 목록을 보여줍니다.
rem findstr : 그중 ":3000" 포트를 LISTENING(요청 대기) 중인 줄만 고릅니다.
rem for /f "tokens=5" : 그 줄을 공백으로 나눈 5번째 값(PID)을 SERVER_PID 변수에 넣습니다.
set "SERVER_PID="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":3000 .*LISTENING"') do set "SERVER_PID=%%p"

rem if not defined 변수 : 변수가 비어 있으면 (= 실행 중인 서버가 없으면) 바로 켜는 단계로 갑니다.
if not defined SERVER_PID (
  echo     실행 중인 서버가 없습니다. 바로 서버를 켭니다.
  goto START
)

rem tasklist /FI "PID eq 번호" : 그 번호의 프로그램 이름을 확인합니다.
rem findstr /I "node.exe" : 이름이 node.exe 일 때만 다음으로 넘어갑니다. (/I = 대소문자 무시)
rem %errorlevel% : 바로 앞 명령의 결과. 0 이면 찾음, 0 이 아니면 못 찾음.
tasklist /FI "PID eq %SERVER_PID%" /NH | findstr /I "node.exe" >nul
if not %errorlevel%==0 (
  echo.
  echo     3000번 포트를 node.exe 가 아닌 다른 프로그램^(PID %SERVER_PID%^)이 쓰고 있습니다.
  echo     안전을 위해 끄지 않고 멈춥니다. 작업 관리자에서 어떤 프로그램인지 확인해 주세요.
  goto END
)

echo [2/4] 서버^(node.exe, PID %SERVER_PID%^)를 끄는 중...
rem taskkill /PID 번호 /F : 그 번호의 프로그램을 강제로 끕니다.
taskkill /PID %SERVER_PID% /F >nul

rem 포트가 비워질 때까지 1초씩 최대 10번 기다립니다.
rem timeout /t 1 : 1초 기다립니다. /nobreak : 키를 눌러도 건너뛰지 않습니다.
rem set /a : 숫자 계산용 변수 설정입니다. WAIT+=1 은 WAIT 를 1 늘립니다.
set /a WAIT=0
:WAIT_STOP
netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul
if not %errorlevel%==0 goto STOPPED
set /a WAIT+=1
if %WAIT% GEQ 10 goto STOP_FAIL
timeout /t 1 /nobreak >nul
goto WAIT_STOP

:STOP_FAIL
echo     서버가 10초 안에 꺼지지 않았습니다. 작업 관리자에서 node.exe 를 확인해 주세요.
goto END

:STOPPED
echo     서버를 껐습니다.

:START
echo [3/4] 서버를 새 창으로 다시 켜는 중...
rem start "창 제목" 명령 : 명령을 새 창에서 실행합니다. 이 창을 닫아도 서버는 계속 켜져 있습니다.
start "게시판 서버" cmd /c ""%~dp0start-officeWebBoard.cmd""

rem 서버가 켜질 때까지 1초씩 최대 15번 기다립니다.
set /a WAIT=0
:WAIT_START
timeout /t 1 /nobreak >nul
netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul
if %errorlevel%==0 goto STARTED
set /a WAIT+=1
if %WAIT% GEQ 15 goto START_FAIL
goto WAIT_START

:START_FAIL
echo     서버가 15초 안에 켜지지 않았습니다. "게시판 서버" 창의 오류 메시지를 확인해 주세요.
goto END

:STARTED
echo [4/4] 완료! 서버가 다시 켜졌습니다.
echo.
echo     게시판 : http://192.168.0.139:3000
echo     할 일  : http://192.168.0.139:3000/todo
echo     외부 주소는 cloudflared 창에 나온 주소 뒤에 /todo 를 붙이면 됩니다.

:END
echo.
pause
