@echo off
title TROZAL LOCAL VISION Setup
echo ============================================
echo   TROZAL MOTION - LOCAL AI VISION SETUP
echo ============================================
echo.
where ollama >nul 2>nul
if errorlevel 1 (
  echo Ollama belum ditemukan.
  echo Silakan install dari: https://ollama.com/download/windows
  echo Setelah install, jalankan file ini kembali.
  pause
  exit /b 1
)
echo Mengatur izin koneksi browser TROZAL MOTION...
setx OLLAMA_ORIGINS "https://irzalbudiman2-cell.github.io"
if errorlevel 1 (
  echo Gagal menyimpan OLLAMA_ORIGINS.
  pause
  exit /b 1
)
echo.
echo Mengunduh model Qwen3-VL 2B (sekitar 1.9 GB)...
ollama pull qwen3-vl:2b
if errorlevel 1 (
  echo.
  echo Pengunduhan model gagal. Pastikan Ollama aktif dan coba ulangi.
  pause
  exit /b 1
)
echo.
echo ============================================
echo SETUP MODEL SELESAI.
echo.
echo PENTING:
echo 1. Klik kanan ikon Ollama di system tray lalu Quit.
echo 2. Jalankan kembali Ollama dari Start Menu.
echo 3. Buka TROZAL MOTION lalu klik "Cek Ollama".
echo ============================================
pause
