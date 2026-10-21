@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
 echo First run audio-studio-install.cmd
 pause
 exit /b 1
)
".venv\Scripts\python.exe" audio-launch.py
