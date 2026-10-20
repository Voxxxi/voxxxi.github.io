(() => {
 'use strict';if(typeof supabaseClient==='undefined'||!supabaseClient)return;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const owner=()=>!!currentUser&&voxiStaffUserId===currentUser.id&&voxiStaffRole==='owner';
 const money=n=>new Intl.NumberFormat('ru-RU').format(Number(n)||0)+' ₸',day=d=>String(d||'').split('-').reverse().join('.');
 const panel=el('section',undefined,'panel hidden');panel.id='incomePanel';
 panel.append(el('h2','Доходы'),el('p','Заявка закрывается автоматически, когда клиенту загружены все её песни. В доход входит полная сумма заявки за месяц выдачи последней песни. Расходы не вычитаются.','notice'));
 const controls=el('form',undefined,'voxi-income-controls'),month=el('select'),year=el('select');month.setAttribute('aria-label','Месяц доходов');year.setAttribute('aria-label','Год доходов');
 const now=new Date(),months=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
 months.forEach((name,i)=>{const o=el('option',name);o.value=String(i+1).padStart(2,'0');month.append(o);});
 for(let y=2020;y<=Math.max(now.getFullYear()+1,2030);y++){const o=el('option',String(y));o.value=String(y);year.append(o);}month.value=String(now.getMonth()+1).padStart(2,'0');year.value=String(now.getFullYear());
 const show=el('button','Показать','primary');show.type='submit';controls.append(month,year,show);panel.append(controls);
 const message=el('p','','notice');message.setAttribute('role','status');const stats=el('div',undefined,'voxi-income-stats'),complete=el('div'),pending=el('div');
 panel.append(message,stats,el('h3','Закрытые заявки'),complete,el('h3','Заявки выбранного месяца — песни ещё не выданы полностью'),pending);document.getElementById('backupPanel').before(panel);
 let generation=0;
 const oldSigned=setSignedIn;setSignedIn=function(user){oldSigned(user);if(!owner()){generation++;panel.classList.add('hidden');stats.replaceChildren();complete.replaceChildren();pending.replaceChildren();}};
 controls.addEventListener('submit',e=>{e.preventDefault();void load();});
 function songs(box,record){if(typeof parseSongDetails!=='function')return;for(const song of parseSongDetails({...record,price:record.quoted_amount??record.price}))box.append(el('p',song.title+' · '+song.people+' исп. · '+money(song.price),'voxi-income-song'));}
 async function load(){
  if(!owner())return;const actor=currentUser.id,request=++generation;message.textContent='Считаем доходы…';stats.replaceChildren();complete.replaceChildren();pending.replaceChildren();
  try{const {data,error}=await supabaseClient.rpc('voxi_income_month',{p_month:year.value+'-'+month.value+'-01'});if(error)throw error;if(request!==generation||currentUser?.id!==actor||!owner())return;
   for(const [title,value]of [['Заработано за месяц',money(data.amount)],['Закрытых заявок',data.paidCount],['Песен по этим заявкам',data.songCount]]){const card=el('div',undefined,'voxi-income-stat');card.append(el('small',title),el('strong',String(value)));stats.append(card);}
   if(!data.payments.length)complete.append(el('p','За этот месяц пока нет заявок, по которым выданы все песни.'));
   for(const item of data.payments){const card=el('article',undefined,'voxi-track-row');card.append(el('strong',item.client_name+' · '+money(item.amount)),el('small','Закрыта '+day(item.paid_on)+' · Запись '+day(item.booking_date)+' в '+String(item.booking_time).slice(0,5)),el('p','Выданы все песни: '+item.song_count+'. Сумма учтена один раз.','notice'));songs(card,item);complete.append(card);}
   pending.append(el('p','Не закрыто: '+data.pendingCount+' · Сумма заявок: '+money(data.pendingAmount)+'. Эти суммы пока не входят в заработок.','notice'));
   if(!data.pendingCount)pending.append(el('p','Заявки появятся здесь после записи через сайт. Загружай готовые песни с привязкой к заявке — сайт сам посчитает заработок.','notice'));
   for(const item of data.pending){const card=el('article',undefined,'voxi-track-row');card.append(el('strong',item.client_name+' · '+money(item.price)),el('small',day(item.booking_date)+' · '+String(item.booking_time).slice(0,5)+' · '+item.status),el('p','Выдано '+item.uploaded_count+' из '+item.song_count+' песен.','notice'));songs(card,item);pending.append(card);}
   message.textContent=data.paidCount>200||data.pendingCount>200?'Итоги рассчитаны по всем заявкам. В каждом списке показаны первые 200.':'';
  }catch(e){if(request===generation&&currentUser?.id===actor)message.textContent='Не удалось загрузить доходы: '+e.message;}
 }
 window.voxiLoadIncome=load;
})();
