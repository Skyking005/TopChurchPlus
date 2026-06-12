@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0check-ai-context-freshness.ps1" %*
exit /b %ERRORLEVEL%
