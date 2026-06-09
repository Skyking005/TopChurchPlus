@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0check-rebuild-readiness.ps1" %*
exit /b %errorlevel%
