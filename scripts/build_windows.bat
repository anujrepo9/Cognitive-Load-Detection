@echo off
REM =============================================================
REM  build_windows.bat — Full CogniLoad Windows build pipeline
REM
REM  Run this from the PROJECT ROOT directory:
REM      scripts\build_windows.bat
REM
REM  What it does:
REM    1. Checks prerequisites (Python, Node.js, PyInstaller, Inno Setup)
REM    2. Installs Python dependencies
REM    3. Builds React frontend  (npm run build  →  frontend\dist)
REM    4. Runs PyInstaller       (→  dist\CogniLoad\)
REM    5. Compiles Inno Setup    (→  installer\Output\CogniLoad_Setup_x.x.x.exe)
REM =============================================================

setlocal EnableDelayedExpansion
set ROOT=%~dp0..
cd /d "%ROOT%"

echo.
echo ============================================================
echo  CogniLoad — Windows Build Pipeline
echo ============================================================
echo.

REM ── 0. Activate venv if present and not already active ───────
if exist ".venv\Scripts\activate.bat" (
    if "%VIRTUAL_ENV%"=="" (
        echo [INFO] Activating .venv...
        call .venv\Scripts\activate.bat
    )
)

REM ── 1. Check Python ──────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install Python 3.11+ from https://python.org
    exit /b 1
)
echo [OK] Python found

REM ── 2. Check Node.js ─────────────────────────────────────────
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    exit /b 1
)
echo [OK] Node.js found

REM ── 3. Install / upgrade Python dependencies ─────────────────
echo.
echo [STEP 1/4] Installing Python dependencies...
pip install -r backend\requirements.txt --quiet
if errorlevel 1 ( echo [ERROR] pip install failed & exit /b 1 )

REM Packaging tools
pip install pyinstaller pystray Pillow --quiet
if errorlevel 1 ( echo [ERROR] Could not install packaging tools & exit /b 1 )
echo [OK] Python packages installed

REM ── 4. Build React frontend ───────────────────────────────────
echo.
echo [STEP 2/4] Building React frontend...
cd frontend
call npm install --silent
if errorlevel 1 ( echo [ERROR] npm install failed & exit /b 1 )
call npm run build
if errorlevel 1 ( echo [ERROR] npm run build failed & exit /b 1 )
cd ..
echo [OK] Frontend built → frontend\dist

REM ── 5. Generate app resources ────────────────────────────────
echo.
echo [STEP 3/4] Running PyInstaller...
if not exist resources mkdir resources

REM Generate a placeholder icon if none exists
if not exist resources\icon.ico (
    python scripts\generate_icon.py
)

REM Use python -m PyInstaller to guarantee we use the venv's pyinstaller
python -m PyInstaller cogniload.spec --noconfirm --clean
if errorlevel 1 ( echo [ERROR] PyInstaller failed & exit /b 1 )
echo [OK] PyInstaller output → dist\CogniLoad\

REM ── 6. Compile Inno Setup installer ──────────────────────────
echo.
echo [STEP 4/4] Compiling Inno Setup installer...

REM Look for Inno Setup in common locations
set ISCC=""
if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" (
    set ISCC="C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
)
if exist "C:\Program Files\Inno Setup 6\ISCC.exe" (
    set ISCC="C:\Program Files\Inno Setup 6\ISCC.exe"
)

if %ISCC%=="" (
    echo [WARN] Inno Setup not found. Skipping installer creation.
    echo        Download from https://jrsoftware.org/isdl.php
    echo        Then run:  iscc installer\setup.iss
    echo.
    echo [DONE] PyInstaller build is at: dist\CogniLoad\CogniLoad.exe
    goto :end
)

if not exist installer\Output mkdir installer\Output
%ISCC% installer\setup.iss
if errorlevel 1 ( echo [ERROR] Inno Setup compilation failed & exit /b 1 )

echo.
echo ============================================================
echo  BUILD COMPLETE
echo  Installer: installer\Output\CogniLoad_Setup_1.0.0.exe
echo ============================================================
echo.

:end
endlocal
