"""Launch the loopback helper using this installation's Python and FFmpeg."""
import pathlib,subprocess,sys,urllib.request,urllib.error
import imageio_ffmpeg
root=pathlib.Path(__file__).resolve().parent
try:
 urllib.request.urlopen('http://127.0.0.1:8766/health',timeout=2)
except urllib.error.HTTPError as e:
 if e.headers.get('Server','').startswith('VOXiAudio/'):sys.exit(0)
except OSError:pass
log=root/'helper.log';errors=root/'helper-errors.log'
with log.open('ab') as out,errors.open('ab') as err:
 subprocess.Popen([sys.executable,str(root/'audio-helper.py'),'--ffmpeg',imageio_ffmpeg.get_ffmpeg_exe(),'--data',str(root/'audio-jobs')],stdout=out,stderr=err,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
