(()=>{
 if(typeof supabaseClient==='undefined'||!supabaseClient)return;
 const by=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const staff=()=>!!currentUser&&isAdmin(),directory=()=>['owner','admin'].includes(voxiStaffRole);
 const app=by('app'),main=app,bookingSection=by('bookings').closest('section');bookingSection.id='adminBookingsSection';
 const workspace=el('section',undefined,'panel hidden voxi-admin-workspace');workspace.id='adminWorkspace';
 const head=el('div',undefined,'voxi-admin-heading');head.append(el('h2','Рабочий кабинет VOXi'),el('p','Записи, клиенты и готовые песни — всё под рукой.','notice'));
 const nav=el('nav',undefined,'voxi-admin-nav');nav.setAttribute('aria-label','Разделы администратора');
 const quick=el('form',undefined,'voxi-users-search'),quickInput=el('input'),quickSubmit=el('button','Найти клиента','secondary');quickInput.type='search';quickInput.placeholder='Имя или телефон клиента';quickInput.setAttribute('aria-label','Быстрый поиск клиента');quickSubmit.type='submit';quick.append(quickInput,quickSubmit);head.append(quick);quick.addEventListener('submit',e=>{e.preventDefault();if(directory())void window.voxiOpenClients?.(quickInput.value.trim());});
 const overview=el('div',undefined,'voxi-admin-overview');workspace.append(head,nav,overview);main.prepend(workspace);
 let current='home',generation=0;
 const targets={home:null,bookings:bookingSection,schedule:by('schedulePanel'),clients:by('usersPanel'),users:by('usersPanel'),videos:by('videoModerationPanel'),backup:by('backupPanel')};
 const buttons=new Map();
 for(const [key,label] of [['home','Обзор'],['bookings','Заявки'],['schedule','Моё расписание'],['clients','Клиенты'],['upload','Загрузить песню'],['users','Пользователи'],['videos','Видео на проверке'],['backup','Резервная копия']]){
  const b=el('button',label,'secondary');b.type='button';buttons.set(key,b);nav.append(b);b.addEventListener('click',()=>{
   if(['clients','upload','users'].includes(key)){by(key==='users'?'usersEntry':'clientsEntry')?.click();return;}if(key==='videos'){by('videoModerationEntry')?.click();return;}show(key);
  });
 }
 function show(key){
  if(!staff())return;if(['clients','users'].includes(key)&&!directory())key='home';current=key;quick.hidden=!directory();
  for(const section of new Set(Object.values(targets).filter(Boolean))){section.classList.toggle('voxi-admin-off',section!==targets[key]);section.querySelectorAll('audio,video').forEach(v=>v.pause());}
  if(targets[key])targets[key].classList.remove('hidden');overview.hidden=key!=='home';
  for(const [name,b]of buttons){b.classList.toggle('active',name===key);b.setAttribute('aria-pressed',String(name===key));b.hidden=['clients','upload','users'].includes(name)&&!directory();}
  if(key==='home')void summary();
 }
 window.voxiAdminShow=show;
 async function summary(){
  if(!staff())return;const actor=currentUser.id,request=++generation;overview.replaceChildren();
  const today=new Date(),date=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
  const upcoming=currentBookings.filter(x=>x.booking_date>=date&&!['Отменено','Готово'].includes(x.status));
  const title=el('h3','Ближайшие записи');overview.append(title);
  if(!upcoming.length)overview.append(el('p','Ближайших активных записей нет.'));
  for(const item of upcoming.slice(0,5)){const row=el('button',undefined,'voxi-admin-upcoming');row.type='button';row.append(el('strong',item.booking_date+' · '+String(item.booking_time).slice(0,5)),el('span',item.client_name),el('small',item.status));row.addEventListener('click',()=>{show('bookings');const detail=[...by('bookings').querySelectorAll('details')].find(d=>String(d.dataset.id)===String(item.id));if(detail){detail.open=true;detail.scrollIntoView({behavior:'smooth',block:'center'});}});overview.append(row);}
  buttons.get('bookings').textContent='Заявки'+(upcoming.length?' · '+upcoming.length:'');
  if(directory()){
   const expiring=el('div');overview.append(el('h3','Скоро заканчивается хранение песен'),expiring);expiring.textContent='Проверяю…';
   const response=await supabaseClient.from('voxi_tracks').select('id,user_id,song_title,expires_at,deleted_at').not('expires_at','is',null).is('deleted_at',null).lte('expires_at',new Date(Date.now()+7*86400000).toISOString()).order('expires_at').limit(20);
   if(request!==generation||currentUser?.id!==actor||!staff())return;expiring.replaceChildren();
   if(response.error){expiring.textContent='Не удалось проверить сроки. Откройте клиента для проверки.';return;}
   if(!response.data.length)expiring.textContent='В ближайшие 7 дней сроки не заканчиваются.';
   for(const t of response.data){const row=el('button',t.song_title+' · до '+new Date(t.expires_at).toLocaleString('ru-RU'),'voxi-admin-upcoming');row.type='button';row.addEventListener('click',()=>void window.voxiOpenClients?.(t.user_id));expiring.append(row);}
  }
 }
 const originalOpen=openVOXiSection;openVOXiSection=async function(target){const result=await originalOpen(target);if(staff()&&['admin','cabinet'].includes(target)){workspace.classList.remove('hidden');show('home');}return result;};
 const originalSigned=setSignedIn;setSignedIn=function(user){originalSigned(user);workspace.classList.toggle('hidden',!staff());document.body.classList.toggle('voxi-admin-mode',staff());if(staff())show(current);else{generation++;overview.replaceChildren();for(const section of new Set(Object.values(targets).filter(Boolean)))section.classList.remove('voxi-admin-off');}};
 const originalRender=renderBookings;renderBookings=function(){originalRender();if(staff()&&current==='home')void summary();};
 if(by('videoModerationEntry'))new MutationObserver(()=>{buttons.get('videos').textContent=by('videoModerationEntry').textContent;}).observe(by('videoModerationEntry'),{childList:true,subtree:true,characterData:true});
 document.body.classList.toggle('voxi-admin-mode',staff());if(staff()){workspace.classList.remove('hidden');show('home');}
})();
