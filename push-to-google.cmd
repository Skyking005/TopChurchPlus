@echo off
setlocal
cd /d "%~dp0"
set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "CLASP_JS=%APPDATA%\npm\node_modules\@google\clasp\build\src\index.js"
set "DEPLOYMENT_ID=AKfycbwqO5FTVL_5iWCwHPGQH0ZhXM9IOH4U17UnTGKm7SVrP0NqZd4wEer-1z82B7HFTKkw"
set "GIT_EXE=%LOCALAPPDATA%\GitHubDesktop\app-3.5.2\resources\app\git\cmd\git.exe"
set "DEPLOY_DESC=auto deploy"

if exist "%GIT_EXE%" (
  for /f "usebackq delims=" %%i in (`"%GIT_EXE%" log -1 --pretty^=format:"%%h %%s"`) do set "DEPLOY_DESC=%%i"
)

"%NODE_EXE%" "%CLASP_JS%" push -f
if errorlevel 1 exit /b %errorlevel%

echo Deploy description: %DEPLOY_DESC%
"%NODE_EXE%" "%CLASP_JS%" deploy -i "%DEPLOYMENT_ID%" -d "%DEPLOY_DESC%"
if errorlevel 1 exit /b %errorlevel%
endlocal
