(()=>{
 if(typeof supabaseClient==='undefined'||!supabaseClient)return;
 const admin=document.documentElement.hasAttribute('data-voxi-admin'),kk=()=>document.documentElement.lang==='kk',text=(r,k)=>kk()?k:r;
 const make=(tag,s,cls)=>{const n=document.createElement(tag);if(s!==undefined)n.textContent=s;if(cls)n.className=cls;return n;};
 async function bounded(query){let timer;try{return await Promise.race([query,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('timeout')),15000))]);}finally{clearTimeout(timer);}}
 if(!admin){
  // A daily page-open total, without a server-side visitor identifier or raw URL.
  void(async()=>{try{
   if(navigator.doNotTrack==='1'||navigator.globalPrivacyControl||localStorage.getItem('voxi-statistics-optout')==='1')return;
   const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Oral',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),key='voxi-main-open-'+day;
   if(sessionStorage.getItem(key))return;
   const {data,error}=await bounded(supabaseClient.auth.getSession());if(error)return;
   if(data?.session?.user){await resolveVOXiStaffRole(data.session.user);if(isAdmin())return;}
   sessionStorage.setItem(key,'1');const result=await bounded(supabaseClient.rpc('voxi_record_page_open'));if(result.error)sessionStorage.removeItem(key);
  }catch{}})();return;
 }
 const owner=()=>currentUser&&voxiStaffUserId===currentUser.id&&voxiStaffRole==='owner';
 const panel=make('section',undefined,'panel hidden');panel.id='statisticsPanel';const heading=make('h2'),intro=make('p',undefined,'notice'),form=make('form',undefined,'voxi-stat-controls'),month=make('input'),refresh=make('button',undefined,'secondary'),message=make('p',undefined,'notice'),cards=make('div',undefined,'voxi-income-stats'),daily=make('div',undefined,'voxi-stat-table');
 month.type='month';month.min='2020-01';month.max='2100-01';month.required=true;month.value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Oral',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);refresh.type='submit';message.setAttribute('role','status');form.append(month,refresh);panel.append(heading,intro,form,message,cards,daily);document.getElementById('backupPanel').before(panel);
 let generation=0,last=null;
 const pairs=[['opens','Открытия главной','Басты бетті ашу'],['new_clients','Новых клиентов','Жаңа клиенттер'],['bookings_created','Создано заявок','Жасалған өтінімдер'],['completed_orders','Закрыто заявок','Аяқталған өтінімдер'],['income','Заработано','Табыс'],['tracks_delivered','Загружено песен','Жүктелген әндер'],['cancelled_appointments','Отменено записей месяца','Айдағы бас тартулар'],['clients_total','Всего клиентов сейчас','Қазіргі клиенттер саны'],['returning_clients','Клиентов с повторной записью','Қайта жазылған клиенттер']];
 function labels(){heading.textContent=text('Статистика студии','Студия статистикасы');intro.textContent=text('Месяц считается по времени Алги. Открытия главной — не уникальные люди: учитываются вкладки посетителей раз в день, без сотрудников и с возможностью отказа. Заявки считаются по дате создания, отмены — по дате записи. Повторные клиенты — с двумя и более неотменёнными записями к концу выбранного месяца, без будущих дней.','Ай Алға уақытымен есептеледі. Басты бетті ашу — бірегей адам саны емес: қызметкерлерден басқа келушілердің қойындылары күніне бір рет саналады, есептен бас тартуға болады. Өтінімдер жасалған күнімен, бас тартулар жазылу күнімен есептеледі. Қайта келген клиенттер — таңдалған айдың соңына дейін болашақ күндерді қоспағанда кемінде екі бас тартылмаған жазылуы бар клиенттер.');refresh.textContent=text('Обновить статистику','Статистиканы жаңарту');month.setAttribute('aria-label',text('Месяц статистики','Статистика айы'));if(last)render(last);}
 function render(data){cards.replaceChildren();daily.replaceChildren();for(const [key,r,k]of pairs){const card=make('div',undefined,'voxi-income-stat');card.append(make('small',text(r,k)),make('strong',new Intl.NumberFormat(kk()?'kk-KZ':'ru-RU').format(Number(data[key])||0)+(key==='income'?' ₸':'')));cards.append(card);}
  const table=make('table'),head=make('thead'),row=make('tr');for(const s of [text('День','Күн'),text('Открытия','Ашулар'),text('Новые заявки','Жаңа өтінімдер')]){const th=make('th',s);th.scope='col';row.append(th);}head.append(row);const body=make('tbody');for(const d of data.daily||[]){const tr=make('tr');for(const s of [String(d.day).slice(8,10)+'.'+String(d.day).slice(5,7),d.opens,d.bookings])tr.append(make('td',String(s)));body.append(tr);}table.append(head,body);daily.append(make('h3',text('По дням','Күндер бойынша')),table);
 }
 async function load(){if(!owner())return;const actor=currentUser.id,request=++generation,selected=month.value;last=null;cards.replaceChildren();daily.replaceChildren();message.textContent=text('Считаем показатели…','Көрсеткіштер есептелуде…');refresh.disabled=true;
  try{const {data,error}=await bounded(supabaseClient.rpc('voxi_studio_statistics',{p_month:selected+'-01'}));if(request!==generation||currentUser?.id!==actor||!owner()||month.value!==selected)return;if(error)throw error;last=data;render(data);message.textContent='';}catch{if(request===generation&&currentUser?.id===actor)message.textContent=text('Не удалось загрузить статистику. Попробуйте ещё раз.','Статистика жүктелмеді. Қайта көріңіз.');}finally{if(request===generation)refresh.disabled=false;}
 }
 form.addEventListener('submit',e=>{e.preventDefault();void load();});month.addEventListener('change',()=>void load());window.voxiLoadStatistics=load;
 const previous=setSignedIn;setSignedIn=function(user){previous(user);if(!owner()){generation++;last=null;cards.replaceChildren();daily.replaceChildren();message.textContent='';panel.classList.add('hidden');refresh.disabled=false;}};
 new MutationObserver(labels).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});labels();
})();
