@echo off
setlocal

set "HERE=%~dp0"
set "GUI=%HERE%stl-to-bgsd-gui.html"

if not exist "%GUI%" (
  echo Nao encontrei a interface:
  echo %GUI%
  echo.
  pause
  exit /b 1
)

start "" "%GUI%"
exit /b 0
