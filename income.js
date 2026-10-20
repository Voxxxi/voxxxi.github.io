(() => {
 'use strict';if(typeof supabaseClient==='undefined'||!supabaseClient)return;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const owner=()=>!!currentUser&&voxiStaffUserId===currentUser.id&&voxiStaffRole==='owner';
 const money=n=>new Intl.NumberFormat('ru-RU').format(Number(n)||0)+' ₸';
 const day=d=>String(d||'').split('-').reverse().join('.');
 const action=(label,fn,cls='secondary')=>{const b=el('button',label,cls);b.type='button';b.addEventListener('click',fn);return b;};
 const panel=el('section',undefined,'panel hidden');panel.id='incomePanel';
 panel.append(el('h2','Доходы'),el('p','Учитываются отмеченные оплаты по дате получения денег. Расходы не вычитаются. Раздел доступен только владельцу.','notice'));
 const controls=el('form',undefined,'voxi-income-controls'),month=el('select'),year=el('select');month.setAttribute('aria-label','Месяц доходов');year.setAttribute('aria-label','Год доходов');
 const now=new Date(),months=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
 months.forEach((name,i)=>{const o=el('option',name);o.value=String(i+1).padStart(2,'0');month.append(o);});
 for(let y=2020;y<=Math.max(now.getFullYear()+1,2030);y++){const o=el('option',String(y));o.value=String(y);year.append(o);}month.value=String(now.getMonth()+1).padStart(2,'0');year.value=String(now.getFullYear());
 controls.append(month,year,action('Показать',()=>void load(),'primary'));panel.append(controls);
 const message=el('p','','notice');message.setAttribute('role','status');const stats=el('div',undefined,'voxi-income-stats'),paid=el('div'),pending=el('div');
 panel.append(message,stats,el('h3','Полученные оплаты'),paid,el('h3','Записи выбранного месяца без отметки оплаты'),pending);document.getElementById('backupPanel').before(panel);
 const dialog=el('dialog',undefined,'voxi-user-dialog');document.body.append(dialog);let generation=0,busy=false;
 const oldSigned=setSignedIn;setSignedIn=function(user){oldSigned(user);if(!owner()){generation++;panel.classList.add('hidden');stats.replaceChildren();paid.replaceChildren();pending.replaceChildren();dialog.close();}};
 controls.addEventListener('submit',e=>{e.preventDefault();void load();});
 function songs(box,record){
  if(typeof parseSongDetails!=='function')return;
  const details=parseSongDetails({...record,price:record.quoted_amount??record.price});
  for(const song of details)box.append(el('p',song.title+' · '+song.people+' исп. · '+money(song.price),'voxi-income-song'));
 }
 async function load(){
  if(!owner()||busy)return;const actor=currentUser.id,request=++generation;message.textContent='Считаем доходы…';stats.replaceChildren();paid.replaceChildren();pending.replaceChildren();
  try{const {data,error}=await supabaseClient.rpc('voxi_income_month',{p_month:year.value+'-'+month.value+'-01'});if(error)throw error;if(request!==generation||currentUser?.id!==actor||!owner())return;
   stats.replaceChildren();for(const [title,value]of [['Получено за месяц',money(data.amount)],['Оплаченных записей',data.paidCount],['Песен в этих записях',data.songCount]]){const card=el('div',undefined,'voxi-income-stat');card.append(el('small',title),el('strong',String(value)));stats.append(card);}
   paid.replaceChildren();if(!data.payments.length)paid.append(el('p','Отмеченных оплат за этот месяц пока нет.'));
   for(const item of data.payments){const card=el('article',undefined,'voxi-track-row');card.append(el('strong',item.client_name+' · '+money(item.amount)),el('small','Получено '+day(item.paid_on)+' · Запись '+day(item.booking_date)+' в '+String(item.booking_time).slice(0,5)));songs(card,item);
    if(item.amount!==item.quoted_amount)card.append(el('p','Стоимость по заявке: '+money(item.quoted_amount)+'. Фактически получено: '+money(item.amount)+'.','notice'));
    card.append(action('Отменить отметку оплаты',async()=>{if(busy||!owner()||currentUser.id!==actor||!confirm('Отменить отметку оплаты '+money(item.amount)+' для '+item.client_name+'? Сумма перестанет входить в доход. История исправления сохранится.'))return;busy=true;try{const {error}=await supabaseClient.rpc('voxi_void_payment',{p_payment:item.id});if(error)throw error;busy=false;await load();}catch(e){message.textContent=e.message;}finally{busy=false;}},'danger'));paid.append(card);
   }
   pending.replaceChildren();pending.append(el('p','Без отметки: '+data.pendingCount+' · Стоимость заявок: '+money(data.pendingAmount)+'. Эти суммы пока не входят в полученный доход.','notice'));if(!data.pendingCount)pending.append(el('p','Заявки появятся здесь после записи через сайт. Когда получишь итоговую оплату, отметь её кнопкой «Отметить оплату».','notice'));
   for(const item of data.pending){const card=el('article',undefined,'voxi-track-row');card.append(el('strong',item.client_name+' · '+money(item.price)),el('small',day(item.booking_date)+' · '+String(item.booking_time).slice(0,5)+' · '+item.status));songs(card,item);card.append(action('Отметить оплату',()=>recordPayment(item,actor),'primary'));pending.append(card);}
   message.textContent=data.paidCount>200||data.pendingCount>200?'Итоги рассчитаны по всем записям. В каждом списке показаны первые 200.':'';
  }catch(e){if(request===generation&&currentUser?.id===actor)message.textContent='Не удалось загрузить доходы: '+e.message;}
 }
 function recordPayment(item,actor){
  if(busy||!owner()||currentUser.id!==actor)return;dialog.replaceChildren();const form=el('form');form.append(el('h2','Отметить полученную оплату'),el('p',item.client_name+' · Запись '+day(item.booking_date)+' в '+String(item.booking_time).slice(0,5)),el('p','На каждую запись — одна итоговая отметка оплаты. Укажи фактически полученную итоговую сумму.','notice'));
  const amountLabel=el('label','Полученная сумма, ₸'),amount=el('input');amount.type='number';amount.required=true;amount.min='0';amount.max='100000000';amount.step='1';amount.value=item.price;amountLabel.append(amount);
  const dateLabel=el('label','Дата получения денег'),date=el('input');date.type='date';date.required=true;date.value=window.voxiRetention.localDay(new Date());date.max=date.value;dateLabel.append(date);form.append(amountLabel,dateLabel);window.voxiEnhanceDate(date,'Открыть календарь даты оплаты');
  const error=el('p');error.setAttribute('role','alert');const save=el('button','Сохранить оплату','primary');save.type='submit';const cancel=action('Отмена',()=>{if(!busy)dialog.close();});form.append(error,save,cancel);dialog.append(form);dialog.showModal();
  form.addEventListener('submit',async e=>{e.preventDefault();if(busy||!owner()||currentUser.id!==actor)return;const received=Number(amount.value);if(!Number.isInteger(received)||received<0){error.textContent='Укажите сумму в целых тенге.';return;}busy=true;save.disabled=cancel.disabled=true;
   try{const {error:failure}=await supabaseClient.rpc('voxi_record_payment',{p_booking:item.id,p_amount:received,p_paid_on:date.value});if(failure)throw failure;if(currentUser?.id!==actor)return;dialog.close();busy=false;await load();}catch(e){if(currentUser?.id===actor)error.textContent=e.message;}finally{busy=false;save.disabled=cancel.disabled=false;}
  });
 }
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});window.voxiLoadIncome=load;
})();
