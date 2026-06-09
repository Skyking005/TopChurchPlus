@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0local-ai-preflight.ps1" %*
exit /b %errorlevel%
