(()=>{
 if(typeof supabaseClient==='undefined'||!supabaseClient)return;
 const owner=()=>!!currentUser&&voxiStaffRole==='owner',t=(r,k)=>document.documentElement.lang==='kk'?k:r,make=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const badge=make('a');badge.className='nav-btn voxi-registration-badge';badge.href='./admin.html?section=home#newRegistrations';badge.hidden=true;document.querySelector('header nav')?.append(badge);
 let actor=null,generation=0,result=null,section=null,reading=false;
 function clear(){generation++;actor=null;result=null;badge.hidden=true;section?.remove();section=null;}
 function render(){
  badge.hidden=!owner();if(!owner())return;
  const count=Number(result?.unread_count)||0;badge.textContent=t('Новые регистрации','Жаңа тіркелулер')+(count?' · '+count:'');badge.classList.toggle('has-unread',count>0);
  const overview=document.querySelector('.voxi-admin-overview');if(!overview||overview.hidden)return;
  if(!section||!section.isConnected){section=make('section');section.id='newRegistrations';section.className='voxi-registration-list';overview.after(section);}
  section.hidden=false;section.replaceChildren();section.append(make('h3',t('Новые регистрации','Жаңа тіркелулер')));
  if(!result){section.append(make('p',t('Не удалось загрузить уведомления.','Хабарламалар жүктелмеді.')));return;}
  if(!result.items.length)section.append(make('p',t('Новых регистраций пока нет.','Жаңа тіркелулер әзірге жоқ.')));
  for(const item of result.items){
   const row=make('article');row.className='voxi-registration-row';
   row.append(make('strong',(item.read_at?'':t('Новое · ','Жаңа · '))+item.full_name),make('small',new Date(item.created_at).toLocaleString(document.documentElement.lang==='kk'?'kk-KZ':'ru-RU',{timeZone:'Asia/Oral'})));
   const link=make('a',t('Открыть клиента','Клиентті ашу'));link.href='./admin.html?section=clients&q='+encodeURIComponent(item.user_id);row.append(link);
   if(!item.read_at){const read=make('button',t('Прочитано','Оқылды'));read.type='button';read.disabled=reading;read.addEventListener('click',async()=>{
    if(!owner()||reading)return;reading=true;read.disabled=true;const selected=actor,request=generation;
    try{const r=await supabaseClient.rpc('voxi_read_registration',{p_user:item.user_id});if(request!==generation||selected!==actor||!owner())return;if(r.error)throw r.error;await refresh();}
    catch{if(request===generation&&owner())row.append(make('p',t('Не удалось отметить. Повторите попытку.','Белгілеу мүмкін болмады. Қайта көріңіз.')));}
    finally{reading=false;if(owner())render();}
   });row.append(read);}
   section.append(row);
  }
  section.append(make('small',t('До 50 регистраций. Непрочитанные показаны первыми.','50 тіркелуге дейін. Оқылмағандар бірінші көрсетіледі.')));
 }
 async function refresh(){
  if(!owner()){clear();return;}const selected=currentUser.id;actor=selected;const request=++generation;
  try{const r=await supabaseClient.rpc('voxi_registration_notifications');if(request!==generation||!owner()||currentUser.id!==selected)return;if(r.error)throw r.error;result=r.data;render();}
  catch{if(request===generation&&owner()){result=null;render();badge.title=t('Не удалось обновить уведомления','Хабарламалар жаңартылмады');}}
 }
 const previous=setSignedIn;setSignedIn=function(user){previous(user);if(!owner())clear();else if(actor!==user.id){actor=user.id;void refresh();}};
 const previousOpen=window.voxiAdminShow;if(previousOpen)window.voxiAdminShow=function(key){previousOpen(key);if(section)section.hidden=key!=='home';if(key==='home')render();};
 new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 setInterval(()=>{if(!document.hidden&&owner())void refresh();},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&owner())void refresh();});
 if(owner())void refresh();
})();

