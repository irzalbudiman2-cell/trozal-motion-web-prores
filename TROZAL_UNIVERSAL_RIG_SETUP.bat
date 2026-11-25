@echo off
setlocal EnableExtensions
title TROZAL MOTION - Universal Object Rig Setup
cd /d "%~dp0"

echo ==========================================================
echo   TROZAL MOTION - UNIVERSAL OBJECT RIG / SAM 2.1 TINY
echo ==========================================================
echo.
echo Select the PyTorch accelerator profile:
echo [1] NVIDIA CUDA 12.8 - GTX 1660 Super, RTX 5060 and supported NVIDIA GPUs
echo [2] AMD ROCm 7.2.1 - supported Radeon GPUs on Windows 11 only
echo [3] CPU only - universal fallback, slower
echo.
set "GPU_PROFILE=1"
set /p GPU_PROFILE="Choose profile [1/2/3, default 1]: "
if "%GPU_PROFILE%"=="" set "GPU_PROFILE=1"
if "%GPU_PROFILE%"=="1" goto :profile_nvidia
if "%GPU_PROFILE%"=="2" goto :profile_amd
if "%GPU_PROFILE%"=="3" goto :profile_cpu
echo [ERROR] Invalid GPU profile.
pause
exit /b 1

:profile_nvidia
set "TORCH_PROFILE=nvidia"
set "TROZAL_RIG_DEVICE=auto"
goto :python_select

:profile_amd
set "TORCH_PROFILE=amd"
set "TROZAL_RIG_DEVICE=auto"
goto :python_select

:profile_cpu
set "TORCH_PROFILE=cpu"
set "TROZAL_RIG_DEVICE=cpu"
goto :python_select

:python_select
where py.exe >nul 2>nul
if errorlevel 1 goto :no_launcher
set "PYTHON_CMD="
py -3.12 -c "import sys" >nul 2>nul
if not errorlevel 1 set "PYTHON_CMD=py -3.12"
if defined PYTHON_CMD goto :python_found
if "%TORCH_PROFILE%"=="amd" goto :python_missing
py -3.11 -c "import sys" >nul 2>nul
if not errorlevel 1 set "PYTHON_CMD=py -3.11"
if defined PYTHON_CMD goto :python_found
py -3.10 -c "import sys" >nul 2>nul
if not errorlevel 1 set "PYTHON_CMD=py -3.10"
if defined PYTHON_CMD goto :python_found
:python_missing
echo [ERROR] Python 3.12 is required for AMD ROCm. NVIDIA/CPU support Python 3.10-3.12.
pause
exit /b 1

:no_launcher
echo [ERROR] Python Launcher (py.exe) was not found.
echo Install Python 3.10, 3.11 or 3.12 from https://www.python.org/downloads/windows/
pause
exit /b 1

:python_found
echo Python: %PYTHON_CMD%
echo Accelerator profile: %TORCH_PROFILE%

if exist ".trozal-rig-venv\Scripts\python.exe" goto :venv_ready
echo [1/6] Creating isolated Python environment...
%PYTHON_CMD% -m venv .trozal-rig-venv
if errorlevel 1 goto :failed

:venv_ready
call ".trozal-rig-venv\Scripts\activate.bat"
if errorlevel 1 goto :failed

echo [2/6] Updating pip tools...
python -m pip install --upgrade pip setuptools wheel
if errorlevel 1 goto :failed

echo [3/6] Installing PyTorch for selected GPU profile...
if "%TORCH_PROFILE%"=="nvidia" goto :install_nvidia
if "%TORCH_PROFILE%"=="amd" goto :install_amd
goto :install_cpu

:install_nvidia
echo NVIDIA CUDA 12.8 PyTorch supports Turing sm_75 and Blackwell sm_120.
python -m pip install --no-cache-dir torch==2.9.1 torchvision==0.24.1 --index-url https://download.pytorch.org/whl/cu128
if not errorlevel 1 goto :torch_ready
echo [NOTICE] NVIDIA CUDA install failed. Installing CPU fallback...
goto :install_cpu

