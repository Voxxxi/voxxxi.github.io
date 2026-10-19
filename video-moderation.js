(()=>{
 if(typeof supabaseClient==='undefined'||!supabaseClient)return;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const staff=()=>!!currentUser&&isAdmin();
 const entry=el('button','Видео на проверке','nav-btn hidden');entry.type='button';entry.id='videoModerationEntry';document.querySelector('header nav')?.insertBefore(entry,document.getElementById('loginButton'));
 const panel=el('section',undefined,'panel hidden');panel.id='videoModerationPanel';panel.append(el('h2','Видео клиентов'),el('p','Новые ролики видны только автору и модераторам. На главной появятся после вашего одобрения.','notice'));
 const pending=el('button','На проверке','secondary'),all=el('button','Все видео','secondary');pending.type=all.type='button';panel.append(pending,all);
 const status=el('p');status.setAttribute('role','status');const list=el('div',undefined,'voxi-video-queue');panel.append(status,list);document.getElementById('backupPanel').before(panel);
 let showAll=false,version=0,timer=null;
 const signedIn=setSignedIn;setSignedIn=function(account){signedIn(account);entry.classList.toggle('hidden',!staff());if(!staff()){version++;panel.classList.add('hidden');list.querySelectorAll('video').forEach(v=>v.pause());list.replaceChildren();if(timer){clearInterval(timer);timer=null;}}else{void count();if(!timer)timer=setInterval(count,60000);}};
 async function count(){if(!staff())return;const actor=currentUser.id;const result=await supabaseClient.from('voxi_video_notifications').select('id',{head:true,count:'exact'}).is('read_at',null);if(currentUser?.id!==actor||!staff())return;if(!result.error)entry.textContent='Видео на проверке'+(result.count?' · '+result.count:'');}
 entry.addEventListener('click',async()=>{if(!staff())return;await openVOXiSection('admin');if(!staff())return;panel.classList.remove('hidden');panel.scrollIntoView({behavior:'smooth',block:'start'});await load();});
 pending.addEventListener('click',()=>{showAll=false;void load();});all.addEventListener('click',()=>{showAll=true;void load();});
 async function load(){
  if(!staff())return;const actor=currentUser.id,request=++version;list.querySelectorAll('video').forEach(v=>v.pause());list.replaceChildren();status.textContent='Загружаем очередь…';
  try{
   const data=await voxiVideoRequest(supabaseClient,'queue',{showAll});if(request!==version||currentUser?.id!==actor||!staff())return;
   status.textContent=data.videos.length?'Роликов: '+data.videos.length:'Видео на проверке нет.';
   for(const video of data.videos){
    const card=el('article',undefined,'voxi-video-review');card.append(el('h3',video.title),el('p',video.name+' · ID клиента: '+video.userId),el('p','Статус: '+({pending:'На проверке',approved:'Опубликовано',rejected:'Отклонено'}[video.status]||video.status)));
    if(video.description)card.append(el('p',video.description));
    if(video.previewUrl){const player=el('video',undefined,'voxi-private-video');player.controls=true;player.playsInline=true;player.preload='none';player.src=video.previewUrl;player.addEventListener('play',()=>document.querySelectorAll('audio,video').forEach(other=>{if(other!==player)other.pause();}));card.append(player);}
    const reason=el('textarea');reason.maxLength=500;reason.placeholder='Причина отклонения (видна автору)';reason.setAttribute('aria-label','Причина отклонения');reason.value=video.reason||'';
    const result=el('p');result.setAttribute('role','status');
    const approve=el('button','Опубликовать','primary'),reject=el('button',video.status==='approved'?'Снять с публикации':'Отклонить','danger');approve.type=reject.type='button';approve.disabled=video.status==='approved';card.append(reason,approve,reject,result);
    async function review(decision){
     if(!staff()||currentUser.id!==actor)return;if(decision==='rejected'&&!reason.value.trim()){result.textContent='Укажите причину для автора.';reason.focus();return;}
     approve.disabled=reject.disabled=true;result.textContent='Сохраняем решение…';
     try{const {error}=await supabaseClient.rpc('voxi_review_video',{p_video:video.id,p_decision:decision,p_reason:reason.value.trim()});if(error)throw error;if(currentUser?.id!==actor)return;await count();await load();}
     catch(error){if(currentUser?.id===actor){result.textContent=error.message||'Не удалось сохранить решение.';approve.disabled=video.status==='approved';reject.disabled=false;}}
    }
    approve.addEventListener('click',()=>review('approved'));reject.addEventListener('click',()=>review('rejected'));list.append(card);
   }
  }catch(error){if(request===version)status.textContent='Не удалось загрузить видео: '+error.message;}
 }
 window.addEventListener('focus',()=>{void count();});entry.classList.toggle('hidden',!staff());if(staff()){void count();timer=setInterval(count,60000);}
})();
