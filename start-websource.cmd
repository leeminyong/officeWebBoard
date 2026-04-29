@echo off
rem Why: The Git-connected project folder is D:\officeWebBoard now.
rem How: Start the web server from this folder so code changes here are reflected on the site.
cd /d "D:\officeWebBoard"
"C:\Users\USER\AppData\Local\Programs\nodejs\node.exe" server.js >> server.log 2>> server-error.log
