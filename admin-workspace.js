(()=>{
 if(typeof supabaseClient==='undefined'||!supabaseClient)return;
 const by=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const staff=()=>!!currentUser&&isAdmin(),directory=()=>['owner','admin'].includes(voxiStaffRole);
 const adminDocument=document.documentElement.hasAttribute('data-voxi-admin');
 const routeParams=new URLSearchParams(location.search),requested=routeParams.get('section')||'home';
 const routeKeys=['home','bookings','schedule','clients','upload','users','income','maintenance','updates','statistics','videos','backup'];
 const route=requested==='users'?'clients':routeKeys.includes(requested)?requested:'home';
 const destination=key=>'./admin.html?section='+encodeURIComponent(key);
 if(!adminDocument){
  const keepBookingSeparate=()=>{for(const id of ['schedulePanel','backupPanel'])by(id)?.classList.add('voxi-admin-off');by('bookings')?.closest('section')?.classList.add('voxi-admin-off');};
  keepBookingSeparate();const publicSigned=setSignedIn;setSignedIn=function(user){publicSigned(user);keepBookingSeparate();};
  const oldOpen=openVOXiSection;openVOXiSection=async function(target){if(staff()&&['admin','cabinet'].includes(target)){location.assign(destination('home'));return;}return oldOpen(target);};
  window.voxiOpenClients=query=>location.assign(destination('clients')+(query?'&q='+encodeURIComponent(query):''));
  return;
 }
 const gate=el('section','Проверяем доступ к рабочему кабинету…','panel voxi-admin-gate');gate.id='adminAccessGate';document.querySelector('.voxi-functional').prepend(gate);
 const homeLink=el('a','← На главную','nav-btn');homeLink.href='./';document.querySelector('header nav').prepend(homeLink);
 const app=by('app'),main=app,bookingSection=by('bookings').closest('section');bookingSection.id='adminBookingsSection';
 const workspace=el('section',undefined,'panel hidden voxi-admin-workspace');workspace.id='adminWorkspace';
 const head=el('div',undefined,'voxi-admin-heading');head.append(el('h2','Рабочий кабинет VOXi'),el('p','Записи, клиенты и готовые песни — всё под рукой.','notice'));
 const nav=el('nav',undefined,'voxi-admin-nav');nav.setAttribute('aria-label','Разделы администратора');
 const quick=el('form',undefined,'voxi-users-search'),quickInput=el('input'),quickSubmit=el('button','Найти клиента','secondary');quickInput.type='search';quickInput.placeholder='Имя или телефон клиента';quickInput.setAttribute('aria-label','Быстрый поиск клиента');quickSubmit.type='submit';quick.append(quickInput,quickSubmit);head.append(quick);quick.addEventListener('submit',e=>{e.preventDefault();if(directory())location.assign(destination('clients')+'&q='+encodeURIComponent(quickInput.value.trim()));});
 const overview=el('div',undefined,'voxi-admin-overview');workspace.append(head,nav,overview);main.prepend(workspace);
 
 const bookingTools=el('div',undefined,'voxi-users-search'),bookingSearch=el('input'),bookingFilter=el('select'),bookingRefresh=el('button',undefined,'secondary');
 bookingSearch.type='search';bookingFilter.setAttribute('aria-label','Фильтр заявок');bookingSearch.setAttribute('aria-label','Поиск заявок');bookingRefresh.type='button';
 const filterLabels=[['all','Все заявки','Барлық өтінім'],['upcoming','Предстоящие','Алдағы'],['today','Сегодня','Бүгін'],['done','Готовые','Дайын'],['cancelled','Отменённые','Бас тартылған']];
 for(const [value]of filterLabels){const option=el('option');option.value=value;bookingFilter.append(option);}
 const toolLabels=()=>{const kk=document.documentElement.lang==='kk';bookingSearch.setAttribute('aria-label',kk?'Өтінімдерді іздеу':'Поиск заявок');bookingFilter.setAttribute('aria-label',kk?'Өтінім сүзгісі':'Фильтр заявок');bookingSearch.placeholder=kk?'Аты, телефон немесе ән':'Имя, телефон или песня';bookingRefresh.textContent=kk?'Тізімді жаңарту':'Обновить список';[...bookingFilter.options].forEach((o,i)=>o.textContent=filterLabels[i][kk?2:1]);};
 bookingFilter.value='all';toolLabels();new MutationObserver(toolLabels).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 bookingTools.append(bookingSearch,bookingFilter,bookingRefresh);by('bookings').before(bookingTools);
 bookingSearch.addEventListener('input',()=>renderBookings());bookingFilter.addEventListener('change',()=>renderBookings());
 bookingRefresh.addEventListener('click',async()=>{if(!staff())return;bookingRefresh.disabled=true;try{await loadBookings();}finally{bookingRefresh.disabled=false;}});
 window.voxiFilterBookings=rows=>{if(!staff())return rows;const query=bookingSearch.value.trim().toLocaleLowerCase(),day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Oral',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 return rows.filter(b=>(!query||[b.client_name,b.phone,b.song_titles].some(x=>String(x||'').toLocaleLowerCase().includes(query)))&&
 (bookingFilter.value==='all'||bookingFilter.value==='today'&&b.booking_date===day||bookingFilter.value==='upcoming'&&b.booking_date>=day&&!['Отменено','Готово'].includes(b.status)||bookingFilter.value==='done'&&b.status==='Готово'||bookingFilter.value==='cancelled'&&b.status==='Отменено'));};

 let current='home',generation=0;
 const targets={home:null,bookings:bookingSection,schedule:by('schedulePanel'),clients:by('usersPanel'),upload:by('usersPanel'),income:by('incomePanel'),maintenance:by('maintenancePanel'),updates:by('studioUpdatesPanel'),statistics:by('statisticsPanel'),videos:by('videoModerationPanel'),backup:by('backupPanel')};
 const buttons=new Map();
 for(const [key,label] of [['home','Обзор'],['bookings','Заявки'],['schedule','Моё расписание'],['clients','Клиенты'],['upload','Загрузить песню'],['updates','Объявления и акции'],['statistics','Статистика'],['income','Доходы'],['maintenance','Состояние сайта'],['videos','Видео на проверке'],['backup','Резервная копия']]){
  const b=el('a',label,'secondary');b.href=destination(key);buttons.set(key,b);nav.append(b);
 }
 function show(key){
  if(!staff())return;if(['clients','upload'].includes(key)&&!directory()||['income','maintenance','updates','statistics'].includes(key)&&voxiStaffRole!=='owner')key='home';current=key;quick.hidden=!directory();
  for(const section of new Set(Object.values(targets).filter(Boolean))){section.classList.toggle('voxi-admin-off',section!==targets[key]);section.querySelectorAll('audio,video').forEach(v=>v.pause());}
  if(targets[key])targets[key].classList.remove('hidden');overview.hidden=key!=='home';
  for(const [name,b]of buttons){b.classList.toggle('active',name===key);if(name===key)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');b.hidden=['clients','upload'].includes(name)&&!directory()||['income','maintenance','updates','statistics'].includes(name)&&voxiStaffRole!=='owner';}
  if(key==='home')void summary();if(key==='statistics')void window.voxiLoadStatistics?.();
 }
 window.voxiAdminShow=key=>show(route==='upload'&&key==='clients'?'upload':key==='users'?'clients':key);
 const dateShortcuts=el('div',undefined,'voxi-admin-date-shortcuts');for(const [offset,label]of [[0,'Сегодня'],[1,'Завтра']]){const b=el('button',label,'secondary');b.type='button';b.addEventListener('click',()=>{const d=new Date();d.setDate(d.getDate()+offset);by('scheduleDate').value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);by('scheduleDate').dispatchEvent(new Event('change'));});dateShortcuts.append(b);}(by('scheduleDate').closest('.voxi-date-control')||by('scheduleDate')).after(dateShortcuts);
 const legacy=by('scheduleList'),legacyTitle=legacy.previousElementSibling,legacyWrap=el('details',undefined,'voxi-admin-legacy');legacy.before(legacyWrap);legacyWrap.append(el('summary','Старые интервалы расписания'));if(legacyTitle?.tagName==='H3'){legacyTitle.hidden=true;legacyWrap.append(legacyTitle);}legacyWrap.append(legacy);
 async function summary(){
  if(!staff())return;const actor=currentUser.id,request=++generation;overview.replaceChildren();
  const today=new Date(),date=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
  const upcoming=currentBookings.filter(x=>x.booking_date>=date&&!['Отменено','Готово'].includes(x.status));
  const title=el('h3','Ближайшие записи');overview.append(title);
  if(!upcoming.length)overview.append(el('p','Ближайших активных записей нет.'));
  for(const item of upcoming.slice(0,5)){const row=el('button',undefined,'voxi-admin-upcoming');row.type='button';row.append(el('strong',item.booking_date+' · '+String(item.booking_time).slice(0,5)),el('span',item.client_name),el('small',item.status));row.addEventListener('click',()=>{location.assign(destination('bookings'));});overview.append(row);}
  buttons.get('bookings').textContent='Заявки'+(upcoming.length?' · '+upcoming.length:'');
  if(directory()){
   const expiring=el('div');overview.append(el('h3','Скоро заканчивается хранение песен'),expiring);expiring.textContent='Проверяю…';
   const response=await supabaseClient.from('voxi_tracks').select('id,user_id,song_title,expires_at,deleted_at').not('expires_at','is',null).is('deleted_at',null).lte('expires_at',new Date(Date.now()+7*86400000).toISOString()).order('expires_at').limit(20);
   if(request!==generation||currentUser?.id!==actor||!staff())return;expiring.replaceChildren();
   if(response.error){expiring.textContent='Не удалось проверить сроки. Откройте клиента для проверки.';return;}
   if(!response.data.length)expiring.textContent='В ближайшие 7 дней сроки не заканчиваются.';
   for(const t of response.data){const row=el('button',t.song_title+' · до '+new Date(t.expires_at).toLocaleString('ru-RU'),'voxi-admin-upcoming');row.type='button';row.addEventListener('click',()=>location.assign(destination('clients')+'&q='+encodeURIComponent(t.user_id)));expiring.append(row);}
  }
 }
 const originalOpen=openVOXiSection;openVOXiSection=async function(target){const result=await originalOpen(target);if(staff()&&['admin','cabinet'].includes(target)){workspace.classList.remove('hidden');show(current);}return result;};
 let openedFor=null;
 function syncRoute(){
  const allowed=staff();workspace.classList.toggle('hidden',!allowed);document.body.classList.toggle('voxi-admin-mode',allowed);gate.hidden=allowed;
  if(!allowed){openedFor=null;generation++;overview.replaceChildren();const checking=currentUser&&typeof voxiStaffRole!=='undefined'&&voxiStaffRole===null;gate.textContent=checking?'Проверяем доступ к рабочему кабинету…':currentUser?'Рабочий кабинет доступен только сотрудникам студии.':'Для входа в рабочий кабинет войдите через Google.';return;}
  if(openedFor===currentUser.id)return;openedFor=currentUser.id;
  const key=['clients','upload'].includes(route)&&!directory()||['income','maintenance','updates','statistics'].includes(route)&&voxiStaffRole!=='owner'?'home':route;show(key);
  document.title='VOXi — '+(buttons.get(key)?.textContent||'Рабочий кабинет');
  if(['clients','upload'].includes(key))void window.voxiOpenClients?.(routeParams.get('q')||'');
  else if(key==='updates')void window.voxiLoadStudioUpdates?.();
  else if(key==='income')void window.voxiLoadIncome?.();
  else if(key==='maintenance')void window.voxiLoadMaintenance?.();
  else if(key==='videos')by('videoModerationEntry')?.click();
 }
 const originalSigned=setSignedIn;setSignedIn=function(user){originalSigned(user);syncRoute();};
 const originalRender=renderBookings;renderBookings=function(){originalRender();if(staff()&&current==='home')void summary();};
 if(by('videoModerationEntry'))new MutationObserver(()=>{buttons.get('videos').textContent=by('videoModerationEntry').textContent;}).observe(by('videoModerationEntry'),{childList:true,subtree:true,characterData:true});
 syncRoute();
})();
