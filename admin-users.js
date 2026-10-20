(()=>{
 'use strict';
 if(typeof supabaseClient==='undefined'||!supabaseClient)return;
 const byId=id=>document.getElementById(id);
 const roles={owner:'Владелец',admin:'Администратор',helper:'Помощник',client:'Клиент'};
 const canSee=()=>!!currentUser&&voxiStaffUserId===currentUser.id&&['owner','admin'].includes(voxiStaffRole);
 const node=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
 const button=(text,handler,className='secondary')=>{const b=node('button',text,className);b.type='button';b.addEventListener('click',handler);return b;};
 let directoryMode='users';
 const filterDefinitions=[['all','Все'],['complete','Анкета заполнена'],['incomplete','Без анкеты'],['staff','Сотрудники'],['suspended','Приостановлен доступ']];
 let directoryFilter=new URLSearchParams(location.search).get('filter')||'all';if(!filterDefinitions.some(([key])=>key===directoryFilter))directoryFilter='all';
 const entry=button('Пользователи',()=>{directoryMode='users';open();},'nav-btn hidden');entry.id='usersEntry';
 const clientsEntry=button('Клиенты',()=>{directoryMode='clients';open();},'nav-btn hidden');clientsEntry.id='clientsEntry';
 document.querySelector('header nav')?.insertBefore(clientsEntry,byId('loginButton'));
 document.querySelector('header nav')?.insertBefore(entry,byId('loginButton'));
 const panel=node('section',undefined,'panel hidden voxi-users');panel.id='usersPanel';
 panel.append(node('h2','Пользователи VOXi'),node('p','Поиск по имени, фамилии, телефону, email или ID. Аккаунты без анкеты тоже отображаются.','notice'));
 const searchForm=node('form',undefined,'voxi-users-search'),search=node('input');search.type='search';search.maxLength=120;search.placeholder='Имя, телефон или ID';search.setAttribute('aria-label','Найти пользователя');
 const find=node('button','Найти','primary');find.type='submit';searchForm.append(search,find);panel.append(searchForm);
 const reset=button('Сбросить',()=>{search.value='';directoryFilter='all';void load(1);});searchForm.append(reset);
 const filters=node('nav',undefined,'voxi-directory-filters');filters.setAttribute('aria-label','Фильтры клиентов');const filterButtons=new Map();
 for(const [key,label] of filterDefinitions){const b=button(label,()=>{directoryFilter=key;void load(1);});filterButtons.set(key,b);filters.append(b);}panel.append(filters);
 const message=node('p','','notice');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
 const list=node('div',undefined,'voxi-users-list'),pager=node('div',undefined,'voxi-users-pager');
 const prev=button('Назад',()=>load(page-1)),next=button('Далее',()=>load(page+1)),counter=node('span');pager.append(prev,counter,next);panel.append(message,list,pager);
 byId('backupPanel').before(panel);
 const dialog=node('dialog',undefined,'voxi-user-dialog');document.body.append(dialog);
 let page=1,total=0,canManage=false,version=0,pending=null,mutating=false;
 const signedIn=setSignedIn;
 setSignedIn=function(user){signedIn(user);entry.classList.toggle('hidden',!canSee());clientsEntry.classList.toggle('hidden',!canSee());if(!canSee()){version++;list.replaceChildren();panel.classList.add('hidden');dialog.close();pending=null;}};
 entry.classList.toggle('hidden',!canSee());
 clientsEntry.classList.toggle('hidden',!canSee());
 async function open(){if(!canSee())return;await openVOXiSection('admin');if(!canSee())return;panel.querySelector('h2').textContent='Клиенты';panel.querySelector('.notice').textContent='Все аккаунты в одном списке. Выберите фильтр или найдите человека по имени, телефону или ID. Нажмите строку, чтобы открыть песни и историю.';window.voxiAdminShow?.('clients');panel.classList.remove('hidden');panel.scrollIntoView({behavior:'smooth',block:'start'});await load(1);}
 searchForm.addEventListener('submit',e=>{e.preventDefault();if(!mutating)load(1);});
 window.voxiOpenClients=async query=>{directoryMode='clients';search.value=query||'';await open();search.focus();};
 async function load(newPage){
  if(!canSee()||mutating)return;
  const id=currentUser.id,request=++version;page=Math.max(1,newPage);message.textContent='Загружаю пользователей…';list.replaceChildren();prev.disabled=next.disabled=true;find.disabled=true;
  for(const [key,b]of filterButtons){b.classList.toggle('active',key===directoryFilter);b.setAttribute('aria-pressed',String(key===directoryFilter));}
  try{
   const {data,error}=await supabaseClient.rpc('voxi_admin_directory',{p_search:search.value.trim(),p_page:page,p_filter:directoryFilter});if(error)throw error;
   if(request!==version||currentUser?.id!==id||!canSee())return;
   total=Number(data.total)||0;canManage=data.canManage===true;message.textContent=total?'Найдено: '+total:'Пользователи не найдены.';
   for(const [key,label]of filterDefinitions)filterButtons.get(key).textContent=label+' · '+Number(data.counts?.[key]||0);
   for(const user of data.users)render(user);
   counter.textContent=page+' / '+Math.max(1,Math.ceil(total/30));prev.disabled=page<=1;next.disabled=page*30>=total;
  }catch(error){if(request===version){message.textContent='Не удалось загрузить список. Нажмите «Найти», чтобы повторить: '+(error.message||'Ошибка сервера');counter.textContent='';}}
  finally{if(request===version)find.disabled=false;}
 }
 function render(user){
  const row=button('',()=>details(user),'voxi-client-row');row.append(node('strong',user.full_name||user.email||'Анкета не заполнена'),node('span',user.phone||'ID: '+user.user_id.slice(0,8)));list.append(row);
 }
 async function details(user){
  if(mutating||!canSee())return;dialog.querySelectorAll('audio').forEach(a=>a.pause());dialog.replaceChildren();const actor=currentUser.id;
  const card=node('article',undefined,'voxi-user-detail');dialog.append(card);
  card.append(node('h3',user.full_name||'Анкета ещё не заполнена'));
  for(const [label,value] of [['Телефон',user.phone||'Не указан'],['Email',user.email||'Не указан'],['ID',user.user_id],['Роль',roles[user.role]||'Клиент']]){const p=node('p');p.append(node('strong',label+': '),node(label==='ID'?'code':'span',value));card.append(p);}
  const copyStatus=node('p','','notice');copyStatus.setAttribute('role','status');for(const [label,value]of [['Скопировать телефон',user.phone],['Скопировать ID',user.user_id]])if(value)card.append(button(label,async()=>{try{await navigator.clipboard.writeText(value);copyStatus.textContent='Скопировано.';}catch{copyStatus.textContent='Не удалось скопировать автоматически. Выделите значение в карточке.';}}));card.append(copyStatus);
  card.append(button('Загрузить песню',()=>uploadTrack(user),'primary'),button('Закрыть',()=>dialog.close()));
  const blocked=user.banned_until&&Date.parse(user.banned_until)>Date.now();card.append(node('p',blocked?'Доступ приостановлен':'Доступ активен','notice'));
  const history=node('div');history.hidden=true;card.append(button('История записей',async()=>{history.hidden=!history.hidden;if(!history.hidden)await loadHistory(user,history,actor);}),history);
  const songs=node('div');card.append(node('h3','Песни клиента'),songs);dialog.showModal();songs.textContent='Загружаю песни…';
  void loadTracks(user,songs,actor);
  if(canManage&&user.role!=='owner'){
   const actions=node('div',undefined,'voxi-user-actions'),select=node('select');select.setAttribute('aria-label','Новая роль для '+(user.full_name||user.email));
   for(const role of ['client','helper','admin']){const o=node('option',roles[role]);o.value=role;select.append(o);}select.value=user.role;
   actions.append(select,button('Применить роль',()=>{if(select.value!==user.role)confirmAction(user,'set_role',select.value);}),button(blocked?'Возобновить доступ':'Приостановить доступ',()=>confirmAction(user,'set_ban',!blocked)),button('Удалить аккаунт',()=>confirmAction(user,'delete_user'),'danger'));card.append(actions);
  }else if(user.role==='owner')card.append(node('p','Аккаунт владельца защищён.','muted'));
 }
 async function loadHistory(user,box,actor){
  box.textContent='Загружаю историю записей…';try{const {data,error}=await supabaseClient.from('voxi_bookings').select('id,booking_date,booking_time,song_titles,people_count,song_count,status,price').eq('user_id',user.user_id).order('booking_date',{ascending:false}).order('booking_time',{ascending:false}).limit(100);if(error)throw error;if(currentUser?.id!==actor||!box.isConnected||!canSee())return;box.replaceChildren();if(!data.length){box.textContent='Записей этого клиента пока нет.';return;}
   for(const record of data){const item=node('article',undefined,'voxi-track-row');item.append(node('strong',String(record.booking_date).split('-').reverse().join('.')+' · '+String(record.booking_time).slice(0,5)),node('p','Статус: '+record.status+' · Всего исполнителей: '+record.people_count));let songs;try{songs=JSON.parse(record.song_titles);}catch{songs=null;}
    if(Array.isArray(songs)){for(const song of songs)item.append(node('p',String(song?.title||'Без названия')+' · Исполнителей: '+String(song?.people||song?.people_count||'—')));}else item.append(node('p',record.song_titles||'Название не указано'));box.append(item);
   }if(data.length===100)box.append(node('small','Показаны последние 100 записей.'));
  }catch(e){if(currentUser?.id===actor&&box.isConnected)box.textContent='Не удалось загрузить историю: '+e.message;}
 }
 async function loadTracks(user,box,actor){
  box.querySelectorAll('audio').forEach(a=>a.pause());
  try{const {data,error}=await supabaseClient.from('voxi_tracks').select('*').eq('user_id',user.user_id).order('created_at',{ascending:false});if(error)throw error;if(currentUser?.id!==actor||!canSee()||!box.isConnected)return;box.replaceChildren();if(!data.length){box.textContent='Готовые песни ещё не загружены.';return;}
   for(const track of data){const card=node('article',undefined,'voxi-track-row');card.append(node('strong',track.song_title),node('small',new Date(track.created_at).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})+' · '+Math.ceil(track.file_size/1024/1024)+' МБ'));
    card.append(node('small',track.file_name));if(track.booking_id)card.append(node('small','Заявка №'+track.booking_id+' · Песня №'+(track.booking_song_number||'—')));
    if(!track.deleted_at)card.append(button('Прослушать',async e=>{const b=e.currentTarget;b.disabled=true;try{const {data,error}=await window.voxiTrackUrl(supabaseClient,track).then(data=>({data,error:null}));if(error)throw error;if(currentUser?.id!==actor||!card.isConnected)return;dialog.querySelectorAll('audio').forEach(a=>a.pause());const audio=node('audio');audio.controls=true;audio.preload='metadata';audio.src=data.signedUrl;audio.style.width='100%';card.insertBefore(audio,b);b.remove();}catch(e){if(card.isConnected)card.append(node('p','Не удалось открыть песню: '+e.message));b.disabled=false;}}));
    const date=node('input');date.type='date';date.setAttribute('aria-label','Хранить до');if(track.expires_at)date.value=window.voxiRetention.localDay(track.expires_at);
    const preset=node('select');preset.setAttribute('aria-label','Срок хранения песни');for(const [value,title] of [...window.voxiRetention.options,['custom','Выбрать дату']]){const option=node('option',title);option.value=value;preset.append(option);}preset.value=track.expires_at?'custom':'';
    const label=node('label','Срок хранения');label.append(preset);card.append(label);
    const custom=node('div',undefined,'voxi-retention-custom');custom.hidden=preset.value!=='custom';custom.append(date);card.append(custom);window.voxiEnhanceDate(date,'Открыть календарь срока хранения');
    const preview=node('p',track.expires_at?'Сейчас доступно до '+new Date(track.expires_at).toLocaleDateString('ru-RU'):'Сейчас хранится без ограничения.','voxi-retention-preview');card.append(preview);const result=node('p');result.setAttribute('role','status');
    const selectedExpiry=()=>window.voxiRetention.until(preset.value,new Date(),date.value);
    const updateExpiry=()=>{custom.hidden=preset.value!=='custom';try{const value=selectedExpiry();preview.textContent=value?'Будет доступно до '+new Date(value).toLocaleDateString('ru-RU')+' включительно. Нажмите «Сохранить срок».':'Без ограничения. Нажмите «Сохранить срок».';}catch(e){preview.textContent=e.message;}};preset.addEventListener('change',updateExpiry);date.addEventListener('change',updateExpiry);
    const save=button('Сохранить срок',async()=>{if(mutating||currentUser?.id!==actor)return;mutating=true;save.disabled=true;try{const value=selectedExpiry();const {error}=await supabaseClient.rpc('voxi_track_retention',{p_track:track.id,p_user:user.user_id,p_expires:value});if(error)throw error;track.expires_at=value;preview.textContent=value?'Доступно до '+new Date(value).toLocaleDateString('ru-RU')+' включительно.':'Хранится без ограничения.';result.textContent='Срок хранения сохранён.';}catch(e){result.textContent=e.message;}finally{mutating=false;save.disabled=false;}});
    const remove=button(track.deleted_at?'Повторить удаление':'Удалить эту песню',async()=>{if(mutating||currentUser?.id!==actor)return;if(!confirm('Удалить только эту песню: «'+track.song_title+'» ('+track.file_name+', загружена '+new Date(track.created_at).toLocaleString('ru-RU')+') из кабинета '+(user.full_name||user.email)+'? Файл будет удалён безвозвратно.'))return;mutating=true;remove.disabled=true;try{const {data:{session},error}=await supabaseClient.auth.getSession();if(error||session?.user.id!==actor)throw Error('Войдите заново');const r=await fetch(SUPABASE_URL+'/functions/v1/voxi-track-manager',{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_KEY,Authorization:'Bearer '+session.access_token},body:JSON.stringify({action:'delete',trackId:track.id,userId:user.user_id,confirmTrackId:track.id})});const body=await r.json();if(!r.ok)throw Error(body.error);if(currentUser?.id===actor)await loadTracks(user,box,actor);}catch(e){result.textContent=e.message;}finally{mutating=false;remove.disabled=false;}},'danger');
    remove.setAttribute('aria-label','Удалить песню '+track.song_title);
    if(track.deleted_at){preset.disabled=date.disabled=save.disabled=true;card.append(node('p','Удаление начато. Очистка повторится автоматически.'));}card.append(save,remove,result);box.append(card);
   }
  }catch(e){if(currentUser?.id===actor)box.textContent='Не удалось загрузить песни: '+e.message;}
 }
 function confirmAction(user,action,role){
  if(mutating||!canSee()||!canManage)return;
  dialog.querySelectorAll('audio').forEach(a=>a.pause());
  pending={user,action,role,actor:currentUser.id};dialog.replaceChildren();
  const form=node('form');dialog.append(form);
  form.append(node('h2',action==='delete_user'?'Удалить аккаунт?':action==='set_ban'?(role?'Приостановить доступ?':'Возобновить доступ?'):'Изменить роль?'),node('p',(user.full_name||user.email)+' · '+user.user_id));
  if(action==='delete_user')form.append(node('p','Будут удалены учётная запись, анкета, связанные заявки и сообщения чата. Учёт полученных оплат сохранится в разделе «Доходы». Действие необратимо. Для подтверждения введите УДАЛИТЬ.'));
  else if(action==='set_ban')form.append(node('p',role?'Вход и доступ к данным кабинета будут приостановлены. Анкета, записи и песни сохранятся. Доступ можно будет возобновить.':'Клиент снова сможет входить в свой кабинет.'));
  else form.append(node('p',role==='admin'?'Администратор увидит клиентов, сможет вести заявки, расписание и медиатеку. Удаление аккаунтов и назначение ролей останутся у владельца.':role==='helper'?'Помощник сможет вести заявки и расписание, проверять видео и модерировать чат. Каталог клиентов, управление аккаунтами и песни ему недоступны.':'Права сотрудника будут сняты. Пользователь останется обычным клиентом.'));
  const confirm=node('input');confirm.setAttribute('aria-label','Подтверждение удаления');confirm.autocomplete='off';
  if(action==='delete_user'){confirm.required=true;confirm.pattern='УДАЛИТЬ';confirm.placeholder='УДАЛИТЬ';form.append(confirm);}
  const result=node('p');result.setAttribute('role','alert');form.append(result);
  const submit=node('button',action==='delete_user'?'Удалить навсегда':'Подтвердить',action==='delete_user'?'danger':'primary');submit.type='submit';
  const cancel=button('Отмена',()=>{if(!mutating){pending=null;dialog.close();}});form.append(submit,cancel);
  form.addEventListener('submit',async e=>{
   e.preventDefault();if(mutating||!pending||currentUser?.id!==pending.actor||!canSee())return;
   if(action==='delete_user'&&confirm.value!=='УДАЛИТЬ')return;
   const selected=pending;mutating=true;submit.disabled=cancel.disabled=true;result.textContent='Выполняю…';
   try{
    const {data:{session},error}=await supabaseClient.auth.getSession();if(error||!session||session.user.id!==selected.actor)throw Error('Войдите в аккаунт владельца заново.');
    const response=await fetch(SUPABASE_URL+'/functions/v1/voxi-admin-users',{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_KEY,Authorization:'Bearer '+session.access_token},body:JSON.stringify({action:selected.action,userId:selected.user.user_id,confirmUserId:selected.user.user_id,role:selected.action==='set_role'?selected.role:undefined,banned:selected.action==='set_ban'?selected.role:undefined})});
    const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error||'Ошибка сервера');
    if(currentUser?.id!==selected.actor)return;pending=null;dialog.close();mutating=false;await load(page);message.textContent=action==='delete_user'?'Аккаунт удалён.':action==='set_ban'?(selected.role?'Доступ приостановлен.':'Доступ возобновлён.'):'Роль сохранена.';
   }catch(error){if(currentUser?.id===selected.actor)result.textContent=error.message||'Ошибка. Обновите список перед повтором.';}
   finally{mutating=false;submit.disabled=cancel.disabled=false;}
  });
  dialog.showModal();(action==='delete_user'?confirm:cancel).focus();
 }
 function uploadTrack(user){
  if(mutating||!canSee())return;pending=null;dialog.querySelectorAll('audio').forEach(a=>a.pause());dialog.replaceChildren();
  const actor=currentUser.id,form=node('form');dialog.append(form);
  form.append(node('h2','Загрузить готовую песню'),node('p','Получатель: '+(user.full_name||user.email)+' · '+user.user_id),node('p','Песня появится только в личном кабинете выбранного клиента. До 50 МБ: MP3, WAV, M4A, OGG, FLAC.'));
  const titleLabel=node('label','Название песни'),title=node('input');title.required=true;title.maxLength=200;titleLabel.append(title);
  const fileLabel=node('label','Аудиофайл'),file=node('input');file.type='file';file.required=true;file.accept='.mp3,.wav,.m4a,.ogg,.flac';fileLabel.append(file);
  const expiryLabel=node('label','Срок хранения'),expiry=node('select');for(const [v,t] of window.voxiRetention.options){const o=node('option',t);o.value=v;expiry.append(o);}expiryLabel.append(expiry);
  const orderLabel=node('label','Заявка для этой песни'),order=node('select');order.required=true;order.disabled=true;order.setAttribute('aria-label','Заявка для песни');order.append(node('option','Загружаем заявки…'));orderLabel.append(order);
  const orderInfo=node('p','Доход считается по сумме заявки после выдачи всех её песен.','notice');let orders=[];
  const slotLabel=node('label','Песня из заявки'),slot=node('select');slot.setAttribute('aria-label','Песня из заявки');slotLabel.append(slot);slotLabel.hidden=true;
  const explainOrder=()=>{const selected=orders.find(b=>String(b.id)===order.value);orderInfo.textContent=selected?(selected.accounted?'Эта заявка уже учтена. Исправленная версия не увеличит доход повторно.':'По заявке: '+selected.song_count+' песен · '+new Intl.NumberFormat('ru-RU').format(selected.price)+' ₸. Уже выдано: '+selected.uploaded_count+'. После последней песни заявка закроется и сумма войдёт в доход.'):'Песня появится в кабинете. Без связанной заявки сумма дохода не начисляется.';slotLabel.hidden=!selected;slot.required=!!selected;slot.disabled=!selected;slot.replaceChildren();if(selected){const details=typeof parseSongDetails==='function'?parseSongDetails(selected):[];const blank=node('option','Выберите песню');blank.value='';slot.append(blank);for(let i=1;i<=selected.song_count;i++){const done=(selected.delivered_song_numbers||[]).map(Number).includes(i);const o=node('option',i+'. '+(details[i-1]?.title||'Песня '+i)+(done?' — уже выдана':''));o.value=String(i);o.disabled=done;slot.append(o);}const missing=Array.from({length:selected.song_count},(_,i)=>i+1).find(n=>!(selected.delivered_song_numbers||[]).map(Number).includes(n));slot.value=missing?String(missing):'';submit.disabled=!missing;if(!missing)orderInfo.textContent+=' Для замены сначала удалите прежний файл из карточки клиента.';if(missing&&!title.value&&details[missing-1]?.title)title.value=details[missing-1].title;}else submit.disabled=false;};order.addEventListener('change',explainOrder);slot.addEventListener('change',()=>{const selected=orders.find(b=>String(b.id)===order.value);const details=selected&&typeof parseSongDetails==='function'?parseSongDetails(selected):[];if(details[Number(slot.value)-1]?.title)title.value=details[Number(slot.value)-1].title;});
  file.addEventListener('change',()=>{if(!title.value&&file.files[0])title.value=file.files[0].name.replace(/\.[^.]+$/,'').slice(0,200);});
  const status=node('p');status.setAttribute('role','status');
  const submit=node('button','Загрузить в кабинет','primary');submit.type='submit';submit.disabled=true;const cancel=button('Назад к клиенту',()=>{if(!mutating)details(user);});form.append(orderLabel,orderInfo,slotLabel,titleLabel,fileLabel,expiryLabel,node('p','После окончания срока файл автоматически удаляется. Уже скачанную клиентом копию удалить с его устройства нельзя.','notice'),status,submit,cancel);
  async function loadOrders(){submit.disabled=true;try{const {data,error}=await supabaseClient.rpc('voxi_client_delivery_orders',{p_user:user.user_id});if(error)throw error;if(currentUser?.id!==actor||!form.isConnected)return;orders=data||[];order.replaceChildren();const blank=node('option','Выберите заявку');blank.value='';order.append(blank);for(const b of orders){const option=node('option',String(b.booking_date).split('-').reverse().join('.')+' '+String(b.booking_time).slice(0,5)+' · '+b.song_count+' песен · '+new Intl.NumberFormat('ru-RU').format(b.price)+' ₸ · '+(b.accounted?'уже закрыта':'готово '+b.uploaded_count+'/'+b.song_count));option.value=String(b.id);order.append(option);}const separate=node('option','Отдельная песня без заявки — не считать доход');separate.value='none';order.append(separate);const open=orders.filter(b=>!b.accounted);order.value=open.length===1?String(open[0].id):open.length===0?'none':'';order.disabled=false;submit.disabled=false;status.textContent='';explainOrder();}catch(e){if(currentUser?.id===actor&&form.isConnected){status.textContent='Не удалось проверить заявки: '+e.message;const retry=button('Повторить проверку заявок',()=>{retry.remove();void loadOrders();});status.append(retry);}}}
  form.addEventListener('submit',async e=>{
   e.preventDefault();if(mutating||!canSee()||currentUser.id!==actor)return;
   const selected=file.files[0];if(!selected||order.disabled||!order.value||order.value!=='none'&&!slot.value)return;
   mutating=true;submit.disabled=cancel.disabled=true;status.textContent='Загружаю песню. Не закрывайте страницу…';
   try{
    const bookingId=order.value==='none'?null:Number(order.value);
    const delivery=await voxiUploadPrivateTrack({client:supabaseClient,userId:user.user_id,file:selected,title:title.value,bookingId,bookingSongNumber:bookingId?Number(slot.value):null,expiresAt:window.voxiRetention.until(expiry.value),actorStillCurrent:()=>currentUser?.id===actor&&canSee()});
    if(currentUser?.id!==actor)return;status.textContent=delivery.recovered?'Предыдущая загрузка подтверждена. Выбранный сейчас файл повторно не отправлялся.':'Песня добавлена в кабинет выбранного клиента.';submit.remove();slot.disabled=order.disabled=expiry.disabled=file.disabled=title.disabled=true;cancel.textContent='Готово · к песням клиента';if(bookingId&&!delivery.recovered){try{const {data,error}=await supabaseClient.rpc('voxi_client_delivery_orders',{p_user:user.user_id});if(error)throw error;if(currentUser?.id===actor&&form.isConnected){const saved=data?.find(b=>Number(b.id)===bookingId);status.textContent+=saved?.accounted?(orders.find(b=>Number(b.id)===bookingId)?.accounted?' Заявка уже была учтена: повторного начисления нет.':' Все песни выданы: заявка закрыта, её сумма автоматически учтена в доходах.'):saved?' По заявке выдано '+saved.uploaded_count+' из '+saved.song_count+' песен.':'';}}catch{if(currentUser?.id===actor&&form.isConnected)status.textContent+=' Обновите раздел «Доходы», чтобы проверить закрытие заявки.';}}
   }catch(error){if(currentUser?.id===actor)status.textContent=error.message||'Не удалось загрузить песню.';}
   finally{mutating=false;submit.disabled=cancel.disabled=false;}
  });dialog.showModal();title.focus();void loadOrders();
 }
 window.addEventListener('beforeunload',e=>{if(mutating){e.preventDefault();e.returnValue='';}});
 dialog.addEventListener('cancel',e=>{if(mutating)e.preventDefault();else pending=null;});
 dialog.addEventListener('close',()=>dialog.querySelectorAll('audio').forEach(a=>a.pause()));
})();
