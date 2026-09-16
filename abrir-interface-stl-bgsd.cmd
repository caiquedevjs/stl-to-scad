@echo off
setlocal

set "HERE=%~dp0"
set "SERVER=%HERE%tools\gui-server.js"

if not exist "%SERVER%" (
  echo Nao encontrei o servidor da interface:
  echo %SERVER%
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado no PATH.
  echo.
  pause
  exit /b 1
)

start "" /B node "%SERVER%" --open >nul 2>nul
exit /b 0
