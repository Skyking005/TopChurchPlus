@echo off
setlocal
if "%~1"=="" (
  echo Usage: tools\run-ps1.cmd path\to\script.ps1 [args...]
  exit /b 1
)
set "SCRIPT_PATH=%~1"
shift /1
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_PATH%" %*
exit /b %errorlevel%
