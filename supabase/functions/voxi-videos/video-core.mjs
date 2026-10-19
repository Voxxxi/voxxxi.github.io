export const VIDEO_LIMIT=50*1024*1024;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function inspectVideo(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<24||bytes.length>VIDEO_LIMIT)throw Error('Неверный размер видео.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const text=(at,n)=>String.fromCharCode(...bytes.subarray(at,at+n));
 function boxes(start,end){const found=[];let at=start;while(at<end){
  if(end-at<8)throw Error('Повреждённый контейнер видео.');
  let size=view.getUint32(at),header=8;
  if(size===1){if(end-at<16)throw Error('Повреждённое видео.');size=Number(view.getBigUint64(at+8));header=16;}
  if(size===0)size=end-at;
  if(!Number.isSafeInteger(size)||size<header||size>end-at)throw Error('Повреждённый контейнер видео.');
  found.push({type:text(at+4,4),start:at+header,end:at+size});at+=size;
 }return found;}
 const top=boxes(0,bytes.length),moov=top.find(b=>b.type==='moov');
 if(!top.some(b=>b.type==='ftyp')||!top.some(b=>b.type==='mdat'&&b.end>b.start)||!moov)throw Error('Поддерживаются обычные видео MP4 и MOV.');
 const movie=boxes(moov.start,moov.end),header=movie.find(b=>b.type==='mvhd');
 const hasVideo=movie.filter(b=>b.type==='trak').some(track=>boxes(track.start,track.end).filter(b=>b.type==='mdia').some(media=>boxes(media.start,media.end).some(b=>b.type==='hdlr'&&b.end-b.start>=12&&text(b.start+8,4)==='vide')));
 if(!hasVideo||!header)throw Error('В файле не найдена видеодорожка.');
 const version=bytes[header.start];let scale,duration;
 if(version===0&&header.end-header.start>=20){scale=view.getUint32(header.start+12);duration=view.getUint32(header.start+16);}
 else if(version===1&&header.end-header.start>=32){scale=view.getUint32(header.start+20);duration=Number(view.getBigUint64(header.start+24));}
 else throw Error('Не удалось прочитать длительность видео.');
 const seconds=duration/scale;
 if(!Number.isFinite(seconds)||seconds<=0||seconds>300)throw Error('Видео должно быть не длиннее 5 минут.');
 return {duration:seconds};
}
export function createVideoHandler(api){
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin',
  'Access-Control-Allow-Origin':'https://voxxxi.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
 return async request=>{
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
  if(request.headers.get('Origin')&&request.headers.get('Origin')!=='https://voxxxi.github.io')return reply(403,{error:'Недопустимый источник запроса.'});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply(405,{error:'Используйте POST.'});
  try{
   if(Number(request.headers.get('Content-Length')||0)>8192)return reply(413,{error:'Слишком большой запрос.'});
   const raw=await request.text();if(raw.length>8192)return reply(413,{error:'Слишком большой запрос.'});
   let body;try{body=JSON.parse(raw)}catch{return reply(400,{error:'Неверный запрос.'})}
   if(!body||typeof body!=='object')return reply(400,{error:'Неверный запрос.'});
   if(body.action==='feed')return reply(200,{videos:await api.feed()});
   const token=request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
   const user=token?await api.user(token):null;
   if(!user||!await api.sessionActive(token))return reply(401,{error:'Войдите в аккаунт заново.'});
   if(body.action==='my')return reply(200,{videos:await api.mine(user.id)});
   if(body.action==='queue'){
    if(!['owner','admin','helper'].includes(await api.staffRole(token)))return reply(403,{error:'Доступно только модератору.'});
    return reply(200,{videos:await api.queue(body.showAll===true)});
   }
   if(body.action==='begin'){
    const title=typeof body.title==='string'?body.title.trim():'',description=typeof body.description==='string'?body.description.trim():'';
    const name=typeof body.fileName==='string'?body.fileName:'',extension=name.split('.').pop()?.toLowerCase();
    if(!uuid.test(body.requestId||'')||!title||title.length>120||description.length>600||!name||name.length>255||!['mp4','mov'].includes(extension)||!Number.isInteger(body.size)||body.size<24||body.size>VIDEO_LIMIT||body.consent!==true)return reply(400,{error:'Укажите название, согласие на публикацию и видео MP4/MOV до 50 МБ.'});
    const previous=await api.previous(user.id,body.requestId);
    if(previous){
     if(previous.status!=='uploading'||Date.parse(previous.upload_expires_at)<=api.now()||previous.file_size!==body.size||previous.file_name!==name||previous.title!==title||String(previous.description||'')!==description)return reply(409,{error:'Эта загрузка уже завершена или истекла. Обновите список видео.'});
     return reply(200,await api.uploadTicket(previous));
    }
    if(typeof body.captcha!=='string'||body.captcha.length<1||body.captcha.length>2048)return reply(400,{error:'Пройдите проверку перед загрузкой.'});
    const verified=await api.verifyCaptcha(body.captcha);
    if(verified?.success!==true||verified.hostname!=='voxxxi.github.io'||verified.action!=='video_upload')return reply(403,{error:'Проверка не пройдена или истекла. Пройдите её заново.'});
    const profile=await api.profile(user.id);
    if(!profile||String(profile.full_name||'').trim().split(/\s+/).length<2||!/^\+[1-9]\d{9,14}$/.test(profile.phone||'')){
     if(!['owner','admin','helper'].includes(await api.staffRole(token)))return reply(422,{error:'Сначала заполните имя, фамилию и телефон в профиле.'});
    }
    const displayName=String(profile?.full_name||'Студия VOXi').trim().split(/\s+/)[0].slice(0,80);
    const video=await api.reserve({p_user:user.id,p_request:body.requestId,p_title:title,p_description:description,p_name:displayName,p_filename:name,p_size:body.size,p_mime:extension==='mov'?'video/quicktime':'video/mp4',p_extension:extension});
    return reply(200,await api.uploadTicket(video));
   }
   if(body.action==='complete'){
    if(!uuid.test(body.videoId||''))return reply(400,{error:'Неверный ID видео.'});
    const video=await api.owned(user.id,body.videoId);if(!video)return reply(404,{error:'Видео не найдено.'});
    if(['pending','approved','rejected'].includes(video.status))return reply(200,{ok:true,status:video.status});
    if(video.status!=='uploading'||Date.parse(video.upload_expires_at)<=api.now())return reply(409,{error:'Срок загрузки истёк. Обратитесь к администратору.'});
    const file=await api.file(video);
    if(!file)return reply(409,{error:'Файл ещё не загружен. Дождитесь окончания передачи и повторите проверку.'});
    let checked;
    try{
     if(file.size!==video.file_size||file.size!==file.bytes.length||file.mime!==video.mime_type)throw Error('Параметры загруженного файла не совпадают с заявленными.');
     checked=inspectVideo(file.bytes);
    }catch(error){await api.invalidate(video);return reply(422,{error:error.message||'Неверный файл видео.'});}
    const status=await api.complete(user.id,video.id,checked.duration);
    return reply(200,{ok:true,status});
   }
   return reply(400,{error:'Неизвестное действие.'});
  }catch(error){
   // Only our short, deliberately user-facing quota messages are passed through.
   const message=String(error?.message||'');
   const quota=message.startsWith('В сутки можно')||message.startsWith('У вас уже 3 видео');
   return reply(quota?429:503,{error:quota?message:'Сервис временно недоступен. Попробуйте снова. Видео не публикуется при ошибке проверки.'});
  }
 };
}
