@echo off
title TROZAL Ollama Bridge
cd /d "%~dp0"
where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo Windows PowerShell tidak ditemukan.
  pause
  exit /b 1
)
echo Memulai konektor lokal TROZAL ke Ollama...
echo Pastikan aplikasi Ollama sudah berjalan.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0TROZAL_OLLAMA_BRIDGE.ps1"
pause