@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-smoke.ps1" %*
