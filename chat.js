(()=>{
 const chatClient=typeof supabaseClient!=='undefined'?supabaseClient:window.voxiCabinetClient;
 if(!chatClient)return;
 const mainPage=typeof setSignedIn==='function';
 let account=mainPage?currentUser:null,staffRole=mainPage?voxiStaffRole:null,roleRequest=0;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const ru=()=>document.documentElement.lang!=='kk',text=(r,k)=>ru()?r:k;
 let dock=document.querySelector('.social');
 if(!dock){dock=el('div',undefined,'social');document.body.append(dock);for(const [label,url,cls,svg]of [
  ['WhatsApp','https://wa.me/77011637393','whatsapp','<path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.5 7.5c-.8 1-.4 3 1.5 5s4 2.6 5.2 1.7l.5-1.4-2.1-1-.9 1c-1.2-.5-2.4-1.7-2.9-2.8l1-1-1-2Z"/>'],
  ['Telegram','https://t.me/Aza8500','telegram','<path d="m21 4-3.4 16-5.3-4-2.8 2.7.5-4.5L18 7 7.8 13.2 3 11.7Z"/>']]){const a=el('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.className=cls;a.setAttribute('aria-label',label);a.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+svg+'</svg>';dock.append(a);}}
 dock.classList.add('voxi-contact-dock');
 const entry=el('button',undefined,'voxi-chat-launcher');entry.id='chatEntry';entry.type='button';entry.setAttribute('aria-label','Открыть чат VOXi');entry.setAttribute('aria-controls','voxiChatPanel');entry.setAttribute('aria-expanded','false');entry.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8H5l-3 2v-7a8 8 0 1 1 18-3Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 10h9M7 14h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';dock.append(entry);
 const panel=el('section',undefined,'hidden voxi-chat');panel.id='voxiChatPanel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Общий чат VOXi');
 const header=el('div',undefined,'voxi-chat-head'),heading=el('h2','Чат VOXi'),close=el('button','×','secondary');close.type='button';close.setAttribute('aria-label','Закрыть чат');header.append(heading,close);
 const notice=el('p',undefined,'notice'),connection=el('small'),status=el('p');status.setAttribute('role','status');
 const reports=el('button','Жалобы','secondary hidden');reports.type='button';
 const list=el('div',undefined,'voxi-chat-log');list.setAttribute('role','log');list.setAttribute('aria-live','off');list.setAttribute('aria-label','Сообщения чата');
 const form=el('form',undefined,'voxi-chat-compose'),label=el('label'),input=el('textarea');input.rows=2;input.maxLength=1000;input.required=true;input.setAttribute('aria-label','Ваше сообщение');label.append(input);
 const tabs=el('nav',undefined,'voxi-chat-tabs'),communityTab=el('button','Общий чат'),assistantTab=el('button','ИИ-помощник');communityTab.type=assistantTab.type='button';tabs.append(communityTab,assistantTab);
 const send=el('button','Отправить','primary');send.type='submit';form.append(label,send);panel.append(header,tabs,notice,connection,reports,status,list,form);document.body.append(panel);
 let aiMode=false,privateHistory=[];
 let visible=false,reportMode=false,channel=null,poller=null,version=0,accountId=null,sending=false,signature='';
 const moderator=()=>!!account&&['owner','admin','helper'].includes(staffRole);
 function labels(){panel.setAttribute('aria-label',aiMode?text('Личная беседа с ИИ VOXi','VOXi ЖИ көмекшісімен жеке әңгіме'):text('Общий чат VOXi','VOXi ортақ чаты'));notice.textContent=aiMode?text('Личная беседа с автоматическим помощником Cloudflare. Другие клиенты её не видят. Ответы — на русском и казахском.','Cloudflare автоматты көмекшісімен жеке әңгіме. Басқа клиенттер көрмейді. Жауаптар орысша және қазақша.'):text('Общий чат клиентов. Для общего вопроса помощнику напишите @VOXi. Личные данные здесь не публикуйте.','Клиенттердің ортақ чаты. Көмекшіге жалпы сұрақ қою үшін @VOXi деп жазыңыз. Жеке деректерді жарияламаңыз.');communityTab.textContent=text('Общий чат','Ортақ чат');assistantTab.textContent=text('ИИ-помощник','ЖИ-көмекші');communityTab.setAttribute('aria-pressed',String(!aiMode));assistantTab.setAttribute('aria-pressed',String(aiMode));send.textContent=text('Отправить','Жіберу');input.placeholder=text('Напишите сообщение…','Хабарлама жазыңыз…');reports.textContent=reportMode?'Вернуться в чат':'Жалобы';}
 communityTab.addEventListener('click',()=>switchMode(false));assistantTab.addEventListener('click',()=>switchMode(true));
 function switchMode(mode){if(sending)return;aiMode=mode;reportMode=false;input.value='';status.textContent='';if(visible)activate();}
 function paintPrivate(){list.replaceChildren();if(!privateHistory.length)list.append(el('p',text('Спросите об услугах, цене или записи в студию.','Қызметтер, баға немесе студияға жазылу туралы сұраңыз.')));for(const [index,row] of privateHistory.entries()){const card=el('article',undefined,'voxi-chat-message');card.append(el('strong',row.role==='user'?text('Вы','Сіз'):row.kind==='ai'?text('ИИ VOXi','VOXi ЖИ'):text('VOXi · справочный ответ','VOXi · анықтамалық жауап')),el('p',row.content));if(row.role==='assistant'&&/WhatsApp|администратор|әкімші/.test(row.content)){const link=el('a',text('Написать администратору','Әкімшіге жазу'),'secondary');link.href='https://wa.me/77011637393';link.target='_blank';link.rel='noopener noreferrer';card.append(link);}if(row.role==='assistant'&&staffRole==='owner'){const correction=el('button',text('Исправить ответ','Жауапты түзету'),'secondary');correction.type='button';correction.addEventListener('click',()=>{try{sessionStorage.setItem('voxiAiCorrection',JSON.stringify({question:privateHistory[index-1]?.content||'',answer:row.content,language:ru()?'ru':'kk'}));location.assign('./admin.html?section=consultant');}catch{status.textContent=text('Откройте «Знания консультанта» в админке.','Әкімші бөліміндегі көмекші білімін ашыңыз.');}});card.append(correction);}list.append(card);}list.scrollTop=list.scrollHeight;}
 function stop(){version++;signature='';if(poller){clearInterval(poller);poller=null;}if(channel){void chatClient.removeChannel(channel);channel=null;}}
 function closeChat(){visible=false;stop();panel.classList.add('hidden');entry.setAttribute('aria-expanded','false');entry.focus();}
 close.addEventListener('click',closeChat);
 entry.addEventListener('click',()=>{if(visible){closeChat();return;}visible=true;panel.classList.remove('hidden');entry.setAttribute('aria-expanded','true');activate();close.focus();});
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeChat();}});
 function activate(){
  stop();labels();reports.classList.toggle('hidden',!moderator()||aiMode);form.classList.toggle('hidden',!account||reportMode);
  if(!account){list.replaceChildren();connection.textContent='';status.textContent=text('Войдите через Google на сайте, затем откройте чат.','Сайтқа Google арқылы кіріп, чатты ашыңыз.');return;}
  if(aiMode){connection.textContent='';status.textContent='';paintPrivate();return;}
  const actor=account.id;accountId=actor;void load();
  channel=chatClient.channel('voxi-chat-'+actor).on('postgres_changes',{event:'*',schema:'public',table:'voxi_chat_messages'},()=>{if(visible&&!reportMode)void load();}).subscribe(state=>{if(account?.id===actor&&visible)connection.textContent=state==='SUBSCRIBED'?text('Сообщения обновляются онлайн','Хабарламалар онлайн жаңартылады'):text('Чат обновляется автоматически','Чат автоматты жаңартылады');});
  poller=setInterval(()=>{if(visible&&document.visibilityState!=='hidden')void load();},10000);
 }
 function applyAccount(user,role){const changed=account?.id!==(user?.id||undefined);account=user;staffRole=role;reports.classList.toggle('hidden',!moderator()||aiMode);if(!moderator()&&reportMode)reportMode=false;
  if(changed){privateHistory=[];accountId=user?.id||null;input.value='';list.replaceChildren();stop();if(visible)activate();}else if(visible){form.classList.toggle('hidden',!account||reportMode);labels();signature='';if(aiMode)paintPrivate();else void load();}}
 if(mainPage){const signedIn=setSignedIn;setSignedIn=function(user){signedIn(user);applyAccount(user,voxiStaffUserId===user?.id?voxiStaffRole:null);};}
 else{
  async function roleFor(user){const request=++roleRequest;try{const {data,error}=await chatClient.rpc('voxi_staff_session');if(request===roleRequest&&account?.id===user.id)applyAccount(user,error?null:data);}catch{if(request===roleRequest&&account?.id===user.id)applyAccount(user,null);}}
  chatClient.auth.onAuthStateChange((_event,session)=>{roleRequest++;applyAccount(session?.user||null,null);if(session?.user)setTimeout(()=>void roleFor(session.user),0);});
  const initialRequest=roleRequest;void chatClient.auth.getSession().then(({data})=>{if(initialRequest!==roleRequest)return;const user=data?.session?.user;if(!account&&user){applyAccount(user,null);void roleFor(user);}}).catch(()=>{});
 }
 reports.addEventListener('click',()=>{if(!moderator())return;reportMode=!reportMode;signature='';labels();form.classList.toggle('hidden',reportMode);void load();});
 async function load(){
  if(!visible||!account||aiMode)return;const actor=account.id,request=++version,mode=reportMode;
  try{
   const response=mode?await chatClient.from('voxi_chat_reports').select('id,reason,message_id,created_at,voxi_chat_messages(body,author_name)').order('created_at',{ascending:false}).limit(50):await chatClient.from('voxi_chat_messages').select('id,user_id,author_name,body,created_at').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(60);
   if(response.error)throw response.error;if(request!==version||!visible||account?.id!==actor||mode!==reportMode)return;
   const replies=!mode&&response.data.length?await chatClient.from('voxi_ai_replies').select('message_id,body,kind').in('message_id',response.data.map(r=>r.id)):{data:[]};
   if(request!==version||!visible||account?.id!==actor||aiMode)return;
   const replyMap=new Map((replies.data||[]).map(r=>[r.message_id,r]));
   const rows=mode?response.data:[...response.data].reverse(),nextSignature=actor+':'+moderator()+':'+mode+':'+rows.map(r=>r.id+':'+(replyMap.get(r.id)?.body||'')).join(',');
   if(signature===nextSignature)return;signature=nextSignature;
   const bottom=list.scrollHeight-list.scrollTop-list.clientHeight<80||!list.children.length;list.replaceChildren();
   if(!rows.length)list.append(el('p',mode?'Жалоб нет.':text('Сообщений пока нет. Начните разговор.','Әзірге хабарлама жоқ. Әңгіме бастаңыз.')));
   for(const row of rows){
    const card=el('article',undefined,'voxi-chat-message');
    if(mode){const original=row.voxi_chat_messages;card.append(el('strong',original?.author_name||'Клиент'),el('p',original?.body||'Сообщение удалено'),el('p','Жалоба: '+row.reason));
     card.append(action('Удалить сообщение',async()=>{await removeMessage(row.message_id);}),action('Закрыть жалобу',async()=>{const {error}=await chatClient.from('voxi_chat_reports').delete().eq('id',row.id);if(error)throw error;}));
    }else{
     card.append(el('strong',row.author_name),el('time',new Date(row.created_at).toLocaleString(ru()?'ru-RU':'kk-KZ',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})),el('p',row.body));
     const aiReply=replyMap.get(row.id);if(aiReply){const answer=el('div',undefined,'voxi-ai-reply');answer.append(el('strong',aiReply.kind==='ai'?text('ИИ VOXi','VOXi ЖИ'):text('VOXi · справочный ответ','VOXi · анықтамалық жауап')),el('p',aiReply.body));card.append(answer);}
     if(row.user_id===actor||moderator())card.append(action(text('Удалить','Жою'),()=>removeMessage(row.id)));
     if(row.user_id!==actor)card.append(action(text('Пожаловаться','Шағымдану'),async()=>{
      const reason=prompt(text('Почему вы жалуетесь на это сообщение?','Неліктен бұл хабарламаға шағымданасыз?'));if(!reason?.trim())return;
      const {error}=await chatClient.from('voxi_chat_reports').insert({message_id:row.id,reporter_id:actor,reason:reason.trim().slice(0,300)});if(error&&error.code!=='23505')throw error;
      status.textContent=text('Жалоба передана модератору.','Шағым модераторға жіберілді.');
     }));
    }
    list.append(card);
   }
   if(bottom||mode)list.scrollTop=list.scrollHeight;status.textContent='';
  }catch(error){if(request===version&&visible&&account?.id===actor)status.textContent=error.message||text('Не удалось обновить чат.','Чат жаңартылмады.');}
 }
 async function removeMessage(id){if(!confirm(text('Удалить сообщение из чата?','Хабарламаны чаттан жою керек пе?')))return;const {error}=await chatClient.from('voxi_chat_messages').delete().eq('id',id);if(error)throw error;}
 function action(label,fn){const b=el('button',label,'voxi-chat-action');b.type='button';b.addEventListener('click',async()=>{if(!account)return;const actor=account.id;b.disabled=true;try{await fn();if(account?.id===actor){signature='';await load();}}catch(error){if(account?.id===actor)status.textContent=error.message||'Не удалось выполнить действие.';}finally{b.disabled=false;}});return b;}
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(sending||!account||reportMode)return;const actor=account.id,body=input.value.trim();if(!body)return;
  sending=true;send.disabled=input.disabled=true;status.textContent=text('Отправляем…','Жіберілуде…');
  try{if(aiMode){const request=version,history=privateHistory.slice(-2).map(r=>({role:r.role,content:r.content.slice(0,200)}));
    const response=await aiRequest({action:'chat',message:body,history,language:ru()?'ru':'kk'});
    if(account?.id!==actor||request!==version)return;privateHistory.push({role:'user',content:body},{role:'assistant',content:response.body,kind:response.kind});privateHistory=privateHistory.slice(-20);input.value='';status.textContent='';paintPrivate();return;
   }
   const {data,error}=await chatClient.from('voxi_chat_messages').insert({user_id:actor,body}).select('id').single();if(error)throw error;if(account?.id!==actor)return;input.value='';signature='';await load();input.focus();
   if(/(?:^|\s)@?(?:voxi|вокси)(?=$|\s|[,.!?])/i.test(body)){status.textContent=text('Помощник готовит ответ…','Көмекші жауап дайындауда…');try{await aiRequest({action:'community',messageId:data.id,language:ru()?'ru':'kk'});if(account?.id===actor){signature='';await load();}}catch{if(account?.id===actor)status.textContent=text('Сообщение сохранено. Помощник временно недоступен.','Хабарлама сақталды. Көмекші уақытша қолжетімсіз.');}}
  }
  catch(error){if(account?.id===actor)status.textContent=error.message||text('Сообщение не отправлено.','Хабарлама жіберілмеді.');}
  finally{sending=false;send.disabled=input.disabled=false;}
 });
 async function aiRequest(body){let timer;try{const result=await Promise.race([chatClient.functions.invoke('voxi-ai',{body}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(text('Помощник не ответил. Попробуйте позже.','Көмекші жауап бермеді. Кейінірек қайталаңыз.'))),35000);})]);if(result.error||result.data?.error||typeof result.data?.body!=='string')throw Error(result.data?.error||text('Помощник временно недоступен.','Көмекші уақытша қолжетімсіз.'));return result.data;}finally{clearTimeout(timer);}}
 window.addEventListener('beforeunload',stop);window.addEventListener('focus',()=>{if(visible)void load();});document.getElementById('ru')?.addEventListener('click',()=>{labels();signature='';if(visible)void load();});document.getElementById('kk')?.addEventListener('click',()=>{labels();signature='';if(visible)void load();});labels();
})();
