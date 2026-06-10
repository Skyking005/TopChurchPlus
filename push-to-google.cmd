@echo off
setlocal
cd /d "%~dp0"
set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "CLASP_CMD=%~dp0node_modules\.bin\clasp.cmd"
set "DEPLOYMENT_ID=AKfycbwqO5FTVL_5iWCwHPGQH0ZhXM9IOH4U17UnTGKm7SVrP0NqZd4wEer-1z82B7HFTKkw"
set "GIT_EXE=%LOCALAPPDATA%\GitHubDesktop\app-3.5.2\resources\app\git\cmd\git.exe"
set "DEPLOY_DESC=auto deploy"

if not exist "%CLASP_CMD%" (
  echo Missing local clasp command: %CLASP_CMD%
  echo Run npm install first.
  exit /b 1
)

if exist "%GIT_EXE%" (
  for /f "usebackq delims=" %%i in (`"%GIT_EXE%" log -1 --oneline`) do set "DEPLOY_DESC=%%i"
)

call "%CLASP_CMD%" push -f
if errorlevel 1 exit /b %errorlevel%

echo Deploy description: %DEPLOY_DESC%
call "%CLASP_CMD%" deploy -i "%DEPLOYMENT_ID%" -d "%DEPLOY_DESC%"
if errorlevel 1 exit /b %errorlevel%
endlocal
