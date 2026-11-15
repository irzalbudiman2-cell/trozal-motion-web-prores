@echo off
setlocal
set "TASK_NAME=TROZAL MOTION Ollama Bridge"
set "INSTALL_DIR=%LOCALAPPDATA%\TROZAL MOTION\Ollama Bridge"
schtasks.exe /End /TN "%TASK_NAME%" >nul 2>nul
schtasks.exe /Delete /TN "%TASK_NAME%" /F
if exist "%INSTALL_DIR%" rmdir /s /q "%INSTALL_DIR%"
echo Auto-start TROZAL MOTION Ollama Bridge telah dihapus.
pause
