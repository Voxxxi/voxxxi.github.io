(()=>{
 if(typeof supabaseClient==='undefined'||!supabaseClient)return;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const ru=()=>document.documentElement.lang!=='kk',text=(r,k)=>ru()?r:k;
 const entry=el('button','Чат VOXi','nav-btn');entry.id='chatEntry';entry.type='button';document.querySelector('header nav')?.insertBefore(entry,document.getElementById('loginButton'));
 const panel=el('section',undefined,'panel hidden voxi-chat');panel.id='voxiChatPanel';
 const header=el('div',undefined,'voxi-chat-head'),heading=el('h2','Чат VOXi'),close=el('button','×','secondary');close.type='button';close.setAttribute('aria-label','Закрыть чат');header.append(heading,close);
 const notice=el('p',undefined,'notice'),connection=el('small'),status=el('p');status.setAttribute('role','status');
 const reports=el('button','Жалобы','secondary hidden');reports.type='button';
 const list=el('div',undefined,'voxi-chat-log');list.setAttribute('role','log');list.setAttribute('aria-live','off');list.setAttribute('aria-label','Сообщения чата');
 const form=el('form',undefined,'voxi-chat-compose'),label=el('label'),input=el('textarea');input.rows=3;input.maxLength=1000;input.required=true;input.setAttribute('aria-label','Ваше сообщение');label.append(input);
 const send=el('button','Отправить','primary');send.type='submit';form.append(label,send);panel.append(header,notice,connection,reports,status,list,form);document.querySelector('main').append(panel);
 let visible=false,reportMode=false,channel=null,poller=null,version=0,accountId=null,sending=false,signature='';
 const moderator=()=>!!currentUser&&isAdmin();
 function labels(){notice.textContent=text('Общий чат зарегистрированных клиентов. Будьте доброжелательны; телефоны из профилей здесь не показываются.','Тіркелген клиенттердің ортақ чаты. Бір-біріңізге құрмет көрсетіңіз. Профиль телефондары көрсетілмейді.');send.textContent=text('Отправить','Жіберу');input.placeholder=text('Напишите сообщение…','Хабарлама жазыңыз…');reports.textContent=reportMode?'Вернуться в чат':'Жалобы';}
 function stop(){version++;signature='';if(poller){clearInterval(poller);poller=null;}if(channel){void supabaseClient.removeChannel(channel);channel=null;}}
 function closeChat(){visible=false;stop();panel.classList.add('hidden');}
 close.addEventListener('click',closeChat);
 entry.addEventListener('click',()=>{if(visible){closeChat();return;}visible=true;panel.classList.remove('hidden');panel.scrollIntoView({behavior:'smooth',block:'start'});activate();});
 function activate(){
  stop();labels();reports.classList.toggle('hidden',!moderator());form.classList.toggle('hidden',!currentUser||reportMode);
  if(!currentUser){list.replaceChildren();connection.textContent='';status.textContent=text('Войдите через Google на сайте, затем откройте чат.','Сайтқа Google арқылы кіріп, чатты ашыңыз.');return;}
  const actor=currentUser.id;accountId=actor;void load();
  channel=supabaseClient.channel('voxi-chat-'+actor).on('postgres_changes',{event:'*',schema:'public',table:'voxi_chat_messages'},()=>{if(visible&&!reportMode)void load();}).subscribe(state=>{if(currentUser?.id===actor&&visible)connection.textContent=state==='SUBSCRIBED'?text('Сообщения обновляются онлайн','Хабарламалар онлайн жаңартылады'):text('Чат обновляется автоматически','Чат автоматты жаңартылады');});
  poller=setInterval(()=>{if(visible&&document.visibilityState!=='hidden')void load();},10000);
 }
 const signedIn=setSignedIn;setSignedIn=function(user){const changed=accountId!==(user?.id||null);signedIn(user);reports.classList.toggle('hidden',!moderator());if(!moderator()&&reportMode)reportMode=false;
  if(changed){accountId=user?.id||null;input.value='';list.replaceChildren();stop();if(visible)activate();}else if(visible){signature='';void load();}};
 reports.addEventListener('click',()=>{if(!moderator())return;reportMode=!reportMode;signature='';labels();form.classList.toggle('hidden',reportMode);void load();});
 async function load(){
  if(!visible||!currentUser)return;const actor=currentUser.id,request=++version,mode=reportMode;
  try{
   const response=mode?await supabaseClient.from('voxi_chat_reports').select('id,reason,message_id,created_at,voxi_chat_messages(body,author_name)').order('created_at',{ascending:false}).limit(50):await supabaseClient.from('voxi_chat_messages').select('id,user_id,author_name,body,created_at').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(60);
   if(response.error)throw response.error;if(request!==version||!visible||currentUser?.id!==actor||mode!==reportMode)return;
   const rows=mode?response.data:[...response.data].reverse(),nextSignature=actor+':'+moderator()+':'+mode+':'+rows.map(r=>r.id).join(',');
   if(signature===nextSignature)return;signature=nextSignature;
   const bottom=list.scrollHeight-list.scrollTop-list.clientHeight<80||!list.children.length;list.replaceChildren();
   if(!rows.length)list.append(el('p',mode?'Жалоб нет.':text('Сообщений пока нет. Начните разговор.','Әзірге хабарлама жоқ. Әңгіме бастаңыз.')));
   for(const row of rows){
    const card=el('article',undefined,'voxi-chat-message');
    if(mode){const original=row.voxi_chat_messages;card.append(el('strong',original?.author_name||'Клиент'),el('p',original?.body||'Сообщение удалено'),el('p','Жалоба: '+row.reason));
     card.append(action('Удалить сообщение',async()=>{await removeMessage(row.message_id);}),action('Закрыть жалобу',async()=>{const {error}=await supabaseClient.from('voxi_chat_reports').delete().eq('id',row.id);if(error)throw error;}));
    }else{
     card.append(el('strong',row.author_name),el('time',new Date(row.created_at).toLocaleString(ru()?'ru-RU':'kk-KZ',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})),el('p',row.body));
     if(row.user_id===actor||moderator())card.append(action(text('Удалить','Жою'),()=>removeMessage(row.id)));
     if(row.user_id!==actor)card.append(action(text('Пожаловаться','Шағымдану'),async()=>{
      const reason=prompt(text('Почему вы жалуетесь на это сообщение?','Неліктен бұл хабарламаға шағымданасыз?'));if(!reason?.trim())return;
      const {error}=await supabaseClient.from('voxi_chat_reports').insert({message_id:row.id,reporter_id:actor,reason:reason.trim().slice(0,300)});if(error&&error.code!=='23505')throw error;
      status.textContent=text('Жалоба передана модератору.','Шағым модераторға жіберілді.');
     }));
    }
    list.append(card);
   }
   if(bottom||mode)list.scrollTop=list.scrollHeight;status.textContent='';
  }catch(error){if(request===version&&visible&&currentUser?.id===actor)status.textContent=error.message||text('Не удалось обновить чат.','Чат жаңартылмады.');}
 }
 async function removeMessage(id){if(!confirm(text('Удалить сообщение из чата?','Хабарламаны чаттан жою керек пе?')))return;const {error}=await supabaseClient.from('voxi_chat_messages').delete().eq('id',id);if(error)throw error;}
 function action(label,fn){const b=el('button',label,'voxi-chat-action');b.type='button';b.addEventListener('click',async()=>{if(!currentUser)return;const actor=currentUser.id;b.disabled=true;try{await fn();if(currentUser?.id===actor){signature='';await load();}}catch(error){if(currentUser?.id===actor)status.textContent=error.message||'Не удалось выполнить действие.';}finally{b.disabled=false;}});return b;}
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(sending||!currentUser||reportMode)return;const actor=currentUser.id,body=input.value.trim();if(!body)return;
  sending=true;send.disabled=input.disabled=true;status.textContent=text('Отправляем…','Жіберілуде…');
  try{const {error}=await supabaseClient.from('voxi_chat_messages').insert({user_id:actor,body});if(error)throw error;if(currentUser?.id!==actor)return;input.value='';signature='';await load();input.focus();}
  catch(error){if(currentUser?.id===actor)status.textContent=error.message||text('Сообщение не отправлено.','Хабарлама жіберілмеді.');}
  finally{sending=false;send.disabled=input.disabled=false;}
 });
 window.addEventListener('beforeunload',stop);window.addEventListener('focus',()=>{if(visible)void load();});document.getElementById('ru')?.addEventListener('click',()=>{labels();signature='';if(visible)void load();});document.getElementById('kk')?.addEventListener('click',()=>{labels();signature='';if(visible)void load();});labels();
})();
