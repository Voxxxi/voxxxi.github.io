(()=>{
 'use strict';
 if(typeof supabaseClient==='undefined'||!supabaseClient)return;
 const byId=id=>document.getElementById(id);
 const roles={owner:'Владелец',admin:'Администратор',helper:'Помощник',client:'Клиент'};
 const canSee=()=>!!currentUser&&voxiStaffUserId===currentUser.id&&['owner','admin'].includes(voxiStaffRole);
 const node=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
 const button=(text,handler,className='secondary')=>{const b=node('button',text,className);b.type='button';b.addEventListener('click',handler);return b;};
 const entry=button('Пользователи',open,'nav-btn hidden');entry.id='usersEntry';
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
 setSignedIn=function(user){signedIn(user);entry.classList.toggle('hidden',!canSee());if(!canSee()){version++;list.replaceChildren();panel.classList.add('hidden');dialog.close();pending=null;}};
 entry.classList.toggle('hidden',!canSee());
 async function open(){if(!canSee())return;await openVOXiSection('admin');if(!canSee())return;panel.classList.remove('hidden');panel.scrollIntoView({behavior:'smooth',block:'start'});await load(1);}
 searchForm.addEventListener('submit',e=>{e.preventDefault();if(!mutating)load(1);});
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
  const card=node('article',undefined,'voxi-user-card');
  card.append(node('h3',user.full_name||'Анкета ещё не заполнена'));
  for(const [label,value] of [['Телефон',user.phone||'Не указан'],['Email',user.email||'Не указан'],['ID',user.user_id],['Роль',roles[user.role]||'Клиент']]){const p=node('p');p.append(node('strong',label+': '),node(label==='ID'?'code':'span',value));card.append(p);}
  if(canManage&&user.role!=='owner'){
   const actions=node('div',undefined,'voxi-user-actions'),select=node('select');select.setAttribute('aria-label','Новая роль для '+(user.full_name||user.email));
   for(const role of ['client','helper','admin']){const o=node('option',roles[role]);o.value=role;select.append(o);}select.value=user.role;
   actions.append(select,button('Применить роль',()=>{if(select.value!==user.role)confirmAction(user,'set_role',select.value);}),button('Удалить аккаунт',()=>confirmAction(user,'delete_user'),'danger'));card.append(actions);
  }else if(user.role==='owner')card.append(node('p','Аккаунт владельца защищён.','muted'));
  list.append(card);
 }
 function confirmAction(user,action,role){
  if(mutating||!canSee()||!canManage)return;
  pending={user,action,role,actor:currentUser.id};dialog.replaceChildren();
  const form=node('form');dialog.append(form);
  form.append(node('h2',action==='delete_user'?'Удалить аккаунт?':'Изменить роль?'),node('p',(user.full_name||user.email)+' · '+user.user_id));
  if(action==='delete_user')form.append(node('p','Будут удалены учётная запись, анкета и связанные заявки. Действие необратимо. Для подтверждения введите УДАЛИТЬ.'));
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
 dialog.addEventListener('cancel',e=>{if(mutating)e.preventDefault();else pending=null;});
})();
