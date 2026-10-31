@echo off
chcp 65001 >nul
cd /d "%~dp0"
set /p EP=Episode number (example 5): 
py tool\editor.py %EP%
echo.
echo Video is in the "output" folder.
pause
