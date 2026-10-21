"""Launch the loopback helper using this installation's Python and FFmpeg."""
import pathlib,subprocess,sys
import imageio_ffmpeg
root=pathlib.Path(__file__).resolve().parent
log=root/'helper.log';errors=root/'helper-errors.log'
with log.open('ab') as out,errors.open('ab') as err:
 subprocess.Popen([sys.executable,str(root/'audio-helper.py'),'--ffmpeg',imageio_ffmpeg.get_ffmpeg_exe(),'--data',str(root/'audio-jobs')],stdout=out,stderr=err,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
