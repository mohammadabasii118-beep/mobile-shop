@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ===== Step 2: Installing libraries =====
py -m pip install --upgrade pip
py -m pip install numpy playwright
py -m playwright install chromium
echo.
ffmpeg -version | findstr "ffmpeg version"
echo.
echo If you see "ffmpeg version" above, everything is ready. Run 3-build.bat
pause
