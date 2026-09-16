@echo off
setlocal

set "HERE=%~dp0"
set "SCRIPT=%HERE%stl-to-bgsd.js"
set "OUT_DIR=%HERE%my_designs"
set "COMBINED=%OUT_DIR%\all-inserts.scad"

if not exist "%SCRIPT%" (
  echo Nao encontrei stl-to-bgsd.js em:
  echo %SCRIPT%
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado no PATH.
  echo Instale o Node.js ou execute o conversor pelo ambiente onde o Node esta disponivel.
  echo.
  pause
  exit /b 1
)

echo Convertendo arquivos STL da pasta:
echo %HERE%
echo.

node "%SCRIPT%" --combined "%COMBINED%" "%HERE%*.stl"
set "STATUS=%ERRORLEVEL%"

echo.
if "%STATUS%"=="0" (
  echo Conversao finalizada.
  echo Arquivos gerados em:
  echo %OUT_DIR%
) else (
  echo A conversao terminou com erro: %STATUS%
)
echo.
pause
exit /b %STATUS%
