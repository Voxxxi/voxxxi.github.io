(()=>{
 const music=document.querySelector('[aria-label="Музыкальный плеер"]');if(!music)return;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const section=el('section');section.className='voxi-video-player';section.setAttribute('aria-label','Видео клиентов VOXi');music.after(section);
 const head=el('div');head.className='voxi-video-head';const text=el('div'),heading=el('h2'),intro=el('p');text.append(heading,intro);head.append(text);section.append(head);
 const message=el('p');message.setAttribute('role','status');const video=el('video');video.controls=true;video.playsInline=true;video.preload='none';video.style.display='none';
 const caption=el('div');caption.className='voxi-video-caption';const title=el('h3'),name=el('small'),description=el('p');caption.append(title,name,description);
 const nav=el('div');nav.className='voxi-video-nav';
 const button=(fn)=>{const b=el('button');b.type='button';b.addEventListener('click',fn);return b;};
 const prev=button(()=>show(index-1)),position=el('span'),next=button(()=>show(index+1)),refresh=button(load),like=button(toggleLike);like.setAttribute('aria-pressed','false');nav.append(prev,position,next,refresh,like);const concertHost=el('div');concertHost.className='voxi-concert';concertHost.hidden=true;const concertToggle=button(()=>concert?.toggle()),source=el('a');source.href='https://www.youtube.com/watch?v=zMNBglg7-Vg';source.target='_blank';source.rel='noopener noreferrer';source.className='voxi-concert-source';source.hidden=concertToggle.hidden=true;nav.append(concertToggle);section.append(message,video,concertHost,caption,source,nav);
 let concert=null,concertPlaying=false,concertFailed=false;
 let videos=[],index=0,liked=new Set(),liking=false,requestVersion=0,likesVersion=0;
 const ru=()=>document.documentElement.lang!=='kk',user=()=>typeof currentUser!=='undefined'?currentUser:null;
 function labels(){concertToggle.textContent=ru()?(concertPlaying?'Ⅱ Пауза':'▶ Смотреть без звука'):(concertPlaying?'Ⅱ Кідірту':'▶ Дыбыссыз көру');source.textContent='GAKKU TV · YouTube ↗';heading.textContent=ru()?'Праздники с VOXi':'VOXi-мен мерекелер';intro.textContent=ru()?'Видео наших клиентов':'Клиенттеріміздің бейнелері';prev.textContent=ru()?'← Назад':'← Артқа';next.textContent=ru()?'Далее →':'Келесі →';refresh.textContent=ru()?'Другие видео':'Басқа бейнелер';if(!videos.length){message.textContent=ru()?'Скоро здесь появятся видео наших клиентов. А пока — настроение студии.':'Жақында мұнда клиенттеріміздің бейнелері пайда болады. Әзірге студия атмосферасын тамашалаңыз.';title.textContent=concertFailed?(ru()?'В ритме VOXi':'VOXi ырғағымен'):'Димаш · Gakku Дауысы 2017';name.textContent=concertFailed?(ru()?'Студийная заставка · без звука':'Студиялық бейне · дыбыссыз'):(ru()?'Концертная заставка · около 5 минут · без звука · повтор':'Концерттік бейне · шамамен 5 минут · дыбыссыз · қайталау');}likeLabel();}
 function likeLabel(){const v=videos[index];like.textContent='♡ '+(v?.likes||0);like.setAttribute('aria-label',ru()?'Мне нравится':'Ұнайды');like.setAttribute('aria-pressed',v&&liked.has(v.id)?'true':'false');like.disabled=!v||liking;}
 function show(at){
  video.pause();concert?.destroy();concert=null;concertFailed=false;concertPlaying=false;concertHost.hidden=source.hidden=concertToggle.hidden=true;
  if(!videos.length){
   caption.hidden=false;description.textContent='';prev.hidden=next.hidden=like.hidden=true;position.textContent='';video.style.display='none';concertHost.hidden=source.hidden=concertToggle.hidden=false;concertToggle.disabled=true;labels();
   concert=window.voxiCreateConcert({host:concertHost,onState(playing){concertToggle.disabled=false;concertPlaying=playing;labels();},onFallback(){
    concert=null;concertFailed=true;concertHost.hidden=source.hidden=concertToggle.hidden=true;
    video.src='media/studio-loop.mp4';video.poster='media/studio-poster.jpg';video.controls=true;video.muted=true;video.loop=true;video.style.display='block';labels();
    message.textContent=ru()?'YouTube сейчас недоступен — показываем студийную заставку.':'YouTube қазір қолжетімсіз — студиялық бейне көрсетіледі.';
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&!navigator.connection?.saveData)void video.play().catch(()=>{});
   }});return;
  }
  video.loop=false;video.muted=false;video.removeAttribute('poster');prev.hidden=next.hidden=like.hidden=false;
  index=(at+videos.length)%videos.length;const v=videos[index];video.src=v.url;video.style.display='block';caption.hidden=false;title.textContent=v.title;name.textContent=v.name;description.textContent=v.description||'';position.textContent=(index+1)+' / '+videos.length;prev.disabled=next.disabled=videos.length<2;likeLabel();
 }
 async function load(){
  const version=++requestVersion;refresh.disabled=true;message.textContent=ru()?'Загружаем видео…':'Бейнелер жүктелуде…';
  try{const data=await voxiVideoRequest(null,'feed');if(version!==requestVersion)return;videos=data.videos;message.textContent=videos.length?'':ru()?'Здесь появятся видео клиентов после проверки.':'Тексерілген клиент бейнелері осында пайда болады.';show(0);await loadLikes();}
  catch{if(version===requestVersion){if(!videos.length)show(0);message.textContent=ru()?'Видео клиентов временно недоступны. Попробуйте обновить список.':'Клиент бейнелері уақытша қолжетімсіз. Тізімді жаңартып көріңіз.';}}
  finally{if(version===requestVersion)refresh.disabled=false;}
 }
 async function loadLikes(){
  const account=user(),version=++likesVersion;liked=new Set();likeLabel();if(!account||!supabaseClient||!videos.length)return;
  const {data,error}=await supabaseClient.from('voxi_video_likes').select('video_id').eq('user_id',account.id).in('video_id',videos.map(v=>v.id));
  if(version!==likesVersion||user()?.id!==account.id)return;if(!error){liked=new Set(data.map(r=>r.video_id));likeLabel();}
 }
 async function toggleLike(){
  const account=user(),selected=videos[index];if(!selected||liking)return;if(!account){message.textContent=ru()?'Войдите через Google, чтобы поставить отметку «Нравится».':'Ұнату үшін Google арқылы кіріңіз.';return;}
  const wasLiked=liked.has(selected.id);liking=true;likeLabel();
  try{
   const result=wasLiked?await supabaseClient.from('voxi_video_likes').delete().eq('video_id',selected.id).eq('user_id',account.id):await supabaseClient.from('voxi_video_likes').insert({video_id:selected.id,user_id:account.id});
   if(result.error&&result.error.code!=='23505')throw result.error;if(user()?.id!==account.id)return;
   if(wasLiked)liked.delete(selected.id);else liked.add(selected.id);
   if(!result.error)selected.likes=Math.max(0,selected.likes+(wasLiked?-1:1));message.textContent='';
  }catch{message.textContent=ru()?'Не удалось сохранить отметку. Обновите список и попробуйте снова.':'Белгі сақталмады. Тізімді жаңартып, қайта көріңіз.';}
  finally{liking=false;likeLabel();}
 }
 video.addEventListener('play',()=>{if(!videos.length){video.muted=true;return;}document.querySelectorAll('audio,video').forEach(other=>{if(other!==video)other.pause();});});
 music.querySelector('audio')?.addEventListener('play',()=>{if(videos.length)video.pause();});
 video.addEventListener('error',()=>{message.textContent=ru()?'Не удалось воспроизвести видео. Обновите список или попробуйте другой ролик.':'Бейне ойнатылмады. Тізімді жаңартыңыз немесе басқа бейнені көріңіз.';});
 if(typeof setSignedIn==='function'){const previous=setSignedIn;setSignedIn=function(account){previous(account);void loadLikes();};}
 document.getElementById('ru')?.addEventListener('click',labels);document.getElementById('kk')?.addEventListener('click',labels);
 labels();void load();
})();
