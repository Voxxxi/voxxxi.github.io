(()=>{
 'use strict';
 const audio=document.getElementById('audio'),play=document.getElementById('play'),root=document.querySelector('[aria-label="Музыкальный плеер"]');
 if(!audio||!play||!root)return;
 root.id='portfolio';
 const client=typeof supabaseClient!=='undefined'?supabaseClient:null;
 const name=root.querySelector('.track-name'),nav=document.createElement('div'),status=document.createElement('p'),login=document.createElement('button');
 nav.className='voxi-portfolio-nav';status.className='voxi-portfolio-status';status.setAttribute('role','status');login.className='voxi-portfolio-login';login.type='button';
 const prev=document.createElement('button'),next=document.createElement('button'),position=document.createElement('span');prev.type=next.type='button';nav.append(prev,position,next);root.append(nav,status,login);
 let actor=null,tracks=[],queue=[],index=0,generation=0,refreshGeneration=0,downloadGeneration=0,state='checking',objectURL=null,pending=false;
 const ru=()=>document.documentElement.lang!=='kk',text=(r,k)=>ru()?r:k;
 const shuffled=items=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 function release(){downloadGeneration++;audio.pause();audio.removeAttribute('src');audio.preload='none';audio.load();if(objectURL)URL.revokeObjectURL(objectURL);objectURL=null;pending=false;}
 function labels(){
  prev.textContent=text('← Предыдущая','← Алдыңғы');next.textContent=text('Следующая →','Келесі →');
  nav.hidden=state!=='ready'||!queue.length;prev.disabled=next.disabled=pending||queue.length<2;play.disabled=state==='checking'||state==='error'||(state==='ready'&&!queue.length)||pending;
  play.setAttribute('aria-label',state==='guest'?text('Войти, чтобы слушать','Тыңдау үшін кіру'):audio.paused?text('Воспроизвести','Ойнату'):text('Пауза','Кідірту'));
  login.hidden=!['guest','profile','error'].includes(state);login.textContent=state==='guest'?text('Войти через Google, чтобы слушать','Тыңдау үшін Google арқылы кіріңіз'):state==='profile'?text('Завершить регистрацию','Тіркеуді аяқтау'):text('Повторить проверку','Қайта тексеру');
  if(state!=='ready'||!queue.length)name.textContent=text('ЛУЧШИЕ РАБОТЫ СТУДИИ','СТУДИЯНЫҢ ҮЗДІК ЖҰМЫСТАРЫ');
  else name.textContent=queue[index].title.replace(/^Запись (\d+)$/,text('Запись $1','Жазба $1'));
  if(state==='checking')status.textContent=text('Проверяем доступ к прослушиванию…','Тыңдауға рұқсат тексерілуде…');
  else if(state==='guest')status.textContent=text('Работы студии доступны после входа и регистрации.','Студия жұмыстарын кіру және тіркелу аяқталғаннан кейін тыңдауға болады.');
  else if(state==='profile')status.textContent=text('Заполните имя, фамилию и телефон в профиле, чтобы слушать работы студии.','Студия жұмыстарын тыңдау үшін профильде атыңызды, тегіңізді және телефоныңызды толтырыңыз.');
  else if(state==='error')status.textContent=text('Не удалось проверить доступ. Повторите попытку.','Рұқсатты тексеру мүмкін болмады. Қайта көріңіз.');
  else if(!queue.length)status.textContent=text('Здесь скоро зазвучат наши лучшие записи.','Жақында мұнда үздік жазбаларымызды тыңдай аласыз.');
 }
 function select(at){release();index=at;name.textContent=queue[index].title;position.textContent=(index+1)+' / '+queue.length;status.textContent=text('Случайный порядок · работы студии VOXi','Кездейсоқ ретпен · VOXi студиясының жұмыстары');labels();}
 async function check(user){
  const request=++generation;actor=user?.id||null;release();tracks=[];queue=[];index=0;
  if(!actor||!client){state='guest';labels();return;}
  state='checking';labels();
  try{
   const permission=await client.rpc('voxi_listening_allowed');if(request!==generation)return;if(permission.error)throw permission.error;
   if(!permission.data){state='profile';labels();return;}
   const result=await client.rpc('voxi_portfolio_tracks');if(request!==generation)return;if(result.error)throw result.error;
   if(!Array.isArray(result.data))throw Error('Invalid playlist');
   const seen=new Set();tracks=result.data.filter(t=>{if(!t||typeof t.id!=='string'||typeof t.title!=='string'||!t.title.trim()||typeof t.path!=='string'||!t.path||t.path.startsWith('/')||t.path.split('/').some(x=>!x||x==='.'||x==='..')||seen.has(t.id))return false;seen.add(t.id);return true;});
   queue=shuffled(tracks);state='ready';if(queue.length)select(0);else labels();
  }catch{if(request===generation){state='error';labels();}}
 }
 async function start(){
  if(state!=='ready'||!queue.length||pending)return;
  const request=++downloadGeneration,authRequest=generation,selected=queue[index];pending=true;labels();
  status.textContent=text('Загружаем запись…','Жазба жүктелуде…');
  try{
   await window.voxiPlayerVisual?.prepare();
   if(request!==downloadGeneration||authRequest!==generation)return;
   if(!objectURL){
    const response=await client.storage.from('voxi-portfolio').download(selected.path);
    if(request!==downloadGeneration||authRequest!==generation)return;
    if(response.error||!response.data)throw response.error||Error('No audio');
    objectURL=URL.createObjectURL(response.data);audio.src=objectURL;
   }
   if(request!==downloadGeneration||authRequest!==generation)return;
   await audio.play();
   if(request!==downloadGeneration||authRequest!==generation)return;
   status.textContent='';
  }catch{
   if(request===downloadGeneration&&authRequest===generation){release();labels();status.textContent=text('Не удалось воспроизвести запись. Проверьте вход или выберите следующую.','Жазба ойнатылмады. Кіруді тексеріңіз немесе келесісін таңдаңыз.');}
  }finally{if(authRequest===generation&&request===downloadGeneration){pending=false;labels();}}
 }
 async function advance(step,autoplay=!audio.paused){if(state!=='ready'||!queue.length||pending)return;let at=index+step;if(at>=queue.length){const last=queue[index];queue=shuffled(tracks);if(queue.length>1&&queue[0].id===last.id)[queue[0],queue[1]]=[queue[1],queue[0]];at=0;}if(at<0)at=queue.length-1;select(at);if(autoplay)await start();}
 function enter(){if(state==='error'){void refresh();return;}if(state==='guest'){if(typeof startGoogleLogin==='function')void startGoogleLogin(false,'portfolio');return;}if(state==='profile')location.assign('./cabinet.html?registration=1&next=portfolio');}
 login.addEventListener('click',enter);prev.addEventListener('click',()=>void advance(-1));next.addEventListener('click',()=>void advance(1));
 play.onclick=()=>{if(['guest','profile'].includes(state)){enter();return;}if(!audio.paused){audio.pause();return;}return start();};
 audio.addEventListener('ended',()=>void advance(1,true));audio.addEventListener('play',labels);audio.addEventListener('pause',labels);
 audio.addEventListener('error',()=>{if(state==='ready'&&objectURL)status.textContent=text('Формат записи не поддерживается этим браузером. Выберите следующую.','Бұл браузер жазба пішімін қолдамайды. Келесісін таңдаңыз.');});
 new MutationObserver(labels).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 async function refresh(){
  if(!client){await check(null);return;}
  const request=++refreshGeneration,authRequest=generation;
  try{
   const result=await client.auth.getSession();if(request!==refreshGeneration||authRequest!==generation)return;if(result.error)throw result.error;
   const user=result.data?.session?.user;
   if(user?.id&&user.id===actor&&state==='ready'){
    const permission=await client.rpc('voxi_listening_allowed');if(request!==refreshGeneration||authRequest!==generation)return;
    if(permission.error)throw permission.error;if(permission.data)return;
   }
   await check(user);
  }catch{if(request===refreshGeneration&&authRequest===generation){release();state='error';labels();}}
 }
 client?.auth.onAuthStateChange((event,session)=>{
  const id=session?.user?.id||null;
  if(event==='SIGNED_OUT'||id!==actor){generation++;actor=id;release();tracks=[];queue=[];state=id?'checking':'guest';labels();setTimeout(()=>void check(session?.user),0);}
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
 window.addEventListener('pagehide',()=>{generation++;release();});
 labels();void refresh();
})();
