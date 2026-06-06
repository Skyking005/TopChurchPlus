@echo off
setlocal
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0invoke-json-utf8.ps1" %*
exit /b %errorlevel%
