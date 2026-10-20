(()=>{
 const t=(r,k)=>document.documentElement.lang==='kk'?k:r;
 async function bounded(query){let timer;try{return await Promise.race([query,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('timeout')),15000))]);}finally{clearTimeout(timer);}}
 window.voxiWhatsAppReadyLink=({phone,title='',kk=false})=>{
  let digits=String(phone||'').replace(/\D/g,'');if(digits.length===10)digits='7'+digits;if(digits.length===11&&digits[0]==='8')digits='7'+digits.slice(1);
  if(!/^[1-9]\d{9,14}$/.test(digits))return null;
  const song=String(title).trim().slice(0,200),message=kk?'Сәлеметсіз бе! VOXi студиясында'+(song?' «'+song+'»':'')+' әніңіз дайын. Жеке кабинетіңізден тыңдап, жүктеп алыңыз: https://voxxxi.github.io/cabinet.html?tab=songs':'Здравствуйте! Ваша песня'+(song?' «'+song+'»':'')+' готова в студии VOXi. Послушать и скачать можно в личном кабинете: https://voxxxi.github.io/cabinet.html?tab=songs';
  return 'https://wa.me/'+digits+'?text='+encodeURIComponent(message);
 };
 window.voxiCreateReadyBell=({client,host,open})=>{
  const link=document.createElement('a');link.href='./cabinet.html?tab=notifications';link.className='pill nav-btn voxi-ready-bell';link.hidden=true;
  link.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>';
  const count=document.createElement('span');link.append(count);host?.append(link);let actor=null,generation=0,unread=0;
  function label(){count.textContent=unread?String(Math.min(unread,99))+(unread>99?'+':''):'';link.setAttribute('aria-label',t('Уведомления','Хабарламалар')+(unread?' · '+unread:''));link.title=t('Уведомления','Хабарламалар');link.classList.toggle('has-unread',unread>0);}
  link.addEventListener('click',e=>{if(open){e.preventDefault();open();}});
  async function refresh(){if(!actor||document.hidden)return;const selected=actor,request=++generation;try{const {data,error}=await bounded(client.rpc('voxi_ready_notifications'));if(request!==generation||actor!==selected)return;if(error)throw error;unread=Number(data.unread_count)||0;link.hidden=false;label();}catch{if(request===generation&&actor===selected){unread=0;label();link.hidden=false;link.title=t('Уведомления: обновите список в кабинете','Хабарламалар: кабинеттегі тізімді жаңартыңыз');}}}
  const api={setUser(id){if(actor!==id){generation++;actor=id||null;unread=0;link.hidden=!actor;label();}if(actor)void refresh();},refresh};
  for(const id of ['ru','kk'])document.getElementById(id)?.addEventListener('click',label);
  setInterval(()=>{if(actor)void refresh();},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
  return api;
 };
 window.voxiLoadReadyNotifications=async({client,box,make,ru,isCurrent,refresh,onSongs,onRead})=>{
  box.append(make('p',ru?'Проверяем готовые песни…':'Дайын әндер тексерілуде…'));
  try{
   const {data,error}=await bounded(client.rpc('voxi_ready_notifications'));if(!isCurrent())return;if(error)throw error;box.replaceChildren();
   if(!data.items.length)box.append(make('p',ru?'Уведомлений о готовых песнях пока нет.':'Дайын әндер туралы хабарлама әзірге жоқ.'));
   for(const item of data.items){
    const card=make('article','','cabinet-record');card.append(make('strong',(item.read_at?'':ru?'Новое · ':'Жаңа · ')+(ru?'Песня готова':'Ән дайын')),make('p',item.song_title),make('small',new Date(item.created_at).toLocaleString(ru?'ru-RU':'kk-KZ',{timeZone:'Asia/Oral'})));
    if(item.expires_at)card.append(make('p',(ru?'Скачайте до: ':'Мына күнге дейін жүктеңіз: ')+new Date(item.expires_at).toLocaleDateString(ru?'ru-RU':'kk-KZ',{timeZone:'Asia/Oral'})));
    const action=make('button',ru?'Слушать и скачать':'Тыңдау және жүктеу','cabinetExit');action.type='button';action.addEventListener('click',async()=>{if(!isCurrent())return;action.disabled=true;try{const {error}=await bounded(client.rpc('voxi_read_ready_notification',{p_track:item.track_id}));if(!isCurrent())return;if(error)throw error;onRead?.();onSongs();}catch{if(isCurrent()){card.append(make('p',ru?'Не удалось обновить уведомление. Песня доступна в разделе «Мои песни».':'Хабарламаны жаңарту мүмкін болмады. Ән «Менің әндерім» бөлімінде қолжетімді.'));action.disabled=false;}}});card.append(action);
    if(!item.read_at){const read=make('button',ru?'Прочитано':'Оқылды','cabinetExit');read.type='button';read.addEventListener('click',async()=>{if(!isCurrent())return;read.disabled=true;try{const {error}=await bounded(client.rpc('voxi_read_ready_notification',{p_track:item.track_id}));if(!isCurrent())return;if(error)throw error;onRead?.();refresh();}catch{if(isCurrent()){read.disabled=false;card.append(make('p',ru?'Не удалось отметить. Повторите попытку.':'Белгілеу мүмкін болмады. Қайта көріңіз.'));}}});card.append(read);}
    box.append(card);
   }
   box.append(make('small',ru?'Показаны последние 50 уведомлений о доступных песнях. Внешние push-уведомления не подключены.':'Қолжетімді әндер туралы соңғы 50 хабарлама көрсетілген. Сыртқы push-хабарламалар қосылмаған.'));
  }catch{if(isCurrent()){box.replaceChildren();box.append(make('p',ru?'Не удалось загрузить уведомления. Обновите список.':'Хабарламалар жүктелмеді. Тізімді жаңартыңыз.'));}}
  if(isCurrent()){const retry=make('button',ru?'Обновить уведомления':'Хабарламаларды жаңарту','cabinetExit');retry.type='button';retry.addEventListener('click',refresh);box.append(retry);}
 };
 if(typeof supabaseClient!=='undefined'&&supabaseClient){const bell=window.voxiCreateReadyBell({client:supabaseClient,host:document.querySelector('header nav')});const signed=setSignedIn;setSignedIn=function(user){signed(user);bell.setUser(user?.id);};bell.setUser(currentUser?.id);}
})();
