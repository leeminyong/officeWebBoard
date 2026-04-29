@echo off
rem Why: This project now runs from the Git-connected D:\officeWebBoard folder.
rem How: Start server.js here and write runtime logs beside the project files.
cd /d "D:\officeWebBoard"
"C:\Users\USER\AppData\Local\Programs\nodejs\node.exe" server.js >> server.log 2>> server-error.log
