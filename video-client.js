const VOXI_VIDEO_API='https://vnykpjarjvacwhxvkxrk.supabase.co/functions/v1/voxi-videos';
const VOXI_VIDEO_KEY='sb_publishable_Jv-1ip1CSRKe2_cCjcGjmA_B333H-oC';
const VOXI_VIDEO_SITEKEY='0x4AAAAAAFbj7sDv5bHnb1fh';
async function voxiVideoRequest(client,action,body={}){
 const headers={'Content-Type':'application/json',apikey:VOXI_VIDEO_KEY};
 if(client&&action!=='feed'){
  const {data,error}=await client.auth.getSession();if(error)throw error;
  if(!data.session)throw Error('Войдите через Google на главной странице.');
  headers.Authorization='Bearer '+data.session.access_token;
 }
 const response=await fetch(VOXI_VIDEO_API,{method:'POST',headers,body:JSON.stringify({action,...body})});
 let data;try{data=await response.json()}catch{throw Error('Не удалось получить ответ сервера. Попробуйте позже.');}
 if(!response.ok)throw Error(data.error||'Не удалось выполнить действие.');return data;
}
let voxiTurnstileLoading=null;
function voxiLoadTurnstile(){
 if(window.turnstile)return Promise.resolve();
 if(!voxiTurnstileLoading)voxiTurnstileLoading=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
  script.onload=()=>window.turnstile?resolve():reject(Error('Проверка не загрузилась.'));script.onerror=()=>{script.remove();reject(Error('Не удалось загрузить проверку. Проверьте соединение.'));};document.head.appendChild(script);
 }).catch(error=>{voxiTurnstileLoading=null;throw error;});
 return voxiTurnstileLoading;
}
async function voxiVideoFileInfo(file){
 if(!file||file.size<24||file.size>50*1024*1024)throw Error('Выберите видео до 50 МБ.');
 const extension=file.name.split('.').pop().toLowerCase();if(!['mp4','mov'].includes(extension))throw Error('Поддерживаются MP4 и MOV.');
 const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
 if(String.fromCharCode(...bytes.slice(4,8))!=='ftyp')throw Error('Файл не похож на обычное видео MP4/MOV.');
 const objectURL=URL.createObjectURL(file),probe=document.createElement('video');probe.preload='metadata';probe.muted=true;probe.playsInline=true;
 try{
  const duration=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Не удалось прочитать видео. Попробуйте другой файл.')),15000);
   probe.onloadedmetadata=()=>{clearTimeout(timer);resolve(probe.duration);};probe.onerror=()=>{clearTimeout(timer);reject(Error('Браузер не смог прочитать это видео. Попробуйте сохранить его в MP4.'));};probe.src=objectURL;
  });
  if(!Number.isFinite(duration)||duration<=0||duration>300)throw Error('Видео должно быть не длиннее 5 минут.');
  return {mime:extension==='mov'?'video/quicktime':'video/mp4'};
 }finally{probe.removeAttribute('src');probe.load();URL.revokeObjectURL(objectURL);}
}
window.voxiLoadClientVideos=async function({client,userId,box,make,ru,isCurrent,refresh}){
 const label=(r,k)=>ru?r:k;
 const button=(text,fn)=>{const b=make('button',text,'cabinetExit');b.type='button';b.addEventListener('click',fn);return b;};
 const statuses={uploading:label('Загрузка не завершена','Жүктеу аяқталмаған'),pending:label('На проверке','Тексерілуде'),approved:label('Опубликовано','Жарияланды'),rejected:label('Отклонено','Қабылданбады'),error:label('Файл не прошёл проверку','Файл тексеруден өтпеді')};
 box.appendChild(make('p',label('Загружаем ваши видео…','Бейнелеріңіз жүктелуде…')));
 try{
  const data=await voxiVideoRequest(client,'my');if(!isCurrent())return;box.replaceChildren();
  box.appendChild(make('p',label('Ваши праздничные видео могут увидеть все посетители VOXi после проверки модератором.','Мерекелік бейнелеріңізді модератор тексергеннен кейін VOXi қонақтары көре алады.')));
  box.appendChild(button(label('Загрузить видео','Бейне жүктеу'),uploadForm));
  if(!data.videos.length)box.appendChild(make('p',label('Вы ещё не загружали видео.','Әзірге бейне жүктелмеген.')));
  for(const video of data.videos){
   const card=make('article','','cabinet-record');card.appendChild(make('strong',video.title));card.appendChild(make('p',statuses[video.status]||video.status));
   if(video.reason)card.appendChild(make('p',label('Причина: ','Себебі: ')+video.reason));
   if(video.previewUrl){const player=document.createElement('video');player.controls=true;player.playsInline=true;player.preload='none';player.src=video.previewUrl;player.className='voxi-private-video';card.appendChild(player);}
   if(video.status==='uploading'){
    const state=make('p','');card.appendChild(button(label('Проверить загрузку','Жүктеуді тексеру'),async()=>{try{state.textContent=label('Проверяем файл…','Файл тексерілуде…');await voxiVideoRequest(client,'complete',{videoId:video.id});if(isCurrent())refresh();}catch(error){if(isCurrent())state.textContent=error.message;}}));card.appendChild(state);
   }
   box.appendChild(card);
  }
  box.appendChild(button(label('Обновить список','Тізімді жаңарту'),refresh));
 }catch(error){if(isCurrent()){box.replaceChildren();box.appendChild(make('p',error.message));box.appendChild(button(label('Попробовать снова','Қайта көру'),refresh));}}

 async function uploadForm(){
  if(!isCurrent())return;box.replaceChildren();
  const form=make('form','','voxi-video-upload');box.appendChild(form);
  form.appendChild(make('h3',label('Видео с вашего праздника','Мерекеңізден бейне')));
  form.appendChild(make('p',label('MP4 или MOV, до 50 МБ и 5 минут. Сначала видео видите только вы и модератор.','MP4 немесе MOV, 50 МБ және 5 минутқа дейін. Алдымен бейнені тек сіз және модератор көресіз.')));
  const titleLabel=make('label',label('Название видео','Бейне атауы')),title=document.createElement('input');title.required=true;title.maxLength=120;titleLabel.appendChild(title);
  const descriptionLabel=make('label',label('Описание (необязательно)','Сипаттама (міндетті емес)')),description=document.createElement('textarea');description.maxLength=600;description.rows=3;descriptionLabel.appendChild(description);
  const fileLabel=make('label',label('Видео с телефона','Телефоннан бейне')),file=document.createElement('input');file.type='file';file.required=true;file.accept='.mp4,.mov,video/mp4,video/quicktime';fileLabel.appendChild(file);
  const consentLabel=make('label','','voxi-video-consent'),consent=document.createElement('input');consent.type='checkbox';consent.required=true;consentLabel.appendChild(consent);consentLabel.appendChild(make('span',label('Разрешаю опубликовать это видео в общей ленте VOXi.','Бұл бейнені VOXi ортақ таспасында жариялауға рұқсат етемін.')));
  const challenge=document.createElement('div'),status=make('p','');status.setAttribute('role','status');
  const submit=make('button',label('Отправить на проверку','Тексеруге жіберу'),'cabinetExit');submit.type='submit';submit.disabled=true;
  const cancel=button(label('Назад','Артқа'),()=>{if(!busy){dispose();refresh();}}),retry=button(label('Обновить проверку','Тексеруді жаңарту'),()=>{if(!busy&&widget!==null)window.turnstile.reset(widget);});
  form.append(titleLabel,descriptionLabel,fileLabel,consentLabel,challenge,status,submit,retry,cancel);
  let token=null,widget=null,busy=false,disposed=false;const requestId=crypto.randomUUID();
  const current=()=>!disposed&&isCurrent();
  const unload=e=>{if(busy){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',unload);
  function dispose(){disposed=true;token=null;if(widget!==null&&window.turnstile)window.turnstile.remove(widget);window.removeEventListener('beforeunload',unload);}
  box.addEventListener('voxi-cabinet-dispose',dispose,{once:true});
  file.addEventListener('change',()=>{if(!title.value&&file.files[0])title.value=file.files[0].name.replace(/\.[^.]+$/,'').slice(0,120);});
  try{
   await voxiLoadTurnstile();if(!current())return;
   widget=window.turnstile.render(challenge,{sitekey:VOXI_VIDEO_SITEKEY,action:'video_upload',theme:'dark',size:'flexible',
    callback:value=>{token=value;if(current()&&!busy)submit.disabled=false;},
    'expired-callback':()=>{token=null;if(current())submit.disabled=true;},
    'error-callback':()=>{token=null;if(current()){submit.disabled=true;status.textContent=label('Проверка не завершена. Нажмите «Обновить проверку».','Тексеру аяқталмады. Тексеруді жаңартыңыз.');}}});
  }catch(error){if(current())status.textContent=error.message;}
  form.addEventListener('submit',async e=>{
   e.preventDefault();if(busy||!current()||!token)return;
   const selected=file.files[0];if(!selected)return;
   const values={title:title.value.trim(),description:description.value.trim(),consent:consent.checked};
   busy=true;submit.disabled=cancel.disabled=retry.disabled=true;title.disabled=description.disabled=file.disabled=consent.disabled=true;
   try{
    status.textContent=label('Проверяем файл…','Файл тексерілуде…');const info=await voxiVideoFileInfo(selected);if(!current())return;
    const ticket=await voxiVideoRequest(client,'begin',{requestId,...values,fileName:selected.name,size:selected.size,captcha:token});if(!current())return;
    status.textContent=label('Загружаем видео. Не закрывайте страницу…','Бейне жүктелуде. Бетті жаппаңыз…');
    const uploaded=await client.storage.from('voxi-videos').uploadToSignedUrl(ticket.path,ticket.token,selected.slice(0,selected.size,info.mime),{contentType:info.mime,cacheControl:'0'});
    if(uploaded.error&&String(uploaded.error.statusCode)!=='409')throw uploaded.error;if(!current())return;
    status.textContent=label('Файл загружен. Проверяем его перед отправкой модератору…','Файл жүктелді. Модераторға жібермес бұрын тексерілуде…');
    await voxiVideoRequest(client,'complete',{videoId:ticket.videoId});if(!current())return;
    busy=false;dispose();refresh();
   }catch(error){if(current())status.textContent=error.message||label('Не удалось загрузить видео.','Бейне жүктелмеді.');token=null;if(widget!==null&&window.turnstile&&current())window.turnstile.reset(widget);}
   finally{busy=false;if(current()){title.disabled=description.disabled=file.disabled=consent.disabled=false;cancel.disabled=retry.disabled=false;submit.disabled=!token;}}
  });
 }
};
