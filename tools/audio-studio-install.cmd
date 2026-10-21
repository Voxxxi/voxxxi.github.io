@echo off
chcp 65001 >nul
cd /d "%~dp0"
py -3.12 --version >nul 2>&1
if errorlevel 1 (
 echo Для установки нужен Python 3.12 с официального сайта https://www.python.org/downloads/
 echo После установки Python запустите этот файл снова.
 pause
 exit /b 1
)
if not exist ".venv\Scripts\python.exe" py -3.12 -m venv .venv
if errorlevel 1 exit /b 1
".venv\Scripts\python.exe" -m pip install -r audio-helper-requirements.txt --extra-index-url https://download.pytorch.org/whl/cu128
if errorlevel 1 (
 echo Установка не завершилась. Проверьте интернет и повторите.
 pause
 exit /b 1
)
".venv\Scripts\python.exe" -c "from demucs.pretrained import get_model;get_model('htdemucs')"
if errorlevel 1 exit /b 1
".venv\Scripts\python.exe" -c "import pathlib,shutil,imageio_ffmpeg;from audio_separator.separator import Separator;p=pathlib.Path('audio-models');p.mkdir(exist_ok=True);Separator(model_file_dir=str(p),info_only=True).download_model_and_data('UVR_MDXNET_KARA_2.onnx')"
if errorlevel 1 exit /b 1
".venv\Scripts\python.exe" audio-launch.py
echo Готово. Откройте VOXi: Админка — Аудиомастерская — Проверить подключение.
pause
