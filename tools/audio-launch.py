"""Launch the loopback helper using this installation's Python and FFmpeg."""
import pathlib,subprocess,sys,urllib.request,urllib.error,shutil
import imageio_ffmpeg
root=pathlib.Path(__file__).resolve().parent
try:
 urllib.request.urlopen('http://127.0.0.1:8767/health',timeout=2)
except urllib.error.HTTPError as e:
 if e.headers.get('Server','').startswith('VOXiAudio/'):sys.exit(0)
except OSError:pass
bin_dir=root/'audio-bin';bin_dir.mkdir(exist_ok=True)
ffmpeg=bin_dir/'ffmpeg.exe'
if not ffmpeg.exists():shutil.copy2(imageio_ffmpeg.get_ffmpeg_exe(),ffmpeg)
log=root/'helper.log';errors=root/'helper-errors.log'
with log.open('ab') as out,errors.open('ab') as err:
 subprocess.Popen([sys.executable,str(root/'audio-helper.py'),'--ffmpeg',str(ffmpeg),'--data',str(root/'audio-jobs-v2')],stdout=out,stderr=err,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
