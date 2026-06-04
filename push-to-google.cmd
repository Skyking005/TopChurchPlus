@echo off
setlocal
cd /d "%~dp0"
"%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "%APPDATA%\npm\node_modules\@google\clasp\build\src\index.js" push
endlocal
