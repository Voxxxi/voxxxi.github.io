"""Loopback-only audio worker. Every data request checks a fresh VOXi staff session."""
import argparse,base64,concurrent.futures,json,pathlib,re,subprocess,sys,threading,time,uuid,urllib.request,urllib.error
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer

SUPABASE='https://vnykpjarjvacwhxvkxrk.supabase.co'
PUBLIC_KEY='sb_publishable_Jv-1ip1CSRKe2_cCjcGjmA_B333H-oC'
ALLOWED_ORIGINS={'https://voxxxi.github.io','http://127.0.0.1:8766'}
MAX_BYTES=80*1024*1024

def staff_identity(token):
    if not token or len(token)>8192:raise PermissionError('Требуется вход в админку VOXi.')
    req=urllib.request.Request(SUPABASE+'/rest/v1/rpc/voxi_staff_session',data=b'{}',headers={'apikey':PUBLIC_KEY,'Authorization':'Bearer '+token,'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=15) as response:role=json.load(response)
        if role not in ('owner','admin','helper'):raise PermissionError('Доступ только сотрудникам VOXi.')
        payload=json.loads(base64.urlsafe_b64decode(token.split('.')[1]+'==='))
        return str(uuid.UUID(payload['sub']))
    except PermissionError:raise
    except Exception:raise PermissionError('Сессия недействительна. Войдите в VOXi заново.')

class Helper(ThreadingHTTPServer):
    daemon_threads=True
    def __init__(self,address,root,ffmpeg):
        super().__init__(address,Handler);self.root=pathlib.Path(root).resolve();self.root.mkdir(parents=True,exist_ok=True);self.ffmpeg=ffmpeg;self.jobs={};self.lock=threading.Lock();self.pool=concurrent.futures.ThreadPoolExecutor(max_workers=1)
    def run_job(self,job):
        with self.lock:job.update(state='running',message='Отделяю голос от музыки. Это может занять несколько минут…')
        try:
            with open(job['folder']/'processing.log','wb') as log:
                subprocess.run([sys.executable,str(pathlib.Path(__file__).with_name('audio-process.py')),str(job['folder']/'source.audio'),str(job['folder']),'--ffmpeg',self.ffmpeg],stdout=log,stderr=log,check=True,timeout=3600,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
            with self.lock:job.update(state='done',message='Готово')
        except Exception:
            with self.lock:job.update(state='error',error='Не удалось создать минусовку. Проверьте формат файла и журнал помощника.')
        finally:job['folder'].joinpath('source.audio').unlink(missing_ok=True)

class Handler(BaseHTTPRequestHandler):
    server_version='VOXiAudio/1.0'
    def log_message(self,*args):pass  # Never log access tokens, file names, or client data.
    def origin_allowed(self):return self.headers.get('Origin') in ALLOWED_ORIGINS
    def cors(self):
        if self.origin_allowed():
            self.send_header('Access-Control-Allow-Origin',self.headers['Origin']);self.send_header('Vary','Origin');self.send_header('Access-Control-Allow-Methods','GET, POST, OPTIONS');self.send_header('Access-Control-Allow-Headers','Authorization, Content-Type, X-Audio-Name');self.send_header('Access-Control-Allow-Private-Network','true')
    def reply(self,code,data):
        body=json.dumps(data,ensure_ascii=False).encode();self.send_response(code);self.cors();self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
    def do_OPTIONS(self):
        print('CORS preflight received',flush=True)
        if not self.origin_allowed():return self.reply(403,{'error':'Origin denied'})
        self.send_response(204);self.cors();self.send_header('Access-Control-Max-Age','600');self.end_headers()
    def actor(self):
        same_origin_bridge=not self.headers.get('Origin') and self.headers.get('X-VOXi-Bridge')=='1' and self.headers.get('Sec-Fetch-Site')=='same-origin'
        if not self.origin_allowed() and not same_origin_bridge:raise PermissionError('Origin denied')
        header=self.headers.get('Authorization','')
        return staff_identity(header[7:] if header.startswith('Bearer ') else '')
    def do_GET(self):
        if self.path=='/bridge':
            body=pathlib.Path(__file__).with_name('audio-bridge.html').read_bytes();self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.send_header('Content-Security-Policy',"frame-ancestors https://voxxxi.github.io");self.end_headers();self.wfile.write(body);return
        try:actor=self.actor()
        except PermissionError as e:return self.reply(403,{'error':str(e)})
        if self.path=='/health':
            return self.reply(200,{'ok':True,'device':self.server.device,'version':1})
        match=re.fullmatch(r'/jobs/([0-9a-f-]{36})(?:/(instrumental|vocals))?',self.path)
        if not match:return self.reply(404,{'error':'Not found'})
        with self.server.lock:job=self.server.jobs.get(match[1]);job=dict(job) if job else None
        if not job or job['actor']!=actor:return self.reply(404,{'error':'Задание не найдено. Если помощник перезапускался, создайте минусовку заново.'})
        if not match[2]:return self.reply(200,{k:v for k,v in job.items() if k in ('id','state','message','error')})
        if job['state']!='done':return self.reply(409,{'error':'Результат ещё не готов'})
        path=job['folder']/(match[2]+'.wav');self.send_response(200);self.cors();self.send_header('Content-Type','audio/wav');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(path.stat().st_size));self.end_headers()
        with path.open('rb') as f:
            while chunk:=f.read(1024*1024):self.wfile.write(chunk)
    def do_POST(self):
        try:actor=self.actor()
        except PermissionError as e:return self.reply(403,{'error':str(e)})
        if self.path!='/jobs':return self.reply(404,{'error':'Not found'})
        try:length=int(self.headers.get('Content-Length','0'))
        except ValueError:return self.reply(400,{'error':'Invalid length'})
        if length<1 or length>MAX_BYTES:return self.reply(413,{'error':'Нужен аудиофайл до 80 МБ.'})
        with self.server.lock:
            if any(j['state'] in ('uploading','queued','running') for j in self.server.jobs.values()):return self.reply(409,{'error':'Другая песня уже обрабатывается. Дождитесь завершения.'})
            # Bound retained results; remove only this application's UUID job directories.
            old=[key for key,j in self.server.jobs.items() if time.time()-j['created']>86400]
            for key in old:
                j=self.server.jobs.pop(key)
                for name in ('source.audio','decoded.wav','instrumental.wav','vocals.wav','processing.log'):j['folder'].joinpath(name).unlink(missing_ok=True)
                try:j['folder'].rmdir()
                except OSError:pass
            if len(self.server.jobs)>=20:return self.reply(429,{'error':'Сохранено 20 результатов. Перезапустите помощник после сохранения нужных файлов.'})
            id=str(uuid.uuid4());folder=self.server.root/id;folder.mkdir();job={'id':id,'folder':folder,'actor':actor,'state':'uploading','created':time.time()};self.server.jobs[id]=job
        try:
            self.connection.settimeout(120)
            with (folder/'source.audio').open('wb') as f:
                remaining=length
                while remaining:
                    chunk=self.rfile.read(min(1024*1024,remaining))
                    if not chunk:raise ValueError('Incomplete upload')
                    f.write(chunk);remaining-=len(chunk)
            with self.server.lock:job.update(state='queued',message='Песня принята. Запускаю Demucs…')
            self.server.pool.submit(self.server.run_job,job);self.reply(202,{'id':id})
        except Exception:
            with self.server.lock:job.update(state='error',error='Загрузка прервалась.')
            folder.joinpath('source.audio').unlink(missing_ok=True);self.reply(400,{'error':'Загрузка прервалась. Попробуйте снова.'})

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--ffmpeg',required=True);p.add_argument('--data',default=str(pathlib.Path(__file__).parent/'audio-jobs'));p.add_argument('--port',type=int,default=8766);args=p.parse_args()
    import torch
    server=Helper(('127.0.0.1',args.port),args.data,args.ffmpeg);server.device=torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU';print('VOXi audio helper ready on loopback; '+server.device,flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:server.shutdown()
