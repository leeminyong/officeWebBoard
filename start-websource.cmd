@echo off
cd /d "D:\websource"
"C:\Users\USER\AppData\Local\Programs\nodejs\node.exe" server.js >> server.log 2>> server-error.log
