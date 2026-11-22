@echo off
setlocal EnableExtensions
title TROZAL MOTION - Universal Object Rig Server
cd /d "%~dp0"

if not exist ".trozal-rig-venv\Scripts\python.exe" (
  echo [ERROR] Universal Rig has not been installed.
  echo Run TROZAL_UNIVERSAL_RIG_SETUP.bat first.
  pause
  exit /b 1
)
if not exist "checkpoints\sam2.1_hiera_tiny.pt" (
  echo [ERROR] SAM 2.1 checkpoint is missing.
  echo Run TROZAL_UNIVERSAL_RIG_SETUP.bat first.
  pause
  exit /b 1
)

call ".trozal-rig-venv\Scripts\activate.bat"
set "TROZAL_RIG_PORT=11436"
set "TROZAL_RIG_MAX_SIDE=1024"
set "TROZAL_RIG_MAX_MASKS=14"
set "TROZAL_RIG_INPAINT_MAX_SIDE=2048"
echo ==========================================================
echo   TROZAL UNIVERSAL OBJECT RIG SERVER
echo ==========================================================
echo Local API: http://127.0.0.1:11436/api/health
echo Engine   : SAM 2.1 Hiera Tiny
echo Model is loaded only when you click Analyze / Segment.
echo Keep this window open while using Universal Rig.
echo Press Ctrl+C to stop.
echo.
python TROZAL_UNIVERSAL_RIG_SERVER.py
echo.
echo Universal Rig server stopped.
pause