:install_amd
echo AMD ROCm 7.2.1 requires Windows 11, Python 3.12 and a supported Radeon GPU/driver.
echo Unsupported Radeon models will not be accelerated by this AMD Windows package.
python -m pip install --no-cache-dir https://repo.radeon.com/rocm/windows/rocm-rel-7.2.1/rocm_sdk_core-7.2.1-py3-none-win_amd64.whl https://repo.radeon.com/rocm/windows/rocm-rel-7.2.1/rocm_sdk_devel-7.2.1-py3-none-win_amd64.whl https://repo.radeon.com/rocm/windows/rocm-rel-7.2.1/rocm_sdk_libraries_custom-7.2.1-py3-none-win_amd64.whl https://repo.radeon.com/rocm/windows/rocm-rel-7.2.1/rocm-7.2.1.tar.gz
if errorlevel 1 goto :amd_failed
python -m pip install --no-cache-dir https://repo.radeon.com/rocm/windows/rocm-rel-7.2.1/torch-2.9.1%2Brocm7.2.1-cp312-cp312-win_amd64.whl https://repo.radeon.com/rocm/windows/rocm-rel-7.2.1/torchvision-0.24.1%2Brocm7.2.1-cp312-cp312-win_amd64.whl
if not errorlevel 1 goto :torch_ready
:amd_failed
echo [NOTICE] AMD ROCm profile failed or GPU/driver is unsupported.
echo Installing CPU fallback so SAM 2.1 remains available.
goto :install_cpu

:install_cpu
python -m pip install --no-cache-dir --force-reinstall torch==2.9.1 torchvision==0.24.1 --index-url https://download.pytorch.org/whl/cpu
if errorlevel 1 goto :failed

:torch_ready
echo [4/6] Installing local API and inpainting dependencies...
python -m pip install flask flask-cors opencv-python-headless pillow numpy mediapipe==0.10.21
if errorlevel 1 goto :failed

if exist "sam2-runtime\sam2\build_sam.py" goto :sam_source_ready
echo [5/6] Downloading official Meta SAM 2 source...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing 'https://github.com/facebookresearch/sam2/archive/refs/heads/main.zip' -OutFile 'sam2-runtime.zip'; Expand-Archive -Force 'sam2-runtime.zip' '.'; if (Test-Path 'sam2-runtime') { Remove-Item -Recurse -Force 'sam2-runtime' }; Move-Item 'sam2-main' 'sam2-runtime'; Remove-Item 'sam2-runtime.zip'"
if errorlevel 1 goto :failed

:sam_source_ready
echo Installing SAM 2 without compiling the optional custom CUDA extension...
set "SAM2_BUILD_CUDA=0"
set "SAM2_BUILD_ALLOW_ERRORS=1"
python -m pip install -e sam2-runtime
if errorlevel 1 goto :failed

if not exist "checkpoints" mkdir checkpoints
if exist "checkpoints\sam2.1_hiera_tiny.pt" goto :checkpoint_ready
echo [6/6] Downloading SAM 2.1 Hiera Tiny checkpoint...
curl.exe --fail --location --retry 3 --retry-delay 2 "https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_tiny.pt" --output "checkpoints\sam2.1_hiera_tiny.pt"
if errorlevel 1 goto :failed

:checkpoint_ready
if exist "checkpoints\\pose_landmarker_lite.task" goto :pose_checkpoint_ready
echo Downloading local MediaPipe Pose Landmarker Lite model...
curl.exe --fail --location --retry 3 --retry-delay 2 "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task" --output "checkpoints\\pose_landmarker_lite.task"
if errorlevel 1 goto :failed

:pose_checkpoint_ready
echo.
echo [SUCCESS] Universal Object Rig is installed.
echo Selected profile: %TORCH_PROFILE%
echo Device is detected automatically when the server starts.
echo Run TROZAL_UNIVERSAL_RIG_START.bat to use Mode 5.
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
