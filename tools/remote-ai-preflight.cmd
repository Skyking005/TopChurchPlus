@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0remote-ai-preflight.ps1" %*
exit /b %errorlevel%
