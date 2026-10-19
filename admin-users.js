(()=>{
 'use strict';
 if(typeof supabaseClient==='undefined'||!supabaseClient)return;
 const byId=id=>document.getElementById(id);
 const roles={owner:'Владелец',admin:'Администратор',helper:'Помощник',client:'Клиент'};
 const canSee=()=>!!currentUser&&voxiStaffUserId===currentUser.id&&['owner','admin'].includes(voxiStaffRole);
 const node=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
 const button=(text,handler,className='secondary')=>{const b=node('button',text,className);b.type='button';b.addEventListener('click',handler);return b;};
 let directoryMode='users';
 const entry=button('Пользователи',()=>{directoryMode='users';open();},'nav-btn hidden');entry.id='usersEntry';
 const clientsEntry=button('Клиенты',()=>{directoryMode='clients';open();},'nav-btn hidden');clientsEntry.id='clientsEntry';
 document.querySelector('header nav')?.insertBefore(clientsEntry,byId('loginButton'));
 document.querySelector('header nav')?.insertBefore(entry,byId('loginButton'));
 const panel=node('section',undefined,'panel hidden voxi-users');panel.id='usersPanel';
 panel.append(node('h2','Пользователи VOXi'),node('p','Поиск по имени, фамилии, телефону, email или ID. Аккаунты без анкеты тоже отображаются.','notice'));
 const searchForm=node('form',undefined,'voxi-users-search'),search=node('input');search.type='search';search.maxLength=120;search.placeholder='Имя, телефон или ID';search.setAttribute('aria-label','Найти пользователя');
 const find=node('button','Найти','primary');find.type='submit';searchForm.append(search,find);panel.append(searchForm);
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
 async function open(){if(!canSee())return;await openVOXiSection('admin');if(!canSee())return;panel.querySelector('h2').textContent=directoryMode==='clients'?'Клиенты · готовые песни':'Пользователи · доступ и роли';window.voxiAdminShow?.(directoryMode);panel.classList.remove('hidden');panel.scrollIntoView({behavior:'smooth',block:'start'});await load(1);}
 searchForm.addEventListener('submit',e=>{e.preventDefault();if(!mutating)load(1);});
 window.voxiOpenClients=async query=>{directoryMode='clients';search.value=query||'';await open();search.focus();};
 async function load(newPage){
  if(!canSee()||mutating)return;
  const id=currentUser.id,request=++version;page=Math.max(1,newPage);message.textContent='Загружаю пользователей…';list.replaceChildren();prev.disabled=next.disabled=true;find.disabled=true;
  try{
   const {data,error}=await supabaseClient.rpc('voxi_admin_users',{p_search:search.value.trim(),p_page:page});if(error)throw error;
   if(request!==version||currentUser?.id!==id||!canSee())return;
   total=Number(data.total)||0;canManage=data.canManage===true;message.textContent=total?'Найдено: '+total:'Пользователи не найдены.';
   for(const user of data.users)render(user);
   counter.textContent=page+' / '+Math.max(1,Math.ceil(total/30));prev.disabled=page<=1;next.disabled=page*30>=total;
  }catch(error){if(request===version){message.textContent='Не удалось загрузить список. Нажмите «Найти», чтобы повторить: '+(error.message||'Ошибка сервера');counter.textContent='';}}
  finally{if(request===version)find.disabled=false;}
 }
 function render(user){
  const row=button('',()=>details(user),'voxi-client-row');row.append(node('strong',user.full_name||'Анкета не заполнена'),node('span',user.phone||'Телефон не указан'));
  if(directoryMode==='users')row.append(node('small',roles[user.role]||'Клиент'));list.append(row);
 }
 async function details(user){
  if(mutating||!canSee())return;dialog.querySelectorAll('audio').forEach(a=>a.pause());dialog.replaceChildren();const actor=currentUser.id;
  const card=node('article',undefined,'voxi-user-detail');dialog.append(card);
  card.append(node('h3',user.full_name||'Анкета ещё не заполнена'));
  for(const [label,value] of [['Телефон',user.phone||'Не указан'],['Email',user.email||'Не указан'],['ID',user.user_id],['Роль',roles[user.role]||'Клиент']]){const p=node('p');p.append(node('strong',label+': '),node(label==='ID'?'code':'span',value));card.append(p);}
  card.append(button('Загрузить песню',()=>uploadTrack(user),'primary'),button('Закрыть',()=>dialog.close()));
  const songs=node('div');card.append(node('h3','Песни клиента'),songs);dialog.showModal();songs.textContent='Загружаю песни…';
  void loadTracks(user,songs,actor);
  if(canManage&&user.role!=='owner'){
   const actions=node('div',undefined,'voxi-user-actions'),select=node('select');select.setAttribute('aria-label','Новая роль для '+(user.full_name||user.email));
   for(const role of ['client','helper','admin']){const o=node('option',roles[role]);o.value=role;select.append(o);}select.value=user.role;
   actions.append(select,button('Применить роль',()=>{if(select.value!==user.role)confirmAction(user,'set_role',select.value);}),button('Удалить аккаунт',()=>confirmAction(user,'delete_user'),'danger'));card.append(actions);
  }else if(user.role==='owner')card.append(node('p','Аккаунт владельца защищён.','muted'));
 }
 async function loadTracks(user,box,actor){
  try{const {data,error}=await supabaseClient.from('voxi_tracks').select('*').eq('user_id',user.user_id).order('created_at',{ascending:false});if(error)throw error;if(currentUser?.id!==actor||!canSee()||!box.isConnected)return;box.replaceChildren();if(!data.length){box.textContent='Готовые песни ещё не загружены.';return;}
   for(const track of data){const card=node('article',undefined,'voxi-track-row');card.append(node('strong',track.song_title),node('small',new Date(track.created_at).toLocaleDateString('ru-RU')+' · '+Math.ceil(track.file_size/1024/1024)+' МБ'));
    card.append(node('small',track.file_name));
    if(!track.deleted_at)card.append(button('Прослушать',async e=>{const b=e.currentTarget;b.disabled=true;try{const {data,error}=await supabaseClient.storage.from('voxi-tracks').createSignedUrl(track.storage_path,900);if(error)throw error;if(currentUser?.id!==actor||!card.isConnected)return;dialog.querySelectorAll('audio').forEach(a=>a.pause());const audio=node('audio');audio.controls=true;audio.preload='metadata';audio.src=data.signedUrl;audio.style.width='100%';card.insertBefore(audio,b);b.remove();}catch(e){if(card.isConnected)card.append(node('p','Не удалось открыть песню: '+e.message));b.disabled=false;}}));
    const date=node('input');date.type='datetime-local';date.setAttribute('aria-label','Хранить до');if(track.expires_at){const d=new Date(track.expires_at);date.value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
    const label=node('label','Хранить до (пусто — без срока)');label.append(date);card.append(label);const result=node('p');result.setAttribute('role','status');
    const save=button('Сохранить срок',async()=>{if(mutating||currentUser?.id!==actor)return;mutating=true;save.disabled=true;try{const {error}=await supabaseClient.rpc('voxi_track_retention',{p_track:track.id,p_user:user.user_id,p_expires:date.value?new Date(date.value).toISOString():null});if(error)throw error;result.textContent='Срок хранения сохранён.';}catch(e){result.textContent=e.message;}finally{mutating=false;save.disabled=false;}});
    const remove=button(track.deleted_at?'Повторить удаление':'Удалить песню',async()=>{if(mutating||currentUser?.id!==actor)return;if(!confirm('Удалить песню «'+track.song_title+'» из кабинета '+(user.full_name||user.email)+'? Файл будет удалён безвозвратно.'))return;mutating=true;remove.disabled=true;try{const {data:{session},error}=await supabaseClient.auth.getSession();if(error||session?.user.id!==actor)throw Error('Войдите заново');const r=await fetch(SUPABASE_URL+'/functions/v1/voxi-track-manager',{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_KEY,Authorization:'Bearer '+session.access_token},body:JSON.stringify({action:'delete',trackId:track.id,userId:user.user_id,confirmTrackId:track.id})});const body=await r.json();if(!r.ok)throw Error(body.error);if(currentUser?.id===actor)await loadTracks(user,box,actor);}catch(e){result.textContent=e.message;}finally{mutating=false;remove.disabled=false;}},'danger');
    if(track.deleted_at){date.disabled=save.disabled=true;card.append(node('p','Удаление начато. Очистка повторится автоматически.'));}card.append(save,remove,result);box.append(card);
   }
  }catch(e){if(currentUser?.id===actor)box.textContent='Не удалось загрузить песни: '+e.message;}
 }
 function confirmAction(user,action,role){
  if(mutating||!canSee()||!canManage)return;
  pending={user,action,role,actor:currentUser.id};dialog.replaceChildren();
  const form=node('form');dialog.append(form);
  form.append(node('h2',action==='delete_user'?'Удалить аккаунт?':'Изменить роль?'),node('p',(user.full_name||user.email)+' · '+user.user_id));
  if(action==='delete_user')form.append(node('p','Будут удалены учётная запись, анкета, связанные заявки и сообщения чата. Действие необратимо. Для подтверждения введите УДАЛИТЬ.'));
  else form.append(node('p',role==='admin'?'Администратор увидит клиентов, сможет вести заявки, расписание и медиатеку. Удаление аккаунтов и назначение ролей останутся у владельца.':role==='helper'?'Помощник сможет просматривать и изменять заявки и расписание. Список пользователей, управление аккаунтами и медиатека ему недоступны.':'Права сотрудника будут сняты. Пользователь останется обычным клиентом.'));
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
    const response=await fetch(SUPABASE_URL+'/functions/v1/voxi-admin-users',{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_KEY,Authorization:'Bearer '+session.access_token},body:JSON.stringify({action:selected.action,userId:selected.user.user_id,confirmUserId:selected.user.user_id,role:selected.role})});
    const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error||'Ошибка сервера');
    if(currentUser?.id!==selected.actor)return;pending=null;dialog.close();mutating=false;await load(page);message.textContent=action==='delete_user'?'Аккаунт удалён.':'Роль сохранена.';
   }catch(error){if(currentUser?.id===selected.actor)result.textContent=error.message||'Ошибка. Обновите список перед повтором.';}
   finally{mutating=false;submit.disabled=cancel.disabled=false;}
  });
  dialog.showModal();(action==='delete_user'?confirm:cancel).focus();
 }
 function uploadTrack(user){
  if(mutating||!canSee())return;pending=null;dialog.replaceChildren();
  const actor=currentUser.id,form=node('form');dialog.append(form);
  form.append(node('h2','Загрузить готовую песню'),node('p','Получатель: '+(user.full_name||user.email)+' · '+user.user_id),node('p','Песня появится только в личном кабинете выбранного клиента. До 50 МБ: MP3, WAV, M4A, OGG, FLAC.'));
  const titleLabel=node('label','Название песни'),title=node('input');title.required=true;title.maxLength=200;titleLabel.append(title);
  const fileLabel=node('label','Аудиофайл'),file=node('input');file.type='file';file.required=true;file.accept='.mp3,.wav,.m4a,.ogg,.flac';fileLabel.append(file);
  const expiryLabel=node('label','Срок хранения'),expiry=node('select');for(const [v,t] of [['','Без ограничения'],['30','30 дней'],['90','90 дней'],['180','180 дней'],['365','1 год']]){const o=node('option',t);o.value=v;expiry.append(o);}expiryLabel.append(expiry);
  file.addEventListener('change',()=>{if(!title.value&&file.files[0])title.value=file.files[0].name.replace(/\.[^.]+$/,'').slice(0,200);});
  const status=node('p');status.setAttribute('role','status');
  const submit=node('button','Загрузить в кабинет','primary');submit.type='submit';const cancel=button('Назад к клиенту',()=>{if(!mutating)details(user);});form.append(titleLabel,fileLabel,expiryLabel,node('p','После окончания срока файл автоматически удаляется. Уже скачанную клиентом копию удалить с его устройства нельзя.','notice'),status,submit,cancel);
  form.addEventListener('submit',async e=>{
   e.preventDefault();if(mutating||!canSee()||currentUser.id!==actor)return;
   const selected=file.files[0];if(!selected)return;
   mutating=true;submit.disabled=cancel.disabled=true;status.textContent='Загружаю песню. Не закрывайте страницу…';
   try{
    await voxiUploadPrivateTrack({client:supabaseClient,userId:user.user_id,file:selected,title:title.value,expiresAt:expiry.value?new Date(Date.now()+Number(expiry.value)*86400000).toISOString():null,actorStillCurrent:()=>currentUser?.id===actor&&canSee()});
    if(currentUser?.id!==actor)return;status.textContent='Песня добавлена в кабинет выбранного клиента.';submit.remove();expiry.disabled=file.disabled=title.disabled=true;cancel.textContent='Готово · к песням клиента';
   }catch(error){if(currentUser?.id===actor)status.textContent=error.message||'Не удалось загрузить песню.';}
   finally{mutating=false;submit.disabled=cancel.disabled=false;}
  });dialog.showModal();title.focus();
 }
 window.addEventListener('beforeunload',e=>{if(mutating){e.preventDefault();e.returnValue='';}});
 dialog.addEventListener('cancel',e=>{if(mutating)e.preventDefault();else pending=null;});
 dialog.addEventListener('close',()=>dialog.querySelectorAll('audio').forEach(a=>a.pause()));
})();
