@echo off
setlocal EnableExtensions
title TROZAL MOTION - Ollama Bridge
cd /d "%~dp0"

echo ==================================================
echo   TROZAL MOTION - OLLAMA BRIDGE START
echo ==================================================
echo.

where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo [GAGAL] Windows PowerShell tidak ditemukan.
  pause
  exit /b 1
)

where curl.exe >nul 2>nul
if errorlevel 1 (
  echo [GAGAL] curl.exe tidak ditemukan. Gunakan Windows 10/11 terbaru.
  pause
  exit /b 1
)

set "BRIDGE_URL=https://raw.githubusercontent.com/irzalbudiman2-cell/trozal-motion-web-prores/main/TROZAL_OLLAMA_BRIDGE.ps1"
set "BRIDGE_FILE=%~dp0TROZAL_OLLAMA_BRIDGE.ps1"
set "BRIDGE_TEMP=%~dp0TROZAL_OLLAMA_BRIDGE.ps1.download"

echo [1/3] Mengunduh konektor Ollama terbaru...
curl.exe --fail --location --silent --show-error --retry 3 --retry-delay 2 "%BRIDGE_URL%" --output "%BRIDGE_TEMP%"
if errorlevel 1 (
  echo.
  echo [GAGAL] Tidak dapat mengunduh konektor terbaru dari GitHub.
  del "%BRIDGE_TEMP%" >nul 2>nul
  echo Periksa koneksi internet, lalu jalankan file ini kembali.
  pause
  exit /b 1
)

for %%A in ("%BRIDGE_TEMP%") do set "BRIDGE_SIZE=%%~zA"
if not defined BRIDGE_SIZE (
  echo [GAGAL] File konektor kosong.
  del "%BRIDGE_TEMP%" >nul 2>nul
  pause
  exit /b 1
)
if "%BRIDGE_SIZE%"=="0" (
  echo [GAGAL] File konektor kosong.
  del "%BRIDGE_TEMP%" >nul 2>nul
  pause
  exit /b 1
)

move /y "%BRIDGE_TEMP%" "%BRIDGE_FILE%" >nul
if errorlevel 1 (
  echo [GAGAL] Tidak dapat memperbarui file konektor.
  pause
  exit /b 1
)

echo [2/3] Memeriksa layanan Ollama...
powershell.exe -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 4 'http://127.0.0.1:11434/api/tags'; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 (
  echo [PERINGATAN] Ollama belum merespons pada 127.0.0.1:11434.
  echo Pastikan aplikasi Ollama sudah dibuka. Bridge tetap akan dicoba dijalankan.
) else (
  echo Ollama terdeteksi.
)

echo.
echo [3/3] Menjalankan TROZAL Ollama Bridge...
echo Jangan tutup jendela PowerShell ini selama TROZAL digunakan.
echo Browser akan dibuka pada http://127.0.0.1:11435/
echo Tekan Ctrl+C pada jendela Bridge untuk berhenti.
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%BRIDGE_FILE%"
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
  echo [PERINGATAN] Bridge berhenti dengan kode %EXIT_CODE%.
  echo Periksa pesan error di atas.
)
pause
exit /b %EXIT_CODE%
