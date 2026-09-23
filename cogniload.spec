# cogniload.spec — PyInstaller packaging spec
#
# Build command (run from the project root on Windows):
#   pyinstaller cogniload.spec
#
# Output: dist/CogniLoad/CogniLoad.exe  (one-folder mode)
# Then run Inno Setup on installer/setup.iss to create the single .exe installer.

import sys
import glob
from pathlib import Path
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

ROOT = Path(SPECPATH)   # directory containing this .spec file == project root

# ── Anaconda DLL fix ──────────────────────────────────────────────────────────
# When building inside a venv on top of Anaconda, PyInstaller resolves .pyd
# files from Anaconda's DLLs\ folder but can't find the companion .dll files
# (libmpdec, liblzma, sqlite3, ffi, libexpat, tcl/tk, etc.) because Anaconda
# bundles them differently.  We collect them explicitly as binaries so they
# land next to the exe in the dist folder.

import os, glob as _glob

def _anaconda_dlls():
    """Return (src, dest) tuples for Anaconda companion DLLs."""
    candidates = [
        r"C:\ProgramData\anaconda3\DLLs",
        r"C:\ProgramData\anaconda3\Library\bin",
        r"C:\ProgramData\anaconda3",
    ]
    wanted = {
        "libmpdec*.dll", "liblzma*.dll", "LIBBZ2*.dll", "libbz2*.dll",
        "ffi*.dll",       "libexpat*.dll", "sqlite3*.dll",
        "tcl86*.dll",     "tk86*.dll",
        "libcrypto*.dll", "libssl*.dll",
    }
    found = []
    for folder in candidates:
        p = Path(folder)
        if not p.exists():
            continue
        for pattern in wanted:
            for dll in p.glob(pattern):
                found.append((str(dll), "."))
    return found

extra_binaries = _anaconda_dlls()

# ── Collect data files ────────────────────────────────────────────────────────

datas = [
    # Backend Python package
    (str(ROOT / "backend"),  "backend"),
    # Pre-built React frontend (npm run build → frontend/dist)
    (str(ROOT / "frontend" / "dist"), "frontend/dist"),
    # ML saved model + scaler
    (str(ROOT / "ml" / "saved_models"), "ml/saved_models"),
    # App icon
    (str(ROOT / "resources" / "icon.ico"), "resources"),
    (str(ROOT / "resources" / "icon.png"), "resources"),
]

# Pull in any package data (e.g. scikit-learn bundled models, etc.)
datas += collect_data_files("sklearn")
datas += collect_data_files("pystray")

# ── Hidden imports ────────────────────────────────────────────────────────────
# Some modules are only imported at runtime and PyInstaller can't detect them.

hiddenimports = [
    # FastAPI / Starlette internals
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "starlette.routing",
    "starlette.staticfiles",
    "starlette.responses",
    "starlette.middleware",
    "starlette.middleware.cors",
    # Database
    "sqlalchemy.dialects.sqlite",
    "sqlalchemy.dialects.postgresql",
    # Auth / crypto
    "jose",
    "jose.jwt",
    "jose.exceptions",
    "cryptography",
    "bcrypt",
    # passlib not used — project uses bcrypt directly
    # ML
    "sklearn",
    "sklearn.ensemble",
    "sklearn.preprocessing",
    "sklearn.pipeline",
    "joblib",
    # Pydantic
    "pydantic",
    "pydantic.v1",
    "email_validator",
    # Windows extras (only if pywin32 is installed — optional)
    # "win32api", "win32con", "win32gui", "pywintypes",
    # Tray
    "pystray",
    "pystray._win32",
    "PIL",
    "PIL.Image",
    "PIL.ImageDraw",
]

hiddenimports += collect_submodules("uvicorn")
hiddenimports += collect_submodules("fastapi")
hiddenimports += collect_submodules("sqlalchemy")
hiddenimports += collect_submodules("sklearn")

# ── Analysis ──────────────────────────────────────────────────────────────────

a = Analysis(
    [str(ROOT / "cogniload_app.py")],
    pathex=[str(ROOT), str(ROOT / "backend")],
    binaries=extra_binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["matplotlib", "IPython", "notebook", "pytest"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="CogniLoad",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,            # No console window (GUI app)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(ROOT / "resources" / "icon.ico"),
    version=str(ROOT / "resources" / "version_info.txt"),
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="CogniLoad",
)
