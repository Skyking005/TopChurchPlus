@echo off
setlocal
cd /d "%~dp0"
set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "CLASP_JS=%APPDATA%\npm\node_modules\@google\clasp\build\src\index.js"
set "DEPLOYMENT_ID=AKfycbwqO5FTVL_5iWCwHPGQH0ZhXM9IOH4U17UnTGKm7SVrP0NqZd4wEer-1z82B7HFTKkw"

"%NODE_EXE%" "%CLASP_JS%" push -f
if errorlevel 1 exit /b %errorlevel%

"%NODE_EXE%" "%CLASP_JS%" deploy -i "%DEPLOYMENT_ID%" -d "auto deploy"
if errorlevel 1 exit /b %errorlevel%
endlocal
