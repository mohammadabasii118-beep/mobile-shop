@echo off
chcp 65001 >nul
echo ===== Step 1: Installing Python and FFmpeg =====
winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements
winget install -e --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements
echo.
echo DONE. Close this window, then run 2-install.bat
pause
