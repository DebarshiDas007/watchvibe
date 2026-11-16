@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
python "%SCRIPT_DIR%deploy.py" %*
if errorlevel 1 (
    exit /b %errorlevel%
)
