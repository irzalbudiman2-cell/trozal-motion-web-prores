@echo off
setlocal EnableExtensions
title TROZAL MOTION - Install Automatic Ollama Bridge
cd /d "%~dp0"

set "INSTALL_DIR=%LOCALAPPDATA%\TROZAL MOTION\Ollama Bridge"
set "TASK_NAME=TROZAL MOTION Ollama Bridge"
set "SOURCE_PS=%~dp0TROZAL_OLLAMA_BRIDGE.ps1"
set "TARGET_PS=%INSTALL_DIR%\TROZAL_OLLAMA_BRIDGE.ps1"

echo ==================================================
echo   TROZAL MOTION - AUTO START BRIDGE INSTALLER
echo ==================================================
echo.
if not exist "%SOURCE_PS%" (
  echo [GAGAL] TROZAL_OLLAMA_BRIDGE.ps1 tidak ditemukan.
  echo Simpan file installer dan file PS1 dalam folder yang sama.
  pause
  exit /b 1
)

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if errorlevel 1 (
  echo [GAGAL] Tidak dapat membuat folder instalasi.
  pause
  exit /b 1
)

copy /y "%SOURCE_PS%" "%TARGET_PS%" >nul
if errorlevel 1 (
  echo [GAGAL] Tidak dapat menyalin Bridge.
  pause
  exit /b 1
)

set "PS_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
set "TASK_ACTION=^"%PS_EXE%^" -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ^"%TARGET_PS%^""
schtasks.exe /Create /TN "%TASK_NAME%" /SC ONLOGON /RL LIMITED /TR "%TASK_ACTION%" /F
if errorlevel 1 (
  echo [GAGAL] Tidak dapat membuat Scheduled Task.
  echo Coba jalankan installer dengan Run as administrator jika kebijakan Windows membatasi task.
  pause
  exit /b 1
)

echo.
echo [BERHASIL] Bridge akan berjalan otomatis setiap kali Windows login.
echo Menjalankan Bridge sekarang...
schtasks.exe /Run /TN "%TASK_NAME%"
echo.
echo Verifikasi: buka http://127.0.0.1:11435/api/tags
echo Setelah itu buka TROZAL MOTION dari GitHub Pages.
echo Installer ini cukup dijalankan satu kali.
pause
