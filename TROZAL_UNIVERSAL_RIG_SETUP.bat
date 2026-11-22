@echo off
setlocal EnableExtensions
title TROZAL MOTION - Universal Object Rig Setup
cd /d "%~dp0"

echo ==========================================================
echo   TROZAL MOTION - UNIVERSAL OBJECT RIG / SAM 2.1 TINY
echo ==========================================================
echo.
echo This installs a local-only object segmentation engine.
echo Qwen Vision remains your local Ollama model.
echo The SAM 2.1 Tiny checkpoint is about 150 MB.
echo.

where py.exe >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python Launcher (py.exe) was not found.
  echo Install Python 3.10, 3.11 or 3.12 from https://www.python.org/downloads/windows/
  echo Enable "Python Launcher" during installation, then run this file again.
  pause
  exit /b 1
)

set "PYTHON_CMD="
for %%V in (3.11 3.10 3.12) do (
  if not defined PYTHON_CMD (
    py -%%V -c "import sys; print(sys.version_info[:2])" >nul 2>nul
    if not errorlevel 1 set "PYTHON_CMD=py -%%V"
  )
)
if not defined PYTHON_CMD (
  echo [ERROR] Python 3.10, 3.11 or 3.12 is required.
  pause
  exit /b 1
)
echo Python: %PYTHON_CMD%

if not exist ".trozal-rig-venv\Scripts\python.exe" (
  echo [1/6] Creating isolated Python environment...
  %PYTHON_CMD% -m venv .trozal-rig-venv
  if errorlevel 1 goto :failed
)
call ".trozal-rig-venv\Scripts\activate.bat"

echo [2/6] Updating pip tools...
python -m pip install --upgrade pip setuptools wheel
if errorlevel 1 goto :failed

echo [3/6] Installing PyTorch CUDA 12.1 for compatible NVIDIA GPUs...
echo If this fails, the installer will use the CPU-only PyTorch build.
python -m pip install torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cu121
if errorlevel 1 (
  echo [NOTICE] CUDA PyTorch install failed. Installing CPU fallback...
  python -m pip install --force-reinstall torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cpu
  if errorlevel 1 goto :failed
)

echo [4/6] Installing local API and inpainting dependencies...
python -m pip install flask flask-cors opencv-python-headless pillow numpy
if errorlevel 1 goto :failed

if not exist "sam2-runtime\sam2\build_sam.py" (
  echo [5/6] Downloading official Meta SAM 2 source...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing 'https://github.com/facebookresearch/sam2/archive/refs/heads/main.zip' -OutFile 'sam2-runtime.zip'; Expand-Archive -Force 'sam2-runtime.zip' '.'; if (Test-Path 'sam2-runtime') { Remove-Item -Recurse -Force 'sam2-runtime' }; Move-Item 'sam2-main' 'sam2-runtime'; Remove-Item 'sam2-runtime.zip'"
  if errorlevel 1 goto :failed
)

echo Installing SAM 2 without compiling the optional CUDA extension...
set "SAM2_BUILD_CUDA=0"
set "SAM2_BUILD_ALLOW_ERRORS=1"
python -m pip install -e sam2-runtime
if errorlevel 1 goto :failed

if not exist "checkpoints" mkdir checkpoints
if not exist "checkpoints\sam2.1_hiera_tiny.pt" (
  echo [6/6] Downloading SAM 2.1 Hiera Tiny checkpoint...
  curl.exe --fail --location --retry 3 --retry-delay 2 "https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_tiny.pt" --output "checkpoints\sam2.1_hiera_tiny.pt"
  if errorlevel 1 goto :failed
) else (
  echo [6/6] SAM 2.1 checkpoint already exists.
)

echo.
echo [SUCCESS] Universal Object Rig is installed.
echo Run TROZAL_UNIVERSAL_RIG_START.bat whenever you want to use Mode 5.
echo This server binds only to 127.0.0.1:11436.
echo.
pause
exit /b 0

:failed
echo.
echo [FAILED] Setup stopped. Read the error above.
echo No Ollama model or existing TROZAL project file was changed.
echo.
pause
exit /b 1
