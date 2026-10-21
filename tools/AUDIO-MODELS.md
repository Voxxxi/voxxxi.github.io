# Локальные модели VOXi

- Demucs htdemucs: https://github.com/facebookresearch/demucs (MIT), Meta / Alexandre Défossez и авторы Demucs.
- MDX Karaoke: UVR_MDXNET_KARA_2.onnx, модель из официального каталога UVR через audio-separator: https://github.com/Anjok07/ultimatevocalremovergui и https://github.com/nomadkaraoke/python-audio-separator (MIT). Благодарность UVR, Anjok07, aufr33 и разработчикам MDX-Net. Архитектуры и веса не изменены.
- MP3: отдельный неизменённый lamejs 1.2.1 (LGPL-3.0), лицензия и ссылка на исходники в vendor/lame-*.
- Тональность/темп: Signalsmith Stretch, лицензия в vendor/SignalsmithStretch-LICENSE.txt.
- FFmpeg: установленный пакет imageio-ffmpeg, источник https://ffmpeg.org/; сборка сохраняет свой вывод лицензирования. Исполняемый файл и модели не включены в GitHub Pages.

Звук обрабатывается локально. Для проверки действующей сессии сотрудника помощник обращается к Supabase; аудиофайл туда не отправляется. Скачивание модели требует интернета один раз. Дневной квоты на обработку нет. Ограничение одного файла: 80 МБ, 15 минут; одновременно одна песня. Результаты в audio-jobs-v2 сохраняются на диске; автоматическое удаление архива не добавлено. После перезапуска помощника список заданий в памяти сбрасывается: скачайте нужное до перезапуска. Папка результата при этом остаётся на компьютере.
