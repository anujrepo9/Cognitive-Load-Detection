@echo off
setlocal

REM Resolve the project root (one level up from this script's folder)
set ROOT=%~dp0..

echo [1/2] Building backend sidecar...
pyinstaller --onefile ^
    --distpath "%ROOT%\src-tauri\sidecars" ^
    --workpath "%ROOT%\build\backend" ^
    --specpath "%ROOT%\build" ^
    --name cogniload_backend ^
    --paths "%ROOT%\backend" ^
    "%ROOT%\backend\start.py"

if %ERRORLEVEL% neq 0 (
    echo ERROR: backend build failed.
    exit /b 1
)

echo [2/2] Building collector sidecar...
pyinstaller --onefile ^
    --distpath "%ROOT%\src-tauri\sidecars" ^
    --workpath "%ROOT%\build\collector" ^
    --specpath "%ROOT%\build" ^
    --name cogniload_collector ^
    --paths "%ROOT%\backend" ^
    "%ROOT%\backend\collector\main.py"

if %ERRORLEVEL% neq 0 (
    echo ERROR: collector build failed.
    exit /b 1
)

echo.
echo Done. Sidecars are in src-tauri\sidecars\
echo Now run: npm run tauri build

endlocal